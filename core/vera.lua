
-- ------------------------------------------------------------
-- Mock for local testing outside of Vera
-- ------------------------------------------------------------
-- Implements main core functions
-- See MicasaVerde wiki for more description
-- http://wiki.micasaverde.com/index.php/Luup_Lua_extensions
-- ------------------------------------------------------------
-- Homepage : https://github.com/vosmont/Vera-Plugin-Mock
-- ------------------------------------------------------------
--[[
-- Changelog :
 0.0.9 Add "luup.register_handler"
       Replace "os.time" and "os.date"
       Fix a bug in thread with error handling
       Fix a bug with milliseconds in log
       Catch errors in "variable_set"
 0.0.8 Add milliseconds in log
       Add ability to watch service or all devices
 0.0.7 Add "luup.call_timer"
 0.0.6 Add some service actions
       Add response callback for luup.inet.wget
       Add threadId and timestamps in log
       Add reset threads
 0.0.5 Add LUA interpreter version verification
       Add some new reset functions
       Add last update on "luup.variable_get"
       Use json.lua
 0.0.4 Add verbosity level
       Fix a bug on no handling of error in threads
       Convert value in String in luup.variable_set
 0.0.3 Fix a bug on "luup.variable_set" with trigger and moduleId
       Fix a bug on "VeraMock.run" with moduleId
 0.0.2 Add log level and some logs
       Add "luup.inet.wget" and url management
       Add action management
       Fix a bug on "VeraMock.run" and add threadId
 0.0.1 First release
--]]
-- ------------------------------------------------------------

print("")
print("[VeraMock] LUA interpreter : " .. _VERSION)
assert(_VERSION == "Lua 5.1", "Vera LUA core is in version 5.1")
print("")

local json = require("json")
local string = string

local VeraMock = {
	_DESCRIPTION = "Mock for local testing outside of Vera",
	_VERSION = "0.0.9",
	verbosity = 0
}

-- *****************************************************
-- OS hook
-- *****************************************************

local _deltaTime = nil
local _dayOfWeek, _dayOfMonth = nil, nil

local osTimeFunction = os.time
local osDateFunction = os.date

_G.os.time = function (t)
	local time = osTimeFunction(t)
	if (_deltaTime ~= nil) then
		time = time - _deltaTime
	end
	return time
end

_G.os.date = function (dateFormat, t)
	if (t == nil) then
		t = os.time()
	end
	if (_dayOfWeek ~= nil) then
		dateFormat = string.gsub(dateFormat, "%%w", tostring(_dayOfWeek))
	end
	if (_dayOfMonth ~= nil) then
		dateFormat = string.gsub(dateFormat, "%%d", tostring(_dayOfMonth))
	end
	return osDateFunction(dateFormat, t)
end

-- *****************************************************
-- Vera core
-- *****************************************************

local _threads = {}
local _threadLastId = 0
local _threadCurrentId = 0
local _triggers = {}
local _values = {}
local _lastUpdates = {}
local _services = {}
local _actions = {}
local _urls = {}
local _startClock = os.clock()

local function build_path (...)
	local path = ""
	for i, v in ipairs({...}) do -- Lua 5.2
		if (v ~= nil) then
			if (path == "") then
				path = tostring(v)
			else
				path = path .. ";" .. tostring(v)
			end
		end
	end
	return path
end

local function get_device_name (deviceId)
	if (luup.devices[deviceId] == nil) then 
		return ""
	end
	local name = luup.devices[deviceId].description
	if (name ~= nil) then
		return name
	else
		return ""
	end
end

local function tableConcat (target, source)
	if ((type(target) ~= "table") or (type(source) ~= "table")) then
		return false
	end
	for i, value in ipairs(source) do
		table.insert(target, value)
	end
end

local luup = {
	version_branch = 1,
	version_major = 5,
	version_minor = 408,

	longitude = 2.294476,
	latitude = 48.858246,

	--devices = {["99"]={description="Dummy"}},
	devices = {},
	rooms = {}
 }

	luup.log = function (x, level)
		if level == 1 then
			--VeraMock:log("ERROR \027[00;31m" .. x .. "\027[00m")
			VeraMock:log("ERROR " .. x, 1)
		elseif level == 2 then
			VeraMock:log("WARN  " .. x, 2)
		else
			VeraMock:log("INFO  " .. x, 3)
		end
	end

	luup.task = function (message, status, description, handle)
		VeraMock:log("CORE  [luup.task] Module:'" .. description .. "' - State:'" .. message .. "' - Status:'" .. status .. "'", 1)
		return 1
	end

	luup.call_delay = function (function_name, seconds, data, thread)
		if (_G[function_name] == nil) then
			VeraMock:log("CORE  [luup.call_delay] Callback doesn't exist", 1)
			return false
		end
		VeraMock:log("CORE  [luup.call_delay] Call function '" .. function_name .. "' in " .. tostring(seconds) .. " seconds with parameter '" .. tostring(data) .. "'", 4)
		_threadLastId = _threadLastId + 1
		local threadId = _threadLastId
		local newThread = coroutine.create(
			function (t0, function_name, seconds, data)
				while (os.clock() - t0 < seconds) do
					coroutine.yield(t0, function_name, seconds, data)
				end
				_threadCurrentId = threadId
				VeraMock:log("CORE  [luup.call_delay] Delay of " .. tostring(seconds) .. " seconds is reached: call function '" .. function_name .. "' with parameter '" .. tostring(data) .. "'", 3)
				local status, result = pcall(_G[function_name], data)
				if not status then
					VeraMock:log("ERROR " .. result, 1)
					error(result)
				end
				_threadCurrentId = 0
				VeraMock:log("CORE  <------- Thread #" .. tostring(threadId) .. " finished", 4)
				return false
			end
		)
		-- Start new thread
		table.insert(_threads, {id=threadId , co=newThread})
		VeraMock:log("CORE  -------> Thread #" .. tostring(threadId) .. " created", 4)
		coroutine.resume(newThread, os.clock(), function_name, seconds, data)
		return true
	end

	luup.call_timer = function (function_name, timer_type, time, days, data)
		local path = build_path(timer_type, time, days)
		if (_triggers[path] == nil) then
			_triggers[path] = {}
		end
		VeraMock:log("CORE  [luup.call_timer] Register timer" ..
								" - type:'" .. tostring(timer_type) .. "'" .. 
								" - time:'" .. tostring(time) .. "'" ..
								" - days:'" ..  tostring(days) .. "'" ..
								" - data:'" .. tostring(data) .. "'" ..
								" - callback function:'" .. function_name .. "'", 4)
		if (type(_G[function_name]) == "function") then
			table.insert(_triggers[path], wrapAnonymousCallback(function ()
				VeraMock:log("CORE  [luup.call_timer] Call '" .. function_name .. "' with data '" .. data .. "'", 3)
				_G[function_name](data)
			end))
		else
			VeraMock:log("CORE  [luup.call_timer] '" .. function_name .. "' is not a function", 1)
		end
	end

	luup.is_ready = function (device)
		VeraMock:log("CORE  [luup.is_ready] device #" .. tostring(device) .. "('" .. get_device_name(device) .. ")' is ready", 4)
		return true
	end

	luup.call_action = function (service, action, arguments, device)
		VeraMock:log("CORE  [luup.call_action] device:#" .. tostring(device) .. "(" .. get_device_name(device) .. ")" .. 
											" - service:'" .. service .. "'" ..
											" - action:'" ..  action .. "'" ..
											" - arguments:'" .. json.encode(arguments) .. "'", 4)
		local callback = _actions[build_path(service, action)]
		if (callback ~= nil) then
			local res
			if (type(callback) == "function") then
				res = callback(arguments, device)
			elseif (type(callback) == "string") then
				res = _G[callback](arguments, device)
			end
			return 0, "", 0, res
		else
			return -1, "Action not found"
		end
	end

	luup.variable_get = function (service, variable, device)
		local path = build_path(service, variable, device)
		local value = _values[path]
		local lastUpdate = _lastUpdates[path] or 0
		VeraMock:log("CORE  [luup.variable_get] device:#" .. tostring(device) .. "(" .. get_device_name(device) .. ")" ..
											" - service:'" .. service .. "'" ..
											" - variable:'" ..  variable .. "'" ..
											" - value:'" .. tostring(value) .. "'", 4)
		return value, lastUpdate
	end

	luup.variable_set = function (service, variable, value, device)
		local path = build_path(service, variable, device)
		local oldValue = _values[path]
		value = tostring(value) -- In Vera, values are always String
		_values[path] = value
		_lastUpdates[path] = osTimeFunction()
		_services[build_path(service, device)] = true
		VeraMock:log("CORE  [luup.variable_set] device:#" .. tostring(device) .. "(" .. get_device_name(device) .. ")" .. 
											" - service:'" .. tostring(service) .. "'" ..
											" - variable:'" ..  tostring(variable) .. "'" ..
											" - value:'" .. tostring(oldValue) .. "' => '" .. tostring(value) .. "'", 4)
		-- Triggers service/variable/device
		local triggers = {}
		tableConcat(triggers, _triggers[path])
		tableConcat(triggers, _triggers[build_path(service, variable, nil)])
		tableConcat(triggers, _triggers[build_path(service, nil, nil)])
		for i, function_name in ipairs(triggers) do
			VeraMock:log("CORE  [luup.variable_set] Call watcher function '" .. tostring(function_name) .. "'", 4)
			--_G[function_name](device, service, variable, oldValue, value)
			local status, result = pcall(_G[function_name], device, service, variable, oldValue, value)
			if not status then
				VeraMock:log("ERROR " .. result, 1)
				error(result)
			end
		end
	end

	luup.variable_watch = function (function_name, service, variable, device)
		local path = build_path(service, variable, device)
		if (_triggers[path] == nil) then
			_triggers[path] = {}
		end
		VeraMock:log("CORE  [luup.variable_watch] Register watch" ..
								" - device: #" .. tostring(device) .. "(" .. get_device_name(device) .. ")" .. 
								" - service: '" .. tostring(service) .. "'" ..
								" - variable: '" ..  tostring(variable) .. "'" ..
								" - callback function: '" .. tostring(function_name) .. "'", 4)
		if (type(_G[function_name]) == "function") then
			-- No check to see if function_name is already registred, as Vera does not do this
			table.insert(_triggers[path], function_name)
		else
			VeraMock:log("CORE  [luup.variable_watch] '" .. function_name .. "' is not a function", 1)
		end
	end

	luup.device_supports_service = function (service, device)
		if (_services[build_path(service, device)]) then
			VeraMock:log("CORE  [luup.device_supports_service] Device:#" .. tostring(device) .. "(" .. get_device_name(device) .. ") supports service '" .. service .. "'", 4)
			return true
		else
			VeraMock:log("CORE  [luup.device_supports_service] Device:#" .. tostring(device) .. "(" .. get_device_name(device) .. ") doesn't support service '" .. service .. "'", 4)
			return false
		end
	end

	luup.register_handler = function (function_name,  request_name)
		VeraMock:log("CORE  [luup.register_handler] Handler '" .. tostring(function_name) .. "' for '" .. tostring(request_name) .. "'", 4)
	end

	luup.inet = {
		wget = function (url, timeout, username, password)
			local requestUrl = ""
			local i = url:find("?")
			if (i ~= nil) then
				requestUrl = url:sub(i + 1)
				url = url:sub(1, i - 1)
			end
			local response = _urls[url]
			if (response ~= nil) then
				if (type(response) == "function") then
					VeraMock:log("CORE  [luup.inet.wget] url '" .. url .. " is ready. Call function with requestUrl '" .. requestUrl .. "'", 4)
					return response(requestUrl)
				else
					VeraMock:log("CORE  [luup.inet.wget] url '" .. url .. " is ready", 4)
					return 0, response
				end
			else
				VeraMock:log("CORE  [luup.inet.wget] url '" .. url .. " is unknown", 4)
				return 404, "Not found"
			end
		end
	}

_G.luup = luup

-- *****************************************************
-- Tools
-- *****************************************************

local _callbackIndex = 0

function wrapAnonymousCallback(callback)
	_callbackIndex = _callbackIndex + 1
	local callbackName = "anonymousCallback" .. tostring(_callbackIndex)
	_G[callbackName] = callback
	return callbackName
end

function string.split(str, pat)
	local t = {}  -- NOTE: use {n = 0} in Lua-5.0
	local fpat = "(.-)" .. pat
	local last_end = 1
	local s, e, cap = str:find(fpat, 1)
	while s do
		if s ~= 1 or cap ~= "" then
			table.insert(t,cap)
		end
		last_end = e+1
		s, e, cap = str:find(fpat, last_end)
	end
	if last_end <= #str then
		cap = str:sub(last_end)
		table.insert(t, cap)
	end
	return t
end

-- *****************************************************
-- VeraMock module
-- *****************************************************

	-- Init
	function VeraMock:init (lul_device)
		luup.lul_device = lul_device
		luup.variable_set( "", "id", lul_device, lul_device)
	end

	-- Add a device
	function VeraMock:addDevice (id, device, acceptDuplicates)
		local isFound = false
		if (type(id) == "table") then
			-- The device ID is not passed
			device = id
			if not acceptDuplicates then
				for i, existingDevice in ipairs(luup.devices) do
					if (existingDevice.description == device.description) then
						isFound = true
						id = i
					end
				end
			end
			if not isFound then
				id = table.getn(luup.devices) + 1
			end
		end
		assert(type(device) == "table", "The device is not defined")
		if (device.description == nil) then
			device.description = "not defined"
		end
		if (self.verbosity >= 1) then
			if not isFound then
				print("[VeraMock:addDevice] Add device #" .. tostring(id) .. "-'" .. tostring(device.description) .. "'")
			else
				print("[VeraMock:addDevice] Device #" .. tostring(id) .. "-'" .. tostring(device.description) .. "' already added")
			end
		end
		luup.devices[id] = device
	end

	-- Add a room
	function VeraMock:addRoom (id, room)
		if (self.verbosity >= 1) then
			print("[VeraMock:addRoom] Add room #" .. tostring(id) .. "-'" .. tostring(room.name) .. "'")
		end
		luup.rooms[id] = room
	end

	-- Add an action
	function VeraMock:addAction (service, action, callback)
		if (self.verbosity >= 1) then
			print("[VeraMock:addAction] Service '" .. service .. "' - Add action '" .. action .. "'")
		end
		_actions[build_path(service, action)] = callback
	end

	-- Add an URL
	function VeraMock:addUrl (url, response)
		if (self.verbosity >= 1) then
			print("[VeraMock:addUrl] Add URL '" .. url .. "'")
		end
		_urls[url] = response
	end

	-- Sets the verbosity level
	function VeraMock:setVerbosity (lvl)
		self.verbosity = lvl or 0
		assert("number" == type(self.verbosity), ("bad argument #1 to 'setVerbosity' (number expected, got %s)"):format(type(self.verbosity)))
	end

	-- Log message depending verbosity level
	function VeraMock:log (message, lvl)
		assert("string" == type(message))
		lvl = lvl or 1
		if (self.verbosity >= lvl) then
			local elapsedTime, milliseconds = math.modf(os.clock() - _startClock)
			if (milliseconds < 0.001) then
				milliseconds = "000"
			else
				milliseconds = tostring(milliseconds):sub(3, 5)
				milliseconds = milliseconds .. string.rep("0", 3 - #milliseconds)
			end
			--local formatedTime = string.format("%02d:%02d", math.floor(elapsedTime / 60), (elapsedTime % 60)) .. "." .. milliseconds
			local formatedTime = string.format("%03d", elapsedTime) .. "." .. milliseconds
			local formatedThreadId = string.format("%03d", _threadCurrentId)
			print("[VeraMock] " .. formatedThreadId .. " " .. os.date("%X", os.time()) .. " (" .. formatedTime .. ") " .. message)
		end
	end

	-- Run until all triggers are launched
	function VeraMock:run ()
		--_startClock = os.clock()
		self:log("*** BEGIN *** Run until all triggers are launched", 1)
		while true do
			local n = table.getn(_threads)
			if (n == 0) then
				-- No more threads to run
				break
			end
			for i = 1, n do
				local status, res = coroutine.resume(_threads[i].co)
				if not status then
					-- Thread finished its task
					table.remove(_threads, i)
					if (res ~="cannot resume dead coroutine") then
						-- Thread finished in error
						self:log(res, 1)
						error(res)
					end
					break
				end
			end
		end
		self:log("*** END *** Run is done", 1)
		assert(table.getn(_threads) == 0, "ERROR - At least one thread remain")
	end

	-- Reset device values
	function VeraMock:resetValues ()
		self:log("Reset device values", 1)
		_values = {}
		_lastUpdates = {}
	end

	-- Reset triggers
	function VeraMock:resetTriggers ()
		self:log("Reset triggers", 1)
		_triggers = {}
	end

	-- Reset threads
	function VeraMock:resetThreads ()
		self:log("Reset threads", 1)
		_startClock = os.clock()
		_deltaTime = nil
		_dayOfWeek, _dayOfMonth = nil, nil
		_threadLastId = 0
		_threadCurrentId = 0
		if (table.getn(_threads) > 0) then
			self:log("WARNING - " .. tostring(table.getn(_threads)) .. " thread(s) remain from previous run", 1)
			self:log("Reset threads", 1)
			_threads = {}
		end
	end

	-- Reset mock
	function VeraMock:reset ()
		self:log("Reset VeraMock", 1)
		self:resetValues()
		self:resetTriggers()
		self:resetThreads()
	end

	-- Trigger timer
	function VeraMock:triggerTimer (timerType, time, days)
		local path = build_path(timerType, time, days)
		-- Triggers linked to this timer
		local triggers = _triggers[path]
		if (triggers ~= nil) then
			for i, function_name in ipairs(triggers) do
				self:log("triggerTimer - Call watcher function '" .. function_name .. "'", 3)
				local watcherFunction = _G[function_name]
				if (type(watcherFunction) == "function") then
					watcherFunction(data)
				else
					luup.log("triggerTimer - '" .. function_name .. "' is not a function", 2)
				end
			end
		else
			luup.log("No callback linked to this event", 1)
		end
	end

	-- Set current time from a date "HH:MM:SS"
	function VeraMock:setDate (fakeDate)
		self:log("Set time : " .. tostring(fakeDate), 1)
		local now = osTimeFunction()
		local aTime = string.split(fakeDate, ":")
		_deltaTime = os.difftime(
			now,
			osTimeFunction({
				year  = os.date("%Y", now),
				month = os.date("%m", now),
				day   = os.date("%d", now),
				hour  = aTime[1],
				min   = aTime[2],
				sec   = aTime[3]
			})
		)
	end

	-- 
	function VeraMock:setDayOfWeek (fakeDayOfWeek)
		self:log("Set day of week : " .. tostring(fakeDayOfWeek), 1)
		_dayOfWeek = fakeDayOfWeek
	end
	function VeraMock:setDayOfMonth (fakeDayOfMonth)
		self:log("Set day of month : " .. tostring(fakeDayOfMonth), 1)
		_dayOfMonth = fakeDayOfMonth
	end

	-- Set current time
	function VeraMock:setTime (fakeTime)
		self:log("Set time : " .. tostring(fakeTime), 1)
		_deltaTime = os.difftime(osTimeFunction(), tonumber(fakeTime))
	end

-- *****************************************************
-- Initialisations
-- *****************************************************

-- SwitchPower action
local SID_SwitchPower = "urn:upnp-org:serviceId:SwitchPower1"
VeraMock:addAction(
	SID_SwitchPower, "SetTarget",
	function (arguments, device)
		luup.variable_set(SID_SwitchPower, "Status", arguments.NewTarget, device)
	end
)

-- Multiswitch actions
local SID_MultiSwitch = "urn:dcineco-com:serviceId:MSwitch1"
local function setMultiswitchStatus(arguments, device)
	for key, status in pairs(arguments) do
		local buttonId = tonumber(string.match(key, "%d+"))
		luup.variable_set(SID_MultiSwitch, "Status" .. buttonId, status, device)
	end
end
VeraMock:addAction(SID_MultiSwitch, "SetStatus1", setMultiswitchStatus)
VeraMock:addAction(SID_MultiSwitch, "SetStatus2", setMultiswitchStatus)
VeraMock:addAction(SID_MultiSwitch, "SetStatus3", setMultiswitchStatus)
VeraMock:addAction(SID_MultiSwitch, "SetStatus4", setMultiswitchStatus)
VeraMock:addAction(SID_MultiSwitch, "SetStatus5", setMultiswitchStatus)
VeraMock:addAction(SID_MultiSwitch, "SetStatus6", setMultiswitchStatus)
VeraMock:addAction(SID_MultiSwitch, "SetStatus7", setMultiswitchStatus)
VeraMock:addAction(SID_MultiSwitch, "SetStatus8", setMultiswitchStatus)

VeraMock:setVerbosity(1)

return VeraMock
