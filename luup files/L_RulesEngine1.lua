--[[
Description: Manage your Vera by scripts
Homepage: https://github.com/vosmont/Vera-Plugin-RulesEngine
Author: vosmont
License: MIT License, see LICENSE
--]]

module("L_RulesEngine1", package.seeall)
if (package.path:find ("./lib/?.lua;", 1, true) == nil) then
	-- For Unit Tests
	package.path = package.path .. ";./lib/?.lua"
end

local json = require("dkjson")
if (type(json) == "string") then
	-- UI5
	json = require("json")
end

-- Devices ids
local DID = {
	RulesEngine = "urn:schemas-upnp-org:device:RulesEngine:1",
	ALTUI = "urn:schemas-upnp-org:device:altui:1"
}

-- Services ids
local SID = {
	HaDevice = "urn:micasaverde-com:serviceId:HaDevice1",
	SwitchPower = "urn:upnp-org:serviceId:SwitchPower1",
	Dimming = "urn:upnp-org:serviceId:Dimming1",
	SecuritySensor = "urn:micasaverde-com:serviceId:SecuritySensor1",
	MotionSensor = "urn:micasaverde-com:serviceId:MotionSensor1",
	LightSensor = "urn:micasaverde-com:serviceId:LightSensor1",
	TemperatureSensor = "urn:upnp-org:serviceId:TemperatureSensor1",
	HumiditySensor = "urn:micasaverde-com:serviceId:HumiditySensor1",
	EnergyMetering = "urn:micasaverde-com:serviceId:EnergyMetering1",
	RulesEngine = "urn:upnp-org:serviceId:RulesEngine1",
	ALTUI = "urn:upnp-org:serviceId:altui1"
}

-------------------------------------------
-- Plugin variables
-------------------------------------------

_NAME = "RulesEngine"
_DESCRIPTION = "Rules Engine for the Vera"
_VERSION = "0.04"

local _isStarted = false
local _pluginParams = {}

local _rules = {}
local _rulesWithoutId = {}
local _indexRulesById = {}
local _indexRulesByName = {}
local _verbosity = 0
local _minRecurrentInterval = 60
local _lastRuleId = 1

-- **************************************************
-- UI compatibility
-- **************************************************

-- Update static JSON file
local function _updateStaticJSONFile (lul_device, pluginName)
	local isUpdated = false
	if (luup.version_branch ~= 1) then
		luup.log("ERROR - Plugin '" .. pluginName .. "' - checkStaticJSONFile : don't know how to do with this version branch " .. tostring(luup.version_branch), 1)
	elseif (luup.version_major > 5) then
		local currentStaticJsonFile = luup.attr_get("device_json", lul_device)
		local expectedStaticJsonFile = "D_" .. pluginName .. "_UI" .. tostring(luup.version_major) .. ".json"
		if (currentStaticJsonFile ~= expectedStaticJsonFile) then
			luup.attr_set("device_json", expectedStaticJsonFile, lul_device)
			isUpdated = true
		end
	end
	return isUpdated
end

-- **************************************************
-- String functions
-- **************************************************

local string = string

--- Pads str to length len with char from left
function string.lpad (str, len, char)
	if (char == nil) then
		char = ' '
	end
	return string.rep(char, len - #str) .. str
end

--- Pads str to length len with char from right
function string.rpad (str, len, char)
	if (char == nil) then
		char = ' '
	end
	return str .. string.rep(char, len - #str)
end

function string.split (str, pat)
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

-- **************************************************
-- Table functions
-- **************************************************

local table = table

-- Check if table contains
function table.contains (t, i)
	for k, v in pairs(t) do
		if v == i then
			return true
		end
	end
	return false
end

-- Check if table contains all
function table.containsAll (t, t2)
	for k, v in pairs(t2) do
		if not table.contains (t, v) then
			return false
		end
	end
	return true
end

-- Adds the contents from one table (b) into another (a)
function table.add (a, b)
	if ((a == nil) or (b == nil)) then
		return
	end
	table.foreach(
		b,
		function(i,v)
			table.insert(a, v)
		end
	)
end

-- Merge the contents of one table (b) into another (a)
function table.extend (a, b)
	if ((a == nil) or (b == nil)) then
		return
	end
	for key, value in pairs(b) do
		if (value ~= nil) then
			a[key] = value
		end
	end
end

-- Get first value which is of type "table"
function table.getFirstTable (t)
	for _, item in ipairs(t) do
		if (type(item) == "table")  then
			return item
		end
	end
	return nil;
end

-------------------------------------------
-- Tool functions
-------------------------------------------

local decompressScript = [[
decompress_lzo_file_in_tmp() {
	SRC_FILE=/etc/cmh-ludl/$1.lzo
	DEST_FILE=/tmp/$1
	if [ ! -e $DEST_FILE -o $SRC_FILE -nt $DEST_FILE ]
	then
		TEMP_FILE=$(mktemp)
		pluto-lzo d $SRC_FILE $TEMP_FILE
		mv $TEMP_FILE $DEST_FILE
	fi
}
]]

-- Get variable value and init if value is nil
local function _getVariableOrInit (lul_device, serviceId, variableName, defaultValue)
	local value = luup.variable_get(serviceId, variableName, lul_device)
	if (value == nil) then
		luup.variable_set(serviceId, variableName, defaultValue, lul_device)
		value = defaultValue
	end
	return value
end

-- **************************************************
-- Helpers
-- **************************************************

local function _isLogLevel (level)
	if (level > _verbosity) then
		return false
	end
	return true
end

function log (msg, methodName, level)
	level = tonumber(level) or 1
	if not _isLogLevel(level)then
		return
	end
	if (methodName == nil) then
		methodName = "UNKNOWN"
	else
		methodName = "[" .. _NAME .. "." .. tostring(methodName) .. "]"
	end
	if (_verbosity > 2) then
		methodName = "(" .. tostring(level or 1) .. ")" .. methodName
	end
	luup.log(string.rpad(methodName, 45) .. " " .. msg, 50)
end

local function warning (msg, methodName)
	if (methodName == nil) then
		methodName = "UNKNOWN"
	else
		methodName = "[" .. _NAME .. "." .. tostring(methodName) .. "]"
	end
	luup.log(string.rpad(methodName, 45) .. " WARNING: " .. msg, 2)
end

local function error (msg, methodName)
	if (methodName == nil) then
		methodName = "UNKNOWN"
	else
		methodName = "[" .. _NAME .. "." .. tostring(methodName) .. "]"
	end
	luup.log(string.rpad(methodName, 45) .. " ERROR: " .. msg, 1)
end

local function _getItemSummary (item)
	if (type(item) ~= "table") then
		return ""
	end
	--local summary = "Rule #" .. tostring(item._ruleId) .. "(" .. tostring(getRule(item._ruleId).name) .. ")" ..
	local summary = "Rule #" .. tostring(item._ruleId) .. " - " .. tostring(item._mainType) .. " #" .. tostring(item._id)
	if (item.type ~= nil) then
		summary = summary .. " of type '" .. tostring(item.type) .. "'"
	end
	local separator = "with"
	if (item._mainType == "GroupAction") then
		separator = "for"
	end
	if (item.event ~= nil) then
		summary = summary .. " " .. separator .. " event '" .. tostring(item.event) .. "'"
	end
	if (item._level ~= nil) then
		summary = summary .. " " .. separator .. " level '" .. tostring(item._level) .. "'"
	end
	if ((item._levels ~= nil) and (table.getn(item._levels) > 0)) then
		summary = summary .. " " .. separator .. " levels " .. tostring(json.encode(item._levels))
	end
	return summary
end

local function _initMultiValueKey(object, multiValueKey, monoValueKey)
	if (object[multiValueKey] == nil) then
		if ((monoValueKey ~= ni) and (object[monoValueKey] ~= nil)) then
			object[multiValueKey] = { object[monoValueKey] }
		else
			object[multiValueKey] = {}
		end
	elseif (type(object[multiValueKey]) ~= "table") then
		error("multiValueKey is not a table", "initMultiValueKey")
	end
end

local function _checkParameters (input, parameters)
	local isOk = true
	local msg = _getItemSummary(input)
	if (input == nil) then
		addRuleError(input._ruleId, "Check parameter", msg .. " - Input is not defined")
		isOk = false
	else
		for _, parameterAND in ipairs(parameters) do
			-- AND
			if (type(parameterAND) == "string") then
				if (input[parameterAND] == nil) then
					addRuleError(input._ruleId, "Check parameter", msg .. " - Parameter '" .. parameterAND .. "' is not defined")
					isOk = false
				elseif ((type(input[parameterAND]) == "table") and (next(input[parameterAND]) == nil)) then
					addRuleError(input._ruleId, "Check parameter", msg .. " - Parameter '" .. parameterAND .. "' is empty")
					isOk = false
				end
			elseif (type(parameterAND) == "table") then
				-- OR
				local isOk2 = false
				for _, parameterOR in ipairs(parameterAND) do
					if (input[parameterOR] ~= nil) then
						if (
							(type(input[parameterOR]) ~= "table")
							or ((type(input[parameterOR]) == "table") and (next(input[parameterOR]) ~= nil))
						) then
							isOk2 = true
						end
					end
				end
				if not isOk2 then
					addRuleError(input._ruleId, "Check parameter", msg .. " - Not a single parameter in " .. json.encode(parameterAND) .. "' is defined or not empty")
					isOk = false
				end
			end
		end
	end
	if not isOk then
		error(msg .. " - There's a problem with setting of input : " .. json.encode(input), "checkParameters")
	end
	return isOk
end

-- Get device id by its description
local function _getDeviceIdByName (deviceName)
	local id = nil
--print(deviceName)
--print(json.encode(luup.devices))
	if (type(deviceName) == "number") then
		id = ((luup.devices[deviceName] ~= nil) and deviceName or nil)
	elseif (type(deviceName) == "string") then
		for deviceId, device in pairs(luup.devices) do
			if (device.description == deviceName) then
				id = deviceId
			end
		end
	end
	if (id == nil) then
		error("Device " .. tostring(deviceName) .. " doesn't exist", "getDeviceIdByName")
	end
	return id
end

-- **************************************************
-- Messages
-- **************************************************

local _labels = {
	["and"] = "et",
	["oneDay"] = "un jour",
	["oneHour"] = "une heure",
	["oneMinute"] = "une minute",
	["oneSecond"] = "une seconde",
	["zeroSecond"] = "zéro seconde",
	["days"] = "jours",
	["hours"] = "heures",
	["minutes"] = "minutes",
	["seconds"] = "secondes"
}

-- ISO 8601 duration
local function _getDuration (timeInterval)
	timeInterval = tonumber(timeInterval)
	if (timeInterval == nil) then
		return ""
	end
	local days = math.floor(timeInterval / 86400)
	local daysRemainder = timeInterval % 86400
	local hours = math.floor(daysRemainder / 3600)
	local hoursRemainder = daysRemainder % 3600
	local minutes = math.floor(hoursRemainder / 60)
	local seconds = hoursRemainder % 60

	local duration = "P"

	if (days > 0) then
		duration = duration .. tostring(days) .. "D"
	end
	if (daysRemainder > 0) then
		duration = duration .. "T"
	end
	if (hours > 0) then
		duration = duration .. tostring(hours) .. "H"
	end
	if (minutes > 0) then
		duration = duration .. tostring(minutes) .. "M"
	end
	if (seconds > 0) then
		duration = duration .. tostring(seconds) .. "S"
	end

	if (duration == "P") then
		duration = "P0S"
	end
	return duration
end

local function _getTimeAgo (timestamp)
	if (timestamp == nil) then
		return ""
	end
	return _getDuration(os.difftime(os.time(), timestamp))
end

local function _getTimeAgoFull (timestamp)
	if (timestamp == nil) then
		return ""
	end
	local timeInterval = os.difftime(os.time(), timestamp)
	local days = math.floor(timeInterval / 86400)
	local daysRemainder = timeInterval % 86400
	local hours = math.floor(daysRemainder / 3600)
	local hoursRemainder = daysRemainder % 3600
	local minutes = math.floor(hoursRemainder / 60)
	local seconds = hoursRemainder % 60

	local timeAgo = ""
	-- Days
	if (days > 1) then
		timeAgo = tostring(days) .. " " .. _labels["days"]
	elseif (days == 1) then
		timeAgo = _labels["oneDay"]
	end
	-- Hours
	if ((string.len(timeAgo) > 0) and (hours > 0)) then
		timeAgo = timeAgo .. " " .. _labels["and"] .. " "
	end
	if (hours > 1) then
		timeAgo = timeAgo .. tostring(hours) .. " " .. _labels["hours"]
	elseif (hours == 1) then
		timeAgo = timeAgo .. _labels["oneHour"]
	end
	-- Minutes
	if (days == 0) then
		if ((string.len(timeAgo) > 0) and (minutes > 0)) then
			timeAgo = timeAgo .. " " .. _labels["and"] .. " "
		end
		if (minutes > 1) then
			timeAgo = timeAgo .. tostring(minutes) .. " " .. _labels["minutes"]
		elseif (minutes == 1) then
			timeAgo = timeAgo .. _labels["oneMinute"]
		end
	end
	-- Seconds
	if ((days == 0) and (hours == 0)) then
		if ((string.len(timeAgo) > 0) and (seconds > 0)) then
			timeAgo = timeAgo .. " " .. _labels["and"] .. " "
		end
		if (seconds > 1) then
			timeAgo = timeAgo .. tostring(seconds) .. " " .. _labels["seconds"]
		elseif (seconds == 1) then
			timeAgo = timeAgo .. _labels["oneSecond"]
		end
	end

	if (timeAgo == "") then
		timeAgo = _labels["zeroSecond"]
	end

	return timeAgo
end

function getEnhancedMessage (message, context)
	if (message == nil) then
		return false
	end
	if (context == nil) then
		return message
	end
	if (string.find(message, "#duration#")) then
		message = string.gsub(message, "#duration#", _getTimeAgo(context.lastStatusUpdateTime))
	end
	if (string.find(message, "#durationfull#")) then
		message = string.gsub(message, "#durationfull#", _getTimeAgoFull(context.lastStatusUpdateTime))
	end
	if (string.find(message, "#leveldurationfull#")) then
		message = string.gsub(message, "#leveldurationfull#", _getTimeAgoFull(context.lastLevelUpdateTime))
	end
	if (string.find(message, "#value#")) then
		-- Most recent value from conditions
		message = string.gsub(message, "#value#", tostring(context.value))
	end
	if (string.find(message, "#devicename#")) then
		local deviceId = tonumber(context.deviceId or "0") or 0
		if (deviceId > 0) then
			message = string.gsub(message, "#devicename#", luup.devices[deviceId].description)
		end
	end
	if (string.find(message, "#lastupdate#")) then
		message = string.gsub(message, "#lastupdate#", _getTimeAgo(context.lastUpdateTime))
	end
	if (string.find(message, "#lastupdatefull#")) then
		message = string.gsub(message, "#lastupdatefull#", _getTimeAgoFull(context.lastUpdateTime))
	end
	return message
end

-- **************************************************
-- Triggers
-- **************************************************

local _indexRulesByEvent = {}
local _indexWatchedEvents = {}

local function _registerConditionForEvent (eventName, condition)
	log(_getItemSummary(condition) .. " - Registers for event '" .. tostring(eventName) .. "'", "registerConditionForEvent", 3)
	if (_indexRulesByEvent[eventName] == nil) then
		_indexRulesByEvent[eventName] = {}
	end
	if (_indexRulesByEvent[eventName][condition._ruleId] == nil) then
		_indexRulesByEvent[eventName][condition._ruleId] = {}
	end
	if not table.contains(_indexRulesByEvent[eventName][condition._ruleId], condition) then
		table.insert(_indexRulesByEvent[eventName][condition._ruleId], condition)
	end
end

local function _getConditionsForEvent (eventName)
	local linkedRules = _indexRulesByEvent[eventName]
	if (linkedRules == nil) then
		log("Event '" .. tostring(eventName) .. "' is not linked to a rule", "getConditionsForEvent", 2)
	end
	return linkedRules
end

local function _setEventIsWatched(eventName)
	_indexWatchedEvents[eventName] = true
end

local function _isEventWatched (eventName)
	return (_indexWatchedEvents[eventName] == true)
end

-- **************************************************
-- Scheduled tasks
-- **************************************************

local _scheduledTasks = {}
local _nextWakeUps = {}

local function _getTaskInfo (task)
	local taskInfo = {
		timeout = os.date("%X", task.timeout),
		duration = _getDuration(task.delay),
		delay = task.delay,
		rule = "#" .. task.ruleId .. "(" .. getRule(task.ruleId).name .. ")",
		level = tostring(task.level),
		["function"] = task.functionName,
		itemInfo = _getItemSummary(task.item)
	}
	return tostring(json.encode(taskInfo))
end

local function _purgeExpiredWakeUp ()
--print("_nextWakeUps", json.encode(_nextWakeUps))
	local now = os.time()
	for i = #_nextWakeUps, 1, -1 do
		if (_nextWakeUps[i] <= now) then
			if _isLogLevel(4) then
				log("Wake-up #" .. tostring(i) .. "/" .. tostring(#_nextWakeUps) .. " at " .. os.date("%X", _nextWakeUps[i]) .. " (" .. tostring(_nextWakeUps[i]) .. ") is expired", "purgeExpiredWakeUp", 4)
			end
			table.remove(_nextWakeUps, i)
		end
	end
--print("_nextWakeUps", json.encode(_nextWakeUps))
end

local function _prepareNextWakeUp ()
	if (table.getn(_scheduledTasks) == 0) then
		log("No more scheduled task", "prepareNextWakeUp", 2)
		notifyTimelineUpdate()
		return false
	end
	local now = os.time()

--print("_nextWakeUps", json.encode(_nextWakeUps))
--print("os.time", now, _scheduledTasks[1].timeout)
	if ((#_nextWakeUps == 0) or (_scheduledTasks[1].timeout < _nextWakeUps[1])) then
		-- No scheduled wake-up yet or more recent task to scheduled
		table.insert(_nextWakeUps, 1, _scheduledTasks[1].timeout)
		local remainingSeconds = os.difftime(_nextWakeUps[1], now)
		if _isLogLevel(2) then
			log(
				"Now is " .. os.date("%X", now) .. " (" .. tostring(now) .. ")" ..
				" - Next wake-up in " .. tostring(remainingSeconds) .. " seconds at " .. os.date("%X", _nextWakeUps[1]),
				"prepareNextWakeUp", 2
			)
		elseif _isLogLevel(4) then
			log(
				"Now is " .. os.date("%X", now) .. " (" .. tostring(now) .. ")" ..
				" - Next wake-up in " .. tostring(remainingSeconds) .. " seconds at " .. os.date("%X", _nextWakeUps[1]) ..
				" for scheduled task: " .. _getTaskInfo(_scheduledTasks[1]),
				"prepareNextWakeUp", 4
			)
		end
		notifyTimelineUpdate()
		luup.call_delay("RulesEngine.doScheduledTasks", remainingSeconds, nil)
	else
		log("Doesn't change next wakeup : no scheduled task before current timeout", "prepareNextWakeUp", 2)
	end
end

-- Add a scheduled task
local function _addScheduledTask (rule, functionName, item, params, level, delay)
	local _rule = getRule(rule)
	if (_rule == nil) then
		return
	end
	local _newScheduledTask = {
		timeout = (os.time() + tonumber(delay)),
		delay = tonumber(delay),
		ruleId = _rule._id,
		level = level,
		functionName = functionName,
		item = item,
		params = params
	}

	-- Search where to insert the new scheduled task
	local index = #_scheduledTasks + 1
	for i = #_scheduledTasks, 0, -1 do
		if (i == 0) then
			index = 1
		elseif (_newScheduledTask.timeout >= _scheduledTasks[i].timeout) then
			index = i + 1
			break
		end
	end
	table.insert(_scheduledTasks, index, _newScheduledTask)
	if _isLogLevel(4) then
		log("Add task at index #" .. tostring(index) .. "/" .. tostring(#_scheduledTasks) .. ": " .. _getTaskInfo(_newScheduledTask), "addScheduledTask", 4)
	end
	updateRulesInfos(rule._id)

	_prepareNextWakeUp()
end

-- Remove all scheduled actions for a rule and optionaly a level or an item
local function _removeScheduledTasks (rule, level, item)
	local msg = "Remove scheduled tasks for rule #" .. rule._id
	if (level ~= nil) then
		msg = msg .. " and level " .. tostring(level)
	end
	if (item ~= nil) then
		msg = msg .. " and item \"" .. _getItemSummary(item) .. "\""
	end
	log(msg, "removeScheduledTask", 3)
	--local ruleScheduledTasks = {}
	for i = #_scheduledTasks, 1, -1 do
		if (_scheduledTasks[i].ruleId == rule._id) then
			if (((level == nil) or (_scheduledTasks[i].level == level))
				and ((item == nil) or (_scheduledTasks[i].item == item))
			) then
				if _isLogLevel(4) then
					log("Remove task #" .. tostring(i) .. "/" .. tostring(#_scheduledTasks) .. ": " .. _getTaskInfo(_scheduledTasks[i]), "removeScheduledTask", 4)
				end
				table.remove(_scheduledTasks, i)
			else
				--table.insert(ruleScheduledTasks, 1, _scheduledTasks[i])
			end
		end
	end
	updateRulesInfos(rule._id)
	_prepareNextWakeUp()
end

-- Do all scheduled tasks that have expired
local function _doScheduledTasks ()
	local current = os.time()
	if _isLogLevel(2) then
		log("Now is " .. os.date("%X", os.time()) .. " (" .. tostring(os.time()) .. ") - Do sheduled tasks", "doScheduledTasks", 2)
	end
	_purgeExpiredWakeUp()
	if (#_scheduledTasks > 0) then
		for i = #_scheduledTasks, 1, -1 do
			local scheduledTask = _scheduledTasks[i]
			if (scheduledTask.timeout <= current) then
				table.remove(_scheduledTasks, i)
				if _isLogLevel(4) then
					log("Timeout reached for task:\n" .. _getTaskInfo(scheduledTask), "doScheduledTasks", 4)
				end
				if (type(_G[scheduledTask.functionName]) == "function") then
					_G[scheduledTask.functionName](scheduledTask.item, scheduledTask.params, scheduledTask.level)
				end
			end
		end
		--_nextScheduledTimeout = -1
		if (table.getn(_scheduledTasks) > 0) then
			_prepareNextWakeUp()
		else
			log("There's no more sheduled task to do", "doScheduledTasks", 2)
			notifyTimelineUpdate()
		end
	else
		log("There's no sheduled task to do", "doScheduledTasks", 2)
		notifyTimelineUpdate()
	end
end

local function _getScheduledTasks (rule)
	local _rule = getRule(rule)
	if (_rule == nil) then
		return
	end
	local scheduledTasks = {}
	for _, scheduledTask in ipairs(_scheduledTasks) do
		if (scheduledTask.ruleId == rule._id) then
			table.insert(scheduledTasks, scheduledTask)
		end
	end
	return scheduledTasks
end

-- **************************************************
-- Params (rule condition, action condition)
-- **************************************************

local function _getIntervalInSeconds (interval, unit)
	local interval = tonumber(interval) or 0
	local unit = unit or "S"
	if (unit == "M") then
		interval = interval * 60
	elseif (unit == "H") then
		interval = interval * 3600
	end
	return interval
end

local _addParam = {}
setmetatable(_addParam, {
	__index = function(t, item, conditionParamName)
		log("SETTING WARNING - Param type '" .. tostring(conditionParamName) .. "' is unknown", "getParam")
		return function ()
		end
	end
})

	_addParam["property_auto_untrip"] = function (item, param)
		local autoUntripInterval = _getIntervalInSeconds(param.autoUntripInterval, param.unit)
		log(_getItemSummary(item) .. " - Add 'autoUntripInterval' : '" .. tostring(autoUntripInterval) .. "'", "addParams", 4)
		item["_autoUntripInterval"] = autoUntripInterval
	end

	_addParam["condition_param_since"] = function (item, param)
		local sinceInterval = _getIntervalInSeconds(param.sinceInterval, param.unit)
		log(_getItemSummary(item) .. " - Add 'sinceInterval' : '" .. tostring(sinceInterval) .. "'", "addParams", 4)
		item["_sinceInterval"] = sinceInterval
	end

	_addParam["condition_param_level"] = function (item, param)
		local level = tonumber(param.level)
		if ((level ~= nil) and (level >= 0)) then
			log(_getItemSummary(item) .. " - Add 'level' : '" .. tostring(level) .. "'", "addParams", 4)
			item["_level"] = level
		else
			log(_getItemSummary(item) .. " - Value '" .. tostring(level) .. "' is not authorized for param 'level'", "addParams", 1)
		end
	end

	_addParam["action_param_level"] = function (item, param)
		local level = tonumber(param.level)
		if ((level ~= nil) and (level >= 0)) then
			if (item["_levels"] == nil) then
				item["_levels"] = {}
			end
			log(_getItemSummary(item) .. " - Add '" .. tostring(level) .. "' to 'levels'", "addParams", 4)
			table.insert(item["_levels"], level)
		else
			log(_getItemSummary(item) .. " - Value '" .. tostring(level) .. "' is not authorized for param 'level'", "addParams", 1)
		end
	end

	_addParam["action_param_delay"] = function (item, param)
		local delayInterval = _getIntervalInSeconds(param.delayInterval, param.unit)
		log(_getItemSummary(item) .. " - Add 'delayInterval' : '" .. tostring(delayInterval) .. "'", "addParams", 4)
		item["_delayInterval"] = delayInterval
	end

local function _addParams (item, params)
	if (type(params) == "table") then
		if (params.type ~= nil) then
			-- Single param
			_addParam[params.type](item, params)
		else
			-- Group of params
			for i, param in ipairs(params) do
				_addParams (item, param)
				params[i] = nil
			end
		end
	end
end

-- **************************************************
-- Rule properties
-- **************************************************

local function _initProperties (ruleId, properties)
	local result = {}
	if ((properties == nil) or (type(properties) ~= "table")) then
		properties = {}
	end
	if (properties.type ~= nil) then
		-- Single property
		properties = { properties }
	end
	for i, property in ipairs(properties) do
		if (property.type == nil) then
			-- Group of properties
			table.extend(result, _initProperties(ruleId, property))
		else
			local propertyName = property.type
			property.type = nil
			result[propertyName] = property
			log("Rule #" .. ruleId .. " - Add property '" .. tostring(propertyName) .. "': " .. tostring(json.encode(property)), "initProperties", 2)
		end
	end
	return result
end

-- **************************************************
-- Condition (rule condition, action condition)
-- **************************************************

-- Modification du statut de la condition
local function _setConditionStatus (condition, status)
	local msg = _getItemSummary(condition)
	local hasConditionStatusChanged = false
	if (((condition._status == nil) or (condition._status == "0")) and (status == "1")) then
		-- The condition has just been activated
		log(msg .. " is now active", "setConditionStatus", 3)
		condition._status = "1"
		condition._lastStatusUpdateTime = os.time()
		hasConditionStatusChanged = true
	elseif ((condition._status == "1") and (status == "0")) then
		-- The condition has just been deactivated
		log(msg .. " is now inactive", "setConditionStatus", 3)
		condition._status = "0"
		condition._lastStatusUpdateTime = os.time()
		hasConditionStatusChanged = true
	elseif (condition._status == "1") then
		-- The condition is still active
		log(msg .. " is still active (do nothing)", "setConditionStatus", 3)
	elseif (condition._status == "0") then
		-- The condition is still inactive
		log(msg .. " is still inactive (do nothing)", "setConditionStatus", 3)
	else
		condition._status = "0"
		log(msg .. " is inactive", "setConditionStatus", 3)
	end
	return hasConditionStatusChanged
end

local ConditionTypes = {
	_index = {
		["armed"]       = { type = "condition_value", service = SID.SecuritySensor,    variable = "Armed" },
		["tripped"]     = { type = "condition_value", service = SID.SecuritySensor,    variable = "Tripped" },
		["status"]      = { type = "condition_value", service = SID.SwitchPower,       variable = "Status" },
		["watts"]       = { type = "condition_value", service = SID.EnergyMetering,    variable = "Watts" },
		["temperature"] = { type = "condition_value", service = SID.TemperatureSensor, variable = "CurrentTemperature" }
	}
}

local function _getConditionEquivalentParams (conditionTypeName)
		if (conditionTypeName == nil) then
			return nil
		end
		local rootTypeName, operator = string.match(conditionTypeName, "^([^%+%-<>]-)_*([%+%-<>]*)$") -- "something+", "something-" or "something<>"
		local valueClass
		if (string.find(rootTypeName, "_") ~= nil) then
			rootTypeName, valueClass = string.match(rootTypeName, "^(.-)_?([^_]*)$") -- "something_on" or "something_off"
		end
		local equivalentParams
		if (ConditionTypes._index[rootTypeName] ~= nil) then
			equivalentParams = ConditionTypes._index[rootTypeName]
		--elseif (ConditionTypes[rootTypeName] ~= nil) then
		--	equivalentParams = { type = rootTypeName }
		end
		if (equivalentParams ~= nil) then
			equivalentParams.operator = operator
			if (valueClass == "on") then
				equivalentParams.value = "1"
			elseif (valueClass == "off") then
				equivalentParams.value = "0"
			end
		end
		return equivalentParams
	end

local function initParams (condition)
		local equivalentParams = _getConditionEquivalentParams(condition.type)
		if (equivalentParams ~= nil) then
			for paramName, paramValue in pairs(equivalentParams) do
				if (condition[paramName] == nil) then
					condition[paramName] = paramValue
				end
			end
			condition.type = equivalentParams.type
		end
		if (condition.operator == "+") then
			condition.operator = ">="
		elseif (condition.operator == "-") then
			condition.operator = "<="
		elseif ((condition.operator == nil) or (condition.operator == "")) then
			condition.operator = "=="
		end
	end

setmetatable(ConditionTypes, {
	__index = function(t, conditionTypeName)
		local equivalentTypeName = "unknown"
		local equivalentParams = _getConditionEquivalentParams(conditionTypeName)
		if (equivalentParams == nil) then
			log("SETTING WARNING - Condition type '" .. tostring(conditionTypeName) .. "' is unknown", "ConditionTypes.get")
		else
			equivalentTypeName = equivalentParams.type
		end
		return ConditionTypes[equivalentTypeName]
	end
})

	-- Unknown Condition type
	ConditionTypes["unknown"] = {
		init = function (condition)
			log(
				"SETTING WARNING - " .. _getItemSummary(condition) ..
				" - Condition type '" .. tostring(condition.type) .. "' is unknown",
				"ConditionUnknown.init"
			)
		end,
		check = function (condition)
			log(
				"SETTING WARNING - " .. _getItemSummary(condition) ..
				" - Condition type '" .. tostring(condition.type) .. "' is unknown",
				"ConditionUnknown.check"
			)
		end,
		start = function (condition)
			log(
				"SETTING WARNING - " .. _getItemSummary(condition) ..
				" - Condition type '" .. tostring(condition.type) .. "' is unknown",
				"ConditionUnknown.start"
			)
		end,
		updateStatus = function (condition)
			log(
				"SETTING WARNING - " .. _getItemSummary(condition) ..
				" - Condition type '" .. tostring(condition.type) .. "' is unknown",
				"ConditionUnknown.updateStatus"
			)
		end
	}

	-- Condition of type 'value'
	ConditionTypes["condition_value"] = {
		init = function (condition)
			-- Device (Name is preferred to id)
			condition.deviceId = tonumber(condition.deviceId)
			--[[
			-- TODO : stocker le nom du device
			if (condition.deviceId ~= nil) then
				local deviceId = tonumber(_getDeviceIdByName(condition.device))
				if ((deviceId ~= nil) and (condition.deviceId ~= deviceId)) then
					log(_getItemSummary(condition) .. " - device #" .. tostring(condition.deviceId) .. "(" .. condition.device .. ") has changed of id: #" .. tostring(deviceId), "ConditionValue.init", 1)
					condition.deviceId = deviceId
				end
			else
				condition.deviceId = tonumber(_getDeviceIdByName(condition.device))
			end
			--]]
			if ((condition.device == nil) and (condition.deviceId ~= nil)) then
				local luDevice = luup.devices[condition.deviceId]
				if (luDevice ~= nil) then
					condition.device = luup.devices[condition.deviceId].description
				else
					addRuleError(condition._ruleId, "Init condition", _getItemSummary(condition) .. " - Device #" .. tostring(condition.deviceId) .. " is unknown")
					condition.deviceId = nil
				end
			end
			-- Implicit params from type
			initParams(condition)
			-- Context
			condition._context.deviceId = lul_device
			--condition._context.params = condition.params or {}
			-- Main type
			if (condition.action ~= nil) then
				condition._mainType = "External"
			else
				condition._mainType = "Trigger"
			end
		end,

		check = function (condition)
			--if not _checkParameters(condition, {{"device", "deviceId"}, "service", "variable", "value"}) then
			if not _checkParameters(condition, {"deviceId", "service", "variable"}) then
				return false
			end
			return true
		end,

		start = function (condition)
			local msg = _getItemSummary(condition)
			-- Mise à jour des index condition par évènement
			if (condition.action == nil) then
				_registerConditionForEvent(condition.service .. "-" .. condition.variable .. "-" .. tostring(condition.deviceId), condition)
				if not _isEventWatched(condition.service .. "-" .. condition.variable) then
					log(msg .. " - Watch device #" .. tostring(condition.deviceId) .. "(" .. condition.device .. ")", "ConditionValue.start", 3)
					luup.variable_watch("RulesEngine.onDeviceVariableIsUpdated", condition.service, condition.variable, nil)
					_setEventIsWatched(condition.service .. "-" .. condition.variable)
				else
					log(msg .. " - Watch device #" .. tostring(condition.deviceId) .. "(" .. condition.device .. ") (watch already registered)", "ConditionValue.start", 3)
				end
			else
				log(msg .. " - Can not watch external condition", "ConditionValue.start", 3)
			end
		end,

		updateStatus = function (condition)
			local msg = _getItemSummary(condition)
			local context = condition._context
			local deviceId = currentDeviceId or condition.deviceId
			local hasToUpdateRuleStatus = false

			-- Condition of type 'value' / 'value-' / 'value+' / 'value<>'
			msg = msg .. " for device #" .. tostring(deviceId) .. "(" .. tostring(condition.device) .. ")" .. " - '" .. tostring(condition.service)
			if (condition.action ~= nil) then
				msg = msg .. "-" .. condition.action
			end
			msg = msg .. "-" ..  condition.variable .. "'"

			-- Update known value (if needed)
			if (condition._mainType == "Trigger") then
				if (context.lastUpdateTime == nil) then
					-- The value has not yet been updated
					msg = msg .. " (value retrieved)"
					context.value, context.lastUpdateTime = luup.variable_get(condition.service, condition.variable, deviceId)
--print(os.time(), context.lastUpdateTime)
				end
			else
				-- Update value if too old (not automatically updated because not a trigger)
				if (os.difftime(os.time(), (context.lastUpdateTime or 0)) > 0) then
					msg = msg .. " (value retrieved)"
					if (condition.action == nil) then
						context.value, context.lastUpdateTime = luup.variable_get(condition.service, condition.variable, deviceId)
					else
						local resultCode, resultString, job, returnArguments = luup.call_action(condition.service, condition.action, condition.arguments, deviceId)
						context.value = returnArguments[ condition.variable ]
						context.lastUpdateTime = os.time()
					end
				end
			end

			-- Status update
			local status = "1"
			local OPERATORS = {
				EQ = "==",
				NEQ = "<>",
				LT = "<",
				LTE = "<=",
				GT = ">",
				GTE = ">=",
				LIKE = "like",
				NOTLIKE = "not like"
			}
			if (condition.value ~= nil) then
				-- a threshold or a pattern is defined
				local conditionValue = tonumber(condition.value)
				if (conditionValue == nil) then
					conditionValue = condition.value
				end
				local contextValue = tonumber(context.value)
				if (contextValue == nil) then
					contextValue = context.value
				end
				if ((context.value == nil)
					or (OPERATORS[condition.operator] == nil)
					or ((condition.operator == "EQ") and (contextValue ~= conditionValue))
					or (((condition.operator == "LT") or (condition.operator == "LTE")) and (contextValue > conditionValue))
					or (((condition.operator == "GT") or (condition.operator == "GTE")) and (contextValue < conditionValue))
					or (((condition.operator == "NEQ") or (condition.operator == "LT") or (condition.operator == "GT")) and (contextValue == conditionValue))
					or ((condition.operator == "LIKE") and (string.match(context.value, condition.value) == nil))
					or ((condition.operator == "NOTLIKE") and (string.match(context.value, condition.value) ~= nil))
				) then
					-- Threshold is not respected
					msg = msg .. " - Does not respect the condition '{value:" .. tostring(context.value) .. "} " .. OPERATORS[condition.operator] .. " " .. tostring(condition.value) .. "'"
					status = "0"
				else
					msg = msg .. " - Respects the condition '{value:" .. tostring(context.value) .. "} " .. OPERATORS[condition.operator] .. " " .. tostring(condition.value) .. "'"
				end
			else
				-- No specific value condition on that condition
				msg = msg .. " - The condition has no value condition"
			end

			-- Check since interval if exists
			if (condition._sinceInterval ~= nil) then
				-- Remove scheduled actions for this condition
				log(_getItemSummary(condition) .. " has a 'since' condition : remove its former schedule if exists", "ConditionValue.updateStatus", 4)
				_removeScheduledTasks(getRule(condition._ruleId), nil, condition)
				if (status == "1") then
					local currentInterval = os.difftime(os.time(), (context.lastUpdateTime or os.time()))
					if (currentInterval < tonumber(condition._sinceInterval)) then
						status = "0"
						-- Have to check later again the status of the condition
						local remainingSeconds = tonumber(condition._sinceInterval) - currentInterval
						msg = msg .. " but not since " .. tostring(condition._sinceInterval) .. " seconds - Check condition status in " .. tostring(remainingSeconds) .. " seconds"
						_addScheduledTask(getRule(condition._ruleId), "RulesEngine.updateConditionStatus", condition, nil, nil, remainingSeconds)
					else
						msg = msg .. " since " .. tostring(condition._sinceInterval) .. " seconds"
						hasToUpdateRuleStatus = true
					end
				end
			end

			log(msg, "ConditionValue.updateStatus", 3)

			local result = _setConditionStatus(condition, status)
			-- Update status of the linked rule if needed (asynchronously)
			if hasToUpdateRuleStatus then
				luup.call_delay("RulesEngine.updateRuleStatus", 0, condition._ruleId)
			end
			return result
		end

	}

	-- Condition of type 'rule'
	ConditionTypes["condition_rule"] = {
		init = function (condition)
			if (condition.type == "rule_on") then
				condition.type = "rule"
				condition.status = "1"
			elseif (condition.type == "rule_off") then
				condition.type = "rule"
				condition.status = "0"
			end
			condition._mainType = "Trigger"
		end,

		check = function (condition)
			if not _checkParameters(condition, {{"rule", "ruleId", "ruleName"}, "status"}) then
				return false
			else
				-- TODO : use ruleId in Blockly
				local ruleName = condition.rule or condition.ruleName
				if not getRule(ruleName) then
					error(_getItemSummary(condition) .. " - Rule '" .. ruleName .. "' is unknown", "ConditionRule.check")
					return false
				end
			end
			return true
		end,

		start = function (condition)
			-- Enregistrement de la surveillance du status de la règle
			log(_getItemSummary(condition) .. " - Watch status for rule '" .. condition.rule .. "'", "ConditionRule.start", 3)
			_registerConditionForEvent("RuleStatus-" .. condition.rule, condition)
		end,

		updateStatus = function (condition)
			local msg = _getItemSummary(condition)
			local context = condition._context
			local status = "1"
			if (tostring(context.status) ~= tostring(condition.status)) then
				msg = msg .. " - Does not respect the condition '{status:" .. tostring(context.status) .. "}==" ..tostring(condition.status) .. "'"
				status = "0"
			else
				msg = msg .. " - Respects the condition '{status:" .. tostring(context.status) .. "}==" ..tostring(condition.status) .. "'"
				status = "1"
			end
			log(msg, "ConditionRule.updateStatus", 3)

			return _setConditionStatus(condition, status)
		end
	}

	-- Condition of type 'time'
	-- See http://wiki.micasaverde.com/index.php/Luup_Lua_extensions#function:_call_timer
	-- TODO sunset sunrise
	ConditionTypes["condition_time"] = {
		init = function (condition)
			if (type(condition.daysOfWeek) == "string") then
				condition.timerType = 2
				condition.days = string.split(condition.daysOfWeek, ",")
			end
			if (type(condition.daysOfMonth) == "string") then
				condition.timerType = 3
				condition.days = string.split(condition.daysOfMonth, ",")
			end
			if ((condition.daysOfWeek == nil) and (condition.daysOfMonth == nil)) then
				condition.timerType = 2
				condition.days = {"1","2","3","4","5","6","7"}
			end
			condition._mainType = "Trigger"
		end,

		check = function (condition)
			if not _checkParameters(condition, {{"time", "time1", "time2"}, "timerType", "days"}) then
				return false
			end
			return true
		end,

		start = function (condition)
			local msg = _getItemSummary(condition)

			local times
			if (condition.time ~= nil) then
				times = { condition.time }
			else
				times = { condition.time1, condition.time2 }
			end

			for _, day in ipairs(condition.days) do
				for _, time in ipairs(times) do
					local eventName = "timer-" .. tostring(condition.timerType) .. "-" .. tostring(day) .. "-" .. tostring(time)
					_registerConditionForEvent(eventName, condition)
					if not _isEventWatched(eventName) then
						log(msg .. " - Starts timer '" .. eventName .. "'", "ConditionTime.start", 3)
						luup.call_timer("RulesEngine.onTimerIsTriggered", condition.timerType, time, day, eventName)
						_setEventIsWatched(eventName)
					else
						log(msg .. " - Timer '" .. eventName .. "' is already started", "ConditionTime.start", 3)
					end
				end
			end
		end,

		updateStatus = function (condition)
			local msg = _getItemSummary(condition)
			local status = "1"
			local hasToTriggerOff = false

			function getDayOfWeek (time)
				local day = os.date('%w', time)
				if (day == "0") then
					day = "7"
				end
				return day
			end
			function getDayOfMonth (time)
				return tostring(tonumber(os.date('%d', time)))
			end

			local now = os.time()
			local currentDay, previousDay, typeOfDay
			if (condition.timerType == 2) then
				typeOfDay = "week"
				currentDay = getDayOfWeek(now)
				previousDay = getDayOfWeek(now - 86400)
			else
				typeOfDay = "month"
				currentDay = getDayOfMonth(now)
				previousDay = getDayOfMonth(now - 86400)
			end

			if (condition.time == nil) then
				-- Between
				local currentTime = os.date('%H:%M:%S', os.time() + 1) -- add 1 second to pass the edge
				if (condition.time1 <= condition.time2) then
					-- The bounds are on the same day
					if not table.contains(condition.days, currentDay) then
						msg = msg .. " - Current day of " .. typeOfDay .. " '" .. tostring(currentDay) .. "' is not in " .. tostring(json.encode(condition.days))
						status = "0"
					elseif ((currentTime < condition.time1) or (currentTime > condition.time2)) then
						msg = msg .. " - Current time '" .. tostring(currentTime) .. "' is not between '" .. tostring(condition.time1) .. "' and '" .. tostring(condition.time2) .. "'"
						status = "0"
					end
				else
					-- The bounds are on 2 days
					if table.contains(condition.days, currentDay) then
						-- D
						if (currentTime < condition.time1) then
							msg = msg .. " - Current time '" .. tostring(currentTime) .. "' is not between '" .. tostring(condition.time1) .. "' and '" .. tostring(condition.time2) .. "'"
							status = "0"
						end
					elseif table.contains(condition.days, previousDay) then
						-- D+1
						if (currentTime < condition.time2) then
							msg = msg .. " - Current time '" .. tostring(currentTime) .. "' is not between '" .. tostring(condition.time1) .. "' and '" .. tostring(condition.time2) .. "' (D+1)"
							status = "0"
						else
							msg = msg .. " - Current time '" .. tostring(currentTime) .. "' is between '" .. tostring(condition.time1) .. "' and '" .. tostring(condition.time2) .. "' (D+1)"
						end
					else
						msg = msg .. " - Current day of " .. typeOfDay .. " '" .. tostring(currentDay) .. "' is not in " .. tostring(json.encode(condition.days))
						status = "0"
					end
				end
			else
				hasToTriggerOff = true
				local currentTime = os.date('%H:%M:%S', os.time())
				if not table.contains(condition.days, currentDay) then
					msg = msg .. " - Current day of " .. typeOfDay .. " '" .. tostring(currentDay) .. "' is not in " .. tostring(json.encode(condition.days))
					status = "0"
				elseif (currentTime ~= condition.time) then
					msg = msg .. " - Current time '" .. tostring(currentTime) .. "' is not equal to '" .. tostring(condition.time) .. "'"
					status = "0"
				end
			end

			log(msg, "ConditionTime.updateStatus", 3)

			if _setConditionStatus(condition, status) then
				luup.call_delay("RulesEngine.updateRuleStatus", 0, condition._ruleId)
			end

			-- TODO temps de remise à zéro (comme détecteur mouvement)
			if (hasToTriggerOff and (status == "1")) then
				if _setConditionStatus(condition, "0") then
					luup.call_delay("RulesEngine.updateRuleStatus", 0, condition._ruleId)
				end
			end

			return true
		end
	}

-- Mise à jour du statut de la condition
local function _updateConditionStatus (condition)
	return ConditionTypes[condition.type].updateStatus(condition)
end

-- **************************************************
-- Conditions
-- **************************************************

local function _initConditions (ruleId, conditions, parentId)
	if ((conditions == nil) or (type(conditions) ~= "table")) then
		conditions = {}
	end
	if (conditions.type == "list_with_operator_condition") then
		-- Group of conditions
		conditions.items = _initConditions(ruleId, conditions.items, parentId)
	else
		if ((conditions.type ~= nil) and (string.match(conditions.type, "condition_.*") ~= nil)) then
			-- Single condition
			conditions = { conditions }
		end
		local idx = 1
		local id
		for i, condition in ipairs(conditions) do
			if (type(condition) == "table") then
				if (parentId == nil) then
					id = tostring(idx)
				else
					id = parentId .. "." .. tostring(idx)
				end
				if (condition.type == "list_with_operator_condition") then
					-- Group of conditions
					conditions[i].items = _initConditions(ruleId, condition.items, id)
				else
					condition._mainType = "Condition"
					condition._id = id
					condition._ruleId = ruleId
					condition._status = nil
					condition._lastStatusUpdateTime = nil
					--condition._level = 0
					condition.type = condition.type or ""
					-- Params
					_addParams(condition, condition.params)
					condition.params = nil
					-- Context
					condition._context = {
						--lastUpdateTime = 0
					}
					-- Specific initialisation for this type of condition
					ConditionTypes[condition.type].init(condition)
				end
				idx = idx + 1
			else
				-- pb
			end
		end
	end
	return conditions
end

local function _checkConditionsSettings (conditions)
	local isOk = true
	--if ((type(conditions.type) == "string") and (string.match(conditions.type, "condition_group") ~= nil)) then
	if (conditions.type == "list_with_operator_condition") then
		if not _checkConditionsSettings(conditions.items) then
			isOk = false
		end
	else
		for i, condition in ipairs(conditions) do
			if (type(condition) == "table") then
				--if (string.match(condition.type, "condition_group") ~= nil) then
				if (condition.type == "list_with_operator_condition") then
					-- Group of conditions
					if not _checkConditionsSettings(condition.items) then
						isOk = false
					end
				else
					if not _checkParameters(condition, {"type"}) then
						isOk = false
					elseif not ConditionTypes[condition.type].check(condition) then
						isOk = false
					elseif ((type(condition.items) == "table") and not _checkConditionsSettings(condition.items)) then
						-- Specific conditions
						isOk = false
					end
				end
			else
				-- pb
			end
		end
	end
	return isOk
end

local function _startConditions (conditions)
	--if ((type(conditions.type) == "string") and (string.match(conditions.type, "condition_group") ~= nil)) then
	if (conditions.type == "list_with_operator_condition") then
		_startConditions(conditions.items)
	else
		for i, condition in ipairs(conditions) do
			if (type(condition) == "table") then
				if (condition.type == "list_with_operator_condition") then
					-- Group of conditions
					_startConditions(condition.items)
				else
					ConditionTypes[condition.type].start(condition)
				end
			end
		end
	end
end

local function _getConditionsStatus (conditions, operator)
	local status, conditionStatus = nil, nil
	local level, conditionLevel = 0, 0
	local operator = operator or "OR"
	if (conditions.type == "list_with_operator_condition") then
		-- Group of conditions
		status, level = _getConditionsStatus(conditions.items, conditions.operator)
	elseif (#conditions > 0) then
		for i, condition in ipairs(conditions) do
			if (type(condition) == "table") then
				if (condition.type == "list_with_operator_condition") then
					-- Group of conditions
					conditionStatus, conditionLevel = _getConditionsStatus(condition.items, condition.operator)
				else
					-- Single condition
					if ((condition._status == nil) or (condition._mainType ~= "Trigger")) then
						_updateConditionStatus(condition)
					end
					conditionStatus     = condition._status
					conditionLevel      = condition._level or 0
				end
				-- Update status
				if (status == nil) then
					if (conditions[i + 1] == nil) then
						status = conditionStatus
					elseif (operator == "OR") then
						if (conditionStatus == "1") then
							status = "1"
						end
					elseif (operator == "AND") then
						if (conditionStatus == "0") then
							status = "0"
						end
					end
				end
				-- Update level
				if ((conditionStatus == "1") and (conditionLevel > level)) then
					level = conditionLevel
				end
			end
		end
	end
	if (status == nil) then
		status = "0"
	end
	return status, level
end

-- **************************************************
-- RulesEngine actions
-- **************************************************

local _actions = {}
-- TODO : par défaut

-- Add an action
function addActionType (actionType, actionFunction)
	if (_actions[actionType] ~= nil) then
		error("Action of type '" .. actionType ..  "' is already defined", "addActionType")
	end
	_actions[actionType] = actionFunction
end

-- **************************************************
-- History
-- **************************************************

local _history = {}

local function _addToHistory (timestamp, eventType, event)
	-- TODO : à améliorer (sauvegarder)
	log("Add entry : " .. tostring(timestamp) .. " - " .. tostring(eventType) .. " - " .. tostring(event), "addToHistory", 2)
	table.insert(_history, {
		timestamp = timestamp,
		eventType = eventType,
		event = event
	})
	notifyTimelineUpdate()
end

function notifyTimelineUpdate ()
	if (_pluginParams.deviceId == nil) then
		return false
	end
	luup.variable_set(SID.RulesEngine, "LastUpdate", os.time(), _pluginParams.deviceId)
end

-- **************************************************
-- Callbacks on event
-- **************************************************

-- Callback on device variable update (mios call)
local function _onDeviceVariableIsUpdated (lul_device, lul_service, lul_variable, lul_value_old, lul_value_new)
	local eventName = lul_service .. "-" .. lul_variable .. "-" .. tostring(lul_device)
	log("Event '" .. eventName .. "'(" .. luup.devices[lul_device].description .. ") - New value:'" .. tostring(lul_value_new) .. "'", "onDeviceVariableIsUpdated")
	local linkedConditionsByRule = _getConditionsForEvent(eventName)
	if (linkedConditionsByRule == nil) then
		return false
	end
	for ruleId, linkedConditions in pairs(linkedConditionsByRule) do
		-- Update status of the linked conditions for this rule
		local hasAtLeastOneConditionStatusChanged = false
		local context = {
			value = lul_value_new,
			lastUpdateTime = os.time()
		}
		for _, condition in ipairs(linkedConditions) do
			log("This event is linked to rule #" .. condition._ruleId .. " and condition #" .. condition._id, "onDeviceVariableIsUpdated", 2)
			-- Update the context of the condition
			table.extend(condition._context, context)
			-- Update the status of the condition
			if _updateConditionStatus(condition) then
				hasAtLeastOneConditionStatusChanged = true
			end
		end
		-- Update the context of the rule
		updateRuleContext(ruleId, context)
		-- Update status of the linked rule (asynchronously)
		if hasAtLeastOneConditionStatusChanged then
			log("Update rule status", "onDeviceVariableIsUpdated", 4)
			luup.call_delay("RulesEngine.updateRuleStatus", 0, ruleId)
		end
	end
end

-- Callback on timer triggered (mios call)
local function _onTimerIsTriggered (data)
	log("Event '" .. tostring(data) .. "'", "onTimerIsTriggered")
	local linkedConditionsByRule = _getConditionsForEvent(data)
	if (linkedConditionsByRule == nil) then
		return false
	end
	for ruleId, linkedConditions in pairs(linkedConditionsByRule) do
		-- Update status of the linked conditions for this rule
		for _, condition in ipairs(linkedConditions) do
			log("This event is linked to rule #" .. condition._ruleId .. " and condition #" .. condition._id, "onTimerIsTriggered", 2)
			-- Update the context of the condition
			--condition._status = "1"
			--condition._context.status     = "1"
			--condition._context.lastUpdate = os.time()
			-- Update the status of the condition
			_updateConditionStatus(condition)

			--[[
			updateRuleStatus(rule)
			if (rule._status == "1") then
				-- TODO : attention à between
				condition._status = "0"
				updateRuleStatus(rule)
			end
			--]]
		end
		-- Update status of the linked rule (asynchronously)
		luup.call_delay("RulesEngine.updateRuleStatus", 0, ruleId)
	end
end

-- Callback on rule status update (inside call)
local function _onRuleStatusIsUpdated (watchedRuleName, newStatus)
	local eventName = "RuleStatus-" .. watchedRuleName
	log("Event '" .. eventName .. "' - New status:'" .. tostring(newStatus) .. "'", "onRuleStatusIsUpdated")
	local linkedConditionsByRule = _getConditionsForEvent(eventName)
	if (linkedConditionsByRule == nil) then
		return false
	end
	for ruleId, linkedConditions in pairs(linkedConditionsByRule) do
		-- Update status of the linked conditions for this rule
		for _, condition in ipairs(linkedConditions) do
			log("This event is linked to rule #" .. ruleId .. " and condition #" .. condition._id, "onRuleStatusIsUpdated")
			-- Update the context of the condition
			condition._context.status = newStatus
			condition._context.lastUpdateTime = os.time()
			-- Update the status of the condition
			_updateConditionStatus(condition)
		end
		-- Update status of the linked rule (asynchronously)
		luup.call_delay("RulesEngine.updateRuleStatus", 0, ruleId)
	end
end

-- **************************************************
-- Rule actions
-- **************************************************

local function _initRuleActions (ruleId, actions)
	if (actions == nil) then
		actions = {}
	end
	for i, action in ipairs(actions) do
		action._id = tostring(i)
		action._mainType = "GroupAction"
		action.type = nil
		action._ruleId = ruleId
		action._context = {lastUpdateTime = 0}
		action._levels = {}
		-- Params
		_addParams(action, action.params)
		action.params = nil
		-- Actions to do
		if (type(action["do"]) ~= "table") then
			action["do"] = {}
		end
		for j, actionToDo in ipairs(action["do"]) do
			actionToDo._id = tostring(i) .. "." .. tostring(j)
			actionToDo._mainType = "Action"
			actionToDo._ruleId = ruleId
			if (type(actionToDo.functionContent) == "string") then
				-- Action of type Function
				local chunk, strError = loadstring("return function(context, RulesEngine) \n" .. actionToDo.functionContent .. "\nend")
				if (chunk == nil) then
					addRuleError(ruleId, "Init rule actions", "Error in functionContent: " .. tostring(strError))
				else
					-- Put the chunk in the plugin environment
					setfenv(chunk, getfenv(1))
					actionToDo.callback = chunk()
					actionToDo._type = "function"
					actionToDo.functionContent = nil
				end
			else
				_initMultiValueKey(actionToDo, "types", "type")
				_initMultiValueKey(actionToDo, "devices", "device")
				--actionToDo._type = table.concat(actionToDo.types, ",")
			end
		end
		-- Action conditions
		action.conditions = _initConditions(ruleId .. "-Action#" .. tostring(i), action.conditions)
	end
	return actions
end

local function _checkRuleActionsSettings (actions)
	local isOk = true
	for i, action in ipairs(actions) do
		for _, actionToDo in ipairs(action["do"]) do
			if not _checkParameters(actionToDo, {{"types", "callback"}}) then
				isOk = false
			elseif ((actionToDo.types ~= nil) and table.contains(actionToDo.types, "action") and not _checkParameters(actionToDo, {"devices", "service", "action", "arguments"})) then
				isOk = false
			end
		end
		if not _checkConditionsSettings(action.conditions) then
			isOk = false
		end
	end
	return isOk
end

local function _getRuleActionDelay (rule, action, isRecurrent)
	local delay = nil

	local delayInterval
	if (not isRecurrent) then
		-- Get first delay
		if (type(action._delayInterval) == "function") then
			delayInterval = tonumber(action._delayInterval()) or 0
		else
			delayInterval = tonumber(action._delayInterval) or 0
		end
		if ((delayInterval == 0) and (action.event == "reminder")) then
			isRecurrent = true
		end
	end

	if (not isRecurrent) then
		-- Adjust delay according to elapsed time
		--local elapsedTime = os.difftime(os.time(), rule._lastStatusUpdateTime)
		-- test
		--local elapsedTime = os.difftime(os.time(), math.max(rule._lastStatusUpdateTime, rule._lastLevelUpdateTime or 0))
		--local elapsedTime = os.difftime(os.time(), math.max(rule._lastStatusUpdateTime, rule._lastLevelUpdateTime or 0))
		local elapsedTime = os.difftime(os.time(), math.max(rule._lastStatusUpdateTime, rule._lastLevelUpdateTime or 0))
		if (elapsedTime == 0) then
			delay = delayInterval
			log("Delay interval: " .. tostring(delay), "getRuleActionDelay", 4)
		elseif (delayInterval >= elapsedTime) then
			delay = delayInterval - elapsedTime
			if _isLogLevel(4) then
				log(
					"Adjusted delay interval: " .. tostring(delay) ..
					" - Initial interval " .. tostring(delayInterval) .. " >= elapsed time " .. tostring(elapsedTime) ..
					" since last change of rule status " .. string.format("%02d:%02d", math.floor(elapsedTime / 60), (elapsedTime % 60)),
					"getRuleActionDelay", 4
				)
			end
		elseif (elapsedTime - delayInterval < 10) then
			delay = 0
			log("Delay interval is zero" , "getRuleActionDelay", 4)
		else
			log("Delay interval " .. tostring(delayInterval) .. " < elapsed time " .. tostring(elapsedTime) .. " (problem)", "getRuleActionDelay", 4)
--print(rule._lastStatusUpdateTime)
--print(rule._lastLevelUpdateTime)
		end
	end

	if (isRecurrent) then
		-- Get recurrent delay
		local unit = action.unit or "S"
		delay = tonumber(action.recurrentInterval) or 0
		if (unit == "M") then
			delay = delay * 60
		elseif (unit == "H") then
			delay = delay * 3600
		end
		if (delay < _minRecurrentInterval) then
			-- Sécurité sur le temps minimal pour les actions récurentes
			log("Reminder recurrent interval is set to min interval " .. tostring(_minRecurrentInterval), "getRuleActionDelay", 2)
			delay = _minRecurrentInterval
		end
		log("Recurrent delay: " .. tostring(delay), "getRuleActionDelay", 3)
		--[[
		log("Reminder recurrent interval: " .. tostring(recurrentInterval), 4, "getDelay")
		log("DEBUG - (elapsedTime - delayInterval): " .. tostring((elapsedTime - delayInterval)), 4, "getDelay")
		log("DEBUG - ((elapsedTime - delayInterval) / recurrentInterval): " .. tostring(math.floor((elapsedTime - delayInterval) / recurrentInterval)), 4, "getDelay")
		log("DEBUG - ((elapsedTime - delayInterval) % recurrentInterval): " .. tostring(((elapsedTime - delayInterval) % recurrentInterval)), 4, "getDelay")
		delay = recurrentInterval - ((elapsedTime - delayInterval) % recurrentInterval)
		log("DEBUG - Delay interval: " .. tostring(delayInterval) .. " - recurrentInterval: " .. tostring(recurrentInterval) .. " - Ajusted delay: " .. tostring(delay), 4, "getDelay")
		--]]
	end

	log("DEBUG - Ajusted delay: " .. tostring(delay), "getRuleActionDelay", 3)
	return delay
end

local function _isRuleGroupActionMatchingLevel (groupAction, level)
	local msg = _getItemSummary(groupAction)
	if (level ~= nil) then
		if ((table.getn(groupAction._levels) == 0) or not table.contains(groupAction._levels, level)) then
			log(msg .. " - The requested level '" .. tostring(level) .. "' is not respected", "isRuleGroupActionMatchingLevel", 4)
			return false
		end
	else
		if ((table.getn(groupAction._levels) > 0) and not table.contains(groupAction._levels, 0)) then
			log(msg .. " - There's at least a level different from '0' and none was requested", "isRuleGroupActionMatchingLevel", 4)
			return false
		end
	end
	return true
end

-- Execute one action from a rule
local function _doRuleAction (action, params, level)
	if (action == nil) then
		-- TODO : msg
		return
	end
	local rule = getRule(action._ruleId)
	if (rule == nil) then
		-- TODO : msg
		return
	end
	local params = params or {}
	--local level = params.level

	-- Update context level
	rule._context.level = level or rule._level

	local message = "*   Rule #" .. rule._id .. "(" .. rule.name .. ") - Group of actions #" .. tostring(action._id) .. " for event '" .. tostring(action.event) .. "'"
	if (action.level ~= nil) then
		message = message .. "(level " .. json.encode(action._levels) .. ")"
	end

	-- Check if a hook prevents to do action
	if not doHook("beforeDoingAction", rule, action._id) then
		log(message .. " - A hook prevent from doing these actions", "doRuleAction", 3)
	-- Check if the rule is disarmed
	elseif (not rule._isArmed and (action.event ~= "end")) then
		log(message .. " - Don't do actions - Rule is disarmed and event is not 'end'", "doRuleAction")
	-- Check if the rule is acknowledged
	elseif (rule._isAcknowledged and (action.event == "reminder")) then
		log(message .. " - Don't do reminder actions - Rule is acknowledged", "doRuleAction")

	--[[
	-- TODO faire maj pour condition externe de la règle
	-- Check if the rule main conditions are still respected
	if not isMatchingAllConditions(rule.conditions, rule._context.deviceId) then
		log(message .. " - Don't do action - Rule conditions are not respected", "doRuleAction", 2)
		setRuleStatus(rule, "0")
		return false
	end
	--]]

	-- Check if the rule action conditions are still respected
	elseif ((table.getn(action.conditions) > 0) and (_getConditionsStatus(action.conditions) == "0")) then
		log(message .. " - Don't do anything - Rule is still active but action conditions are not respected", "doRuleAction", 3)
	-- Check if the level is respected
	elseif not _isRuleGroupActionMatchingLevel(action, level) then
		log(message .. " - Don't do anything - Level doesn't match the requested level " .. tostring(level), "doRuleAction", 3)
	else
		--log(message .. " - Do actions", "doRuleAction", 3)
		for _, actionToDo in ipairs(action["do"]) do
--print("actionToDo.type", actionToDo.type)
			if (actionToDo.callback ~= nil) then
				-- Action de type callback
				log(message .. " - Do action #" .. tostring(actionToDo._id) ..  " of type 'function'", "doRuleAction", 3)
				local ok, err
				if (type(actionToDo.callback) == "function") then
					ok, err = pcall(actionToDo.callback, rule._context)
				elseif ((type(actionToDo.callback) == "string") and (type(_G[actionToDo.callback]) == "function")) then
					ok, err = pcall(_G[actionToDo.callback], rule._context)
				else
					log(message .. " - Action #" .. tostring(actionToDo._id) .. " callback is unknown", "doRuleAction")
				end
				if not ok then
					addRuleError(ruleId, "Rule action", tostring(err))
					_addToHistory(os.time(), "RuleAction", "ERROR Rule action : " .. _getItemSummary(actionToDo) .. " - " .. tostring(err))
				else
					_addToHistory(os.time(), "RuleAction", "Do rule action : " .. _getItemSummary(actionToDo))
				end
				assert(ok, "ERROR: " .. tostring(err))
			elseif (actionToDo.types ~= nil) then
				for _, actionType in ipairs(actionToDo.types) do
					-- Action enregistrée
					if (_actions[actionType] == nil) then
						log(message .. " - Can not do action #" .. tostring(actionToDo._id) ..  " of type '" .. actionType .. "' - Unknown action type", "doRuleAction", 1)
					else
						log(message .. " - Do action #" .. tostring(actionToDo._id) ..  " of type '" .. actionType .. "'", "doRuleAction", 3)
						local ok, err = pcall(_actions[actionType], actionToDo, rule._context)
						if not ok then
							error(err, "doRuleAction")
						end
						assert(ok, "ERROR: " .. tostring(err))
					end
				end
			else
				log(message .. " - Don't know what to do !", "doRuleAction")
			end
		end
	end

	if (action.event == "reminder") then
		-- Relance de la surveillance du statut de la règle
		local delay = _getRuleActionDelay(rule, action, true)
		log(message .. " - Do recurrent action in " .. tostring(delay) .. " seconds", "doRuleAction", 2)
		_addScheduledTask(rule, "RulesEngine.doRuleAction", action, nil, level, delay)
	end

end

-- Do actions from a rule for an event and optionally a level
function doRuleActions (ruleId, event, level)
	local rule = getRule(ruleId)

	-- Check if rule is disarmed
	if (not rule._isArmed and (event ~= "end")) then
		log("Rule #" .. rule._id .. "(" .. rule.name .. ") is disarmed and event is not 'end' - Do nothing", "doRuleActions")
		return false
	end

	-- Announce what will be done
	if (level ~= nil) then
		log("*** Rule #" .. rule._id .. "(" .. rule.name .. ") - Do actions for event '" .. event .. "' with explicit level '" .. tostring(level) .. "'", "doRuleActions")
	--elseif (rule._level > 0) then
	--	log("*** Rule #" .. rule._id .. "(" .. rule.name .. ") - Do actions for event '" .. event .. "' matching rule level '" .. tostring(rule._level) .. "'", "doRuleActions")
	else
		log("*** Rule #" .. rule._id .. "(" .. rule.name .. ") - Do actions for event '" .. event .. "'", "doRuleActions")
	end

	-- Search actions of the rule, linked to the event
	local isAtLeastOneActionToDo = false
	for actionId, action in ipairs(rule.actions) do
		local msg = "**  " .. _getItemSummary(action)
		if (
			(event == nil) -- Pas d'évènement précis
			or (action.event == nil) -- Action valable pour tous les évènements
			or (action.event == event) -- Action valable pour l'évènement demandé
		) then
			--if not isMatchingAllConditions(action.conditions, rule._context.deviceId) then
				-- Les conditions particulières de l'action ne sont pas respectées
				--log(msg .. " - Don't do action - The action conditions are not respected", 2, "doRuleActions")
			if not _isRuleGroupActionMatchingLevel(action, level) then
				log(msg .. " - Don't do because level is not respected", "doRuleActions", 3)
			else
				local delay = _getRuleActionDelay(rule, action)
				if (delay == nil) then
					-- Le délai est dépassé (l'action a déjà été faite)
					log(msg .. " - Don't do because it already has been done", "doRuleActions", 3)
				else
					-- Exécution de l'action
					isAtLeastOneActionToDo = true
					if (delay > 0) then
						log(msg .. " - Do in " .. tostring(delay) .. " second(s)", "doRuleActions", 2)
					else
						log(msg .. " - Do immediately", "doRuleActions", 2)
					end
					-- Les appels se font tous en asynchrone pour éviter les blocages
					_addScheduledTask(rule, "RulesEngine.doRuleAction", action, nil, level, delay)
				end
			end
		end
	end
	if not isAtLeastOneActionToDo then
		local msg = "Rule #" .. rule._id .. "(" .. rule.name .. ") - No action to do for event '" .. event .. "'"
		if (level ~= nil) then
			msg = msg .. " and level '" .. tostring(level) .. "'"
		end
		log(msg, "doRuleActions", 2)
	end
end

-- **************************************************
-- Rule infos
-- **************************************************

local _rulesInfos = {}

local function _getRuleInfosIndex (rule)
	local index = -1
	for i, ruleInfos in ipairs(_rulesInfos) do
		if ((ruleInfos.id == rule._id) and (ruleInfos.idx == rule._idx)) then
			if (index == -1) then
				index = i
			else
				-- there are several rules with the same id
				index = -1
				break
			end
		end
	end
	return index
end

local function _removeRuleInfos (rule)
	local idx = _getRuleInfosIndex(rule)
	if (idx > -1) then
		log("Rule #" .. rule._id .. " - Infos are removed from position " .. tostring(idx), "removeRuleInfos")
		table.remove(_rulesInfos, idx)
	else
		log("Rule #" .. rule._id .. " - Can not find position of informations", "removeRuleInfos")
	end
end

local function _getFormerRuleInfos (ruleId)
	local formerRuleInfos
	for i, ruleInfos in ipairs(_pluginParams.rulesInfos) do
		if (ruleInfos.id == ruleId) then
			if (formerRuleInfos == nil) then 
				formerRuleInfos = ruleInfos
			else
				formerRuleInfos = nil
				break
			end
		end
	end
	return formerRuleInfos
end

local function _getRuleInfos (rule)
	local idx = _getRuleInfosIndex(rule)
	if (idx > -1) then
		return _rulesInfos[idx]
	end
	return nil
end

local function _initRuleInfos (rule)
	local ruleInfos = _getRuleInfos(rule)
	if (ruleInfos == nil) then
		ruleInfos = {}
		table.insert(_rulesInfos, ruleInfos)
		log("Rule #" .. rule._id .. " - Infos are added at position " .. tostring(#_rulesInfos), "initRuleInfos")
	end
	ruleInfos.id      = rule._id
	ruleInfos.idx     = rule._idx
	ruleInfos.status  = "-1"
	ruleInfos.errors = {}

	return ruleInfos
end

function addRuleError (ruleId, event, message)
	if (ruleId == nil) then
		return
	end
	local rule = getRule(ruleId)
	if (rule == nil) then
		return
	end
	local ruleInfos = _getRuleInfos(rule)
	if (ruleInfos == nil) then
		error("Can not find informations for rule #" .. rule._id, "addRuleError")
		return
	end
	error(tostring(event) .. ": " .. tostring(message), "addRuleError")
	table.insert(ruleInfos.errors, {
		timestamp = os.time(),
		event = event,
		message = message
	})
end

function updateRulesInfos (ruleId)
	if (ruleId == nil) then
		return
	end
	local rule = getRule(ruleId)
	local ruleInfos = _getRuleInfos(rule)
	if ((rule == nil) or (ruleInfos == nil)) then
		return
	end
	table.extend(ruleInfos, {
		status           = rule._status,
		lastStatusUpdate = rule._lastStatusUpdateTime,
		level            = rule._level,
		lastLevelUpdate  = rule._lastLevelUpdateTime,
		lastUpdate       = rule._lastUpdateTime,
		nextSchedule     = rule._nextScheduleTime,
		isArmed          = rule._isArmed,
		isAcknowledged   = rule._isAcknowledged,
		isStarted        = rule._isStarted
	})
end

function notifyRulesInfosUpdate ()
	if (_pluginParams.deviceId == nil) then
		return false
	end
	luup.variable_set(SID.RulesEngine, "RulesInfos", tostring(json.encode(_rulesInfos)), _pluginParams.deviceId)
end

-- **************************************************
-- Hooks
-- **************************************************

local _hooks = {}

-- Add a hook
function addHook (moduleName, event, callback)
	if (_hooks[event] == nil) then
		_hooks[event] = {}
	end
	log("Add hook for event '" .. event .. "'", "addHook")
	table.insert(_hooks[event], { moduleName, callback} )
end

-- Execute a hook for an event and a rule
function doHook (event, rule)
	if (_hooks[event] == nil) then
		return true
	end
	local nbHooks = table.getn(_hooks[event])
	if (nbHooks == 1) then
		log("Rule #" .. rule._id .. " - Event '" .. event .. "' - There is 1 hook to do", "doHook", 2)
	elseif (nbHooks > 1) then
		log("Rule #" .. rule._id .. " - Event '" .. event .. "' - There are " .. tostring(nbHooks) .. " hooks to do" , "doHook", 2)
	end
	local isHookOK = true
	for _, hook in ipairs(_hooks[event]) do
		local callback
		if (type(hook[2]) == "function") then
			callback = hook[2]
		elseif ((type(hook[2]) == "string") and (type(_G[hook[2]]) == "function")) then
			callback = _G[hook[2]]
		end
		if (callback ~= nil) then
			local status, result = pcall(callback, rule)
			if not status then
				log("Rule #" .. rule._id .. " - Event '" .. event .. "' - ERROR: " .. tostring(result), "doHook", 1)
				addRuleError(rule, "Hook " .. event, tostring(result))
			elseif not result then
				isHookOK = false
			end
		end
	end
	return isHookOK
end

-- **************************************************
-- Rules
-- **************************************************

-- Rule initialisation
local function _initRule (rule)
	table.extend(rule, {
		_isArmed = true,
		_isStarted = false,
		_isAcknowledged = false,
		_isAcknowledgeable = false,
		_level = 0,
		_status = "-1",
		_lastUpdateTime = 0,
		_lastStatusUpdateTime = 0,
		_lastLevelUpdateTime = 0,
		_context = {
			name = rule.name,
			lastUpdateTime = 0,
			lastStatusUpdateTime = 0,
			lastLevelUpdateTime = 0
		},
		properties = _initProperties(rule._id, rule.properties),
		conditions = _initConditions(rule._id, rule.conditions),
		actions    = _initRuleActions(rule._id, rule.actions)
	})
end

local function _checkRuleSettings (rule)
	if (
		_checkConditionsSettings(rule.conditions)
		and _checkRuleActionsSettings(rule.actions)
	) then
		rule._areSettingsOk = true
		return true
	else
		--luup.task("Error in settings for rule #" .. rule._id .. "(" .. rule.name .. ") (see log)", 2, "RulesEngine", _taskId)
		rule._areSettingsOk = false
		return false
	end
end

-- Compute rule status according to conditions
local function _computeRuleStatus (rule)
	--[[
	if (not rule._isArmed) then
		return nil, nil
	end
	--]]
	local msg = "Rule #" .. rule._id
	log(msg .. " - Compute rule status", "computeRuleStatus", 3)
	local status, level = _getConditionsStatus(rule.conditions)
	log(msg .. " - Rule status:'" .. tostring(status) .. "' - Rule level: '" .. tostring(level) .. "'", "computeRuleStatus")
	return status, level
end

-- Start a rule
local function _startRule (rule)
	-- Initialisation du statut de la règle
	if (not rule._areSettingsOk) then
		log("Rule #" .. rule._id .. "(" .. rule.name .. ") - Can not start the rule - Settings are not correct", "startRule", 1)
		return
	end
	log("Rule #" .. rule._id .. "(" .. rule.name .. ") - Init rule status", "startRule", 2)

	-- Check if rule is acknowledgeable
	if (rule.properties["property_is_acknowledgeable"] ~= nil) then
		rule._isAcknowledgeable = (rule.properties["property_is_acknowledgeable"].isAcknowledgeable == "TRUE")
	end

	-- Get initial states
	local ruleInfos = _getFormerRuleInfos(rule._id)
	if (ruleInfos ~= nil) then
		local initialStates = {
			_isArmed              = ruleInfos.isArmed,
			_isAcknowledged       = (rule._isAcknowledgeable and ruleInfos.isAcknowledged),
			--_status               = (ruleInfos.status == "1") and "1" or "0", 
			_lastStatusUpdateTime = ruleInfos.lastStatusUpdate,
			_level                = ruleInfos.level,
			_lastLevelUpdateTime  = ruleInfos.lastLevelUpdate,
			_lastUpdateTime       = ruleInfos.lastUpdate
		}
		log("Rule #" .. rule._id .. " - Set initial states: " .. json.encode(initialStates), "startRule", 4)
		table.extend(rule, initialStates)
	end

	doHook("onRuleStatusInit", rule)
	if (rule._status ~= "-1") then
		-- Status of the has been initialized by a hook
		-- Update statuses of the conditions
		_computeRuleStatus(rule)
	else
		-- Calcul du statut de la règle car non initialisée par un hook
		rule._status, rule._level = _computeRuleStatus(rule)
	end
	if (rule._status == "1") then
		log("Rule #" .. rule._id .. "(" .. rule.name .. ") is active on start", "startRule", 2)
	else
		log("Rule #" .. rule._id .. "(" .. rule.name .. ") is not active on start", "startRule", 2)
	end
	updateRuleContext(rule)

	-- Start conditions
	_startConditions(rule.conditions)

	-- Exécution si possible des actions liées à l'activation
	-- Actions avec délai (non faites si redémarrage Luup) ou de rappel
	if (rule._status == "1") then
		if doHook("beforeDoingActionsOnRuleIsActivated", rule) then
			doRuleActions(rule, "start")
			doRuleActions(rule, "reminder")
			if (rule._level > 0) then
				doRuleActions(rule, "start", rule._level)
				doRuleActions(rule, "reminder", rule._level)
			end
		else
			log("Rule #" .. rule._id .. "(" .. rule.name .. ") is now active, but a hook prevents from doing actions", 1, "startRule")
		end
	end

	rule._isStarted = true

	-- Update rule infos
	updateRulesInfos(rule._id)

	-- Update rule status
	-- Start actions won't be done again if status is still activated (no change)
	_onRuleStatusIsUpdated(rule.name, rule._status)
end

-- Update rule context
function updateRuleContext (ruleId, context)
	local rule = getRule(ruleId)
	if (rule == nil) then
		return
	end
	log("Rule #" .. rule._id .. " - Update rule context", "updateRuleContext", 4)
	rule._context.lastStatusUpdateTime = rule._lastStatusUpdateTime
	rule._context.lastLevelUpdateTime  = rule._lastLevelUpdateTime
	rule._context.lastUpdateTime       = rule._lastUpdateTime
	if (context ~= nil) then
		table.extend(rule._context, context)
	end
	if (rule._context.lastUpdateTime > rule._lastUpdateTime) then
		rule._lastUpdateTime = rule._context.lastUpdateTime
	end
end

local function _getNextFreeRuleId ()
	_lastRuleId = _lastRuleId + 1
	return tostring(_lastRuleId)
end

-- Add a rule
function addRule (rule, keepFormerRuleWithSameId)
	if ((rule == nil) or (type(rule) ~= "table")) then
		return false
	end
	if (rule.name == nil) then
		rule.name = "Undefined"
	end
	log("Add rule #" .. tostring(rule._id) .. "(" .. rule.name .. ")", "addRule")

	if ((rule._id == nil) or (rule._id == "")) then
		log("WARNING : Rule '" .. rule.name .. "' has no id (will be calculated later)", "addRule")
		table.insert(_rulesWithoutId, rule)
		return false
	end

	-- Check if a rule already exists with this id (if defined)
	local formerRule = _indexRulesById[rule._id]
	if (formerRule ~= nil) then
		if not keepFormerRuleWithSameId then
			log("Rule #" .. formerRule._id .. "(" .. formerRule.name .. ") already exists - Remove it", "addRule")
			removeRule(formerRule._id)
			_initRuleInfos(rule)
		else
			_initRuleInfos(rule)
			addRuleError(rule, "AddRule", "Duplicate rule with id #" .. formerRule._id .. "(" .. formerRule.name .. ")")
		end
	else
		_initRuleInfos(rule)
	end

	-- Update the last free rule id
	if ((tonumber(rule._id) or 0) > _lastRuleId) then
		_lastRuleId = tonumber(rule._id)
	end

	-- Add the rule
	table.insert(_rules, rule)
	-- Add to indexes
	_indexRulesById[rule._id] = rule
	_indexRulesByName[rule.name] = rule

	-- Init
	_initRule(rule)

	-- Check settings
	if _checkRuleSettings(rule) then
		if (_isStarted) then
			-- If the RulesEngine is already started, then start the rule just after adding
			_startRule(rule)
		end
	else
		rule._isArmed = false
		log("ERROR : Rule #" .. rule._id .. " has at least one error in settings", "addRule")
	end
	updateRulesInfos(rule._id)
	return true
end

-- Remove a rule
function removeRule (ruleId)
	local rule = getRule(ruleId)
	if (rule ~= nil) then
		log("Remove rule #" .. rule._id .. "(" .. rule.name .. ")", "removeRule")
		if (rule._isStarted) then
			_removeScheduledTasks(rule)
		end
		-- Remove rule infos
		_removeRuleInfos(rule)
		-- Remove rule from indexes
		_indexRulesById[rule._id] = nil
		_indexRulesByName[rule.name] = nil
		-- Remove rule
		for i = #_rules, 1, -1 do
			if (_rules[i] == rule) then
				table.remove(_rules, i)
				break
			end
		end
		rule = nil
	end
end

function loadModules ()
	local moduleNames = string.split(_pluginParams.modules, ",")
	for _, moduleName in ipairs(moduleNames) do
		-- Load module
		log("Load module '" .. tostring(moduleName) .. "'", "loadModules")
		-- TODO: there's a problem with the environment of the module (not the the same as the plugin)
		local status, myModule = pcall(require, moduleName)
		if not status then
			error(myModule, "loadModules")
		end
		if (type(myModule) == "string") then
			error("Can not load module: " .. tostring(myModule), "loadModules")
		end
	end
end

function loadStartupFiles ()
	local lfs = require("lfs")
	local fileNames = string.split(_pluginParams.startupFiles, ",")
	for _, fileName in ipairs(fileNames) do
		-- Load and execute startup LUA file
		local path = ""
		if lfs.attributes("/etc/cmh-ludl/" .. fileName .. ".lzo", "mode") then
			log("Decompress LUA startup file '/etc/cmh-ludl/" .. tostring(fileName) .. ".lzo'", "loadStartupFiles")
			path = "/tmp/"
			os.execute(decompressScript .. "decompress_lzo_file_in_tmp " .. fileName)
		end
		log("Load LUA startup from file '" .. path .. tostring(fileName) .. "'", "loadStartupFiles")
		local startup, errorMessage = loadfile(path .. fileName)
		if (startup ~= nil) then
			log("Execute startup LUA code", "startup")
			-- Put the startup in the plugin environment
			setfenv(startup, getfenv(1))
			local status, result = pcall(startup)
			if not status then
				error(result, "startup")
			end
		else
			error("Can not execute startup LUA code: " .. tostring(errorMessage), "loadStartupFiles")
		end
	end
end

local function _addRulesWithoutId ()
	-- Add remaining rules without id
	-- For the moment, I've not found a way to edit safely the XML files
	-- So it's done by the UI client which upload the modified XML file
	for _, rule in ipairs(_rulesWithoutId) do
		rule._id = _getNextFreeRuleId()
		log("Set id to #" .. rule._id .. " for rule '" .. rule.name .. "' in file '" .. rule._fileName .. "' at position " .. tostring(rule._idx), "loadRuleFiles")
		addRule(rule, true)
	end
	_rulesWithoutId = {}
end

function loadRuleFiles ()
	local fileNames = string.split(_pluginParams.ruleFiles, ",")
	log("Load rules from files", "loadRuleFiles")
	-- Add rules from XML files
	for _, fileName in ipairs(fileNames) do
		loadRuleFile(fileName, true)
	end
	_addRulesWithoutId()
end

-- Load rules from xml file (Blockly format)
function loadRuleFile (fileName, keepFormerRuleWithSameId)
	local lfs = require("lfs")
	local fileName = fileName or "C_RulesEngine_Rules.xml"
	local path = ""
	if lfs.attributes("/etc/cmh-ludl/" .. fileName .. ".lzo", "mode") then
		log("Decompress rule file '/etc/cmh-ludl/" .. tostring(fileName) .. ".lzo'", "loadRuleFile")
		path = "/tmp/"
		os.execute(decompressScript .. "decompress_lzo_file_in_tmp " .. fileName)
	end
	log("Load rules from file '" .. fileName .. "'", "loadRuleFile")
	local file = io.open(path .. fileName)
	if (file == nil) then
		log("File '" .. fileName .. "' does not exist", "loadRuleFile")
		return
	end
	local xmlRules = ""
	for line in file:lines() do
		xmlRules = xmlRules .. line
	end
	file:close()

	function parseXmlItem (xmlItem, lvl)
		local item, nextItem = nil, nil
		local key = nil

--print("parseXmlItem", lvl, json.encode(xmlItem))

		if (type(xmlItem) ~= "table") then
			return nil
		end

--print(string.rep(" ", lvl * 2) .. "tag: \"" .. tostring(xmlItem.tag) .. "\"")

		if (xmlItem.tag == "field") then
			key = xmlItem.attr.name
			if (xmlItem[1] ~= nil) then
				-- decode new line
				item = string.gsub(xmlItem[1], "\\\\n", "\n")
			end

		elseif (xmlItem.tag == "value") then
			key = xmlItem.attr.name
			item = parseXmlItem(table.getFirstTable(xmlItem), lvl + 1)

		elseif (xmlItem.tag == "block") then
			if (xmlItem.attr.type == "text") then
				item = table.getFirstTable(xmlItem)[1]
			elseif (xmlItem.attr.type == "text_comment") then
				item = table.getFirstTable(xmlItem)[1]
			else
				item = {}
				item.type = xmlItem.attr.type
				if (xmlItem.attr.id ~= nil) then
					item.id = xmlItem.attr.id
				end
				nextItem = nil
				for _, xmlSubItem in ipairs(xmlItem) do
					local subItem, subKey = parseXmlItem(xmlSubItem, lvl + 1)
					--print(json.encode(subItem))
					if (type(subKey) == "string") then
						if (subKey == "next") then
							nextItem = subItem
						else
							--item[subKey] = subItem or "null"
							item[subKey] = subItem
						end
					--else
					--	print("pb", json.encode(subItem))
					end
				end
				if (nextItem ~= nil) then
					-- statement
					item = { item }
					if (nextItem.type ~= nil) then
						nextItem = { nextItem }
					end
					--print("item", json.encode(item), "nextItem", json.encode(nextItem))
					table.add(item, nextItem)
					--print("item", json.encode(item))
					--table.insert(a, 1, item)
				end
--print("item", json.encode(item))
				if (item.type ~= nil) then
					if (string.match(item.type, "^list_with_operator_.*")) then
						-- List with operator
						local items, i = {}, 0
						while (type(item["ADD" .. tostring(i)]) == "table") do
							table.insert(items, item["ADD" .. tostring(i)])
							i = i + 1
						end
						item = {
							type = item.type,
							operator = item["operator"],
							items = items
						}
					elseif ((item.type == "lists_create_with") or string.match(item.type, "^list_.*")) then
						-- List
						local listItem, i = {}, 0
						while (type(item["ADD" .. tostring(i)]) == "table") do
							table.insert(listItem, item["ADD" .. tostring(i)])
							i = i + 1
						end
						item = listItem
					end
				end
			end

		elseif (xmlItem.tag == "statement") then
			key = xmlItem.attr.name
			item = parseXmlItem(table.getFirstTable(xmlItem), lvl + 1)
			if (item.type ~= nil) then
				item = { item }
			end

		elseif (xmlItem.tag == "next") then
			key = "next"
			item = parseXmlItem(table.getFirstTable(xmlItem), lvl + 1)
			--print("next", json.encode(item))

		elseif (xmlItem.tag == "mutation") then
			-- do nothing

		else
			--print("tag '" .. json.encode(xmlItem) .. "' not used")
		end

--print(string.rep(" ", lvl * 2) .. "<-- \"" .. tostring(key) .. "\": " .. tostring(json.encode(item)))
		return item, key
	end

	local lom = require("lxp.lom")
	xmltable = lom.parse(xmlRules)
	--print(json.encode(xmltable))
	--print("")

	local idx = 1
	if ((type(xmltable) == "table") and (xmltable.tag == "xml")) then
		for _, xmlRule in ipairs(xmltable) do
			if ((type(xmlRule) == "table") and (xmlRule.tag == "block") and (xmlRule.attr.type == "rule")) then
				local rule = parseXmlItem(xmlRule, 0)
--print(json.encode(rule))
				rule._id = tostring(rule.id or "")
				rule._fileName = fileName
				rule._idx = idx -- Index in the XML file
--print("")
--print("rule", json.encode(rule))
				addRule(rule, keepFormerRuleWithSameId)
				idx = idx +1
			end
		end
		if (_isStarted) then
			_addRulesWithoutId()
		end
		notifyRulesInfosUpdate()
	else
		log("File '" .. fileName .. "' does not contain XML", "loadRuleFile")
	end
end

-- Get rule (try first by id, then by name or return the input if it is a table)
function getRule (ruleId)
	local rule
	if (ruleId == nil) then
		error("Parameter #1 is nil", "getRule")
	elseif ((type(ruleId) == "string") or (type(ruleId) == "number")) then
		ruleId = tostring(ruleId)
		if (tonumber(ruleId) ~= nil) then
			-- Try to get by id
			rule = _indexRulesById[ruleId]
		end
		if (rule == nil) then
			-- Otherwise, try to get by name
			rule = _indexRulesByName[ruleId]
		end
		if (rule == nil) then
			log("WARNING - Rule '" .. ruleId .. "' is unknown", "getRule")
			--rule = { name = "unknown" }
		end
	elseif (type(ruleId) == "table") then
		if (ruleId._id ~= nil) then
			rule = getRule(ruleId._id)
			if (rule ~= ruleId) then
				error("Given rule is not the rule added with this id", "getRule")
			end
		else
			error("Given rule has not been retrieved", "getRule")
		end

	else
		error("Parameter #1 is not a table", "getRule")
	end
	return rule
end

-- Get rule status
function getRuleStatus (ruleId)
	local rule = getRule(ruleId)
	if (rule ~= nil) then
		return rule._status or "0"
	else
		return nil
	end
end

-- Is rule active
function isRuleActive (ruleId)
	return (getRuleStatus(ruleId) == "1")
end

-- Get rule level
function getRuleLevel (ruleId)
	local rule = getRule(ruleId)
	if (rule ~= nil) then
		return rule._level or 0
	else
		return nil
	end
end

-- Rule arming
function setRuleArming (ruleId, arming)
	local rule = getRule(ruleId)
	if (rule == nil) then
		return false, "Rule #" .. tostring(ruleId) .. " is unknown"
	end
	local msg = "Rule #" .. rule._id .. "(" .. rule.name .. ")"
	if (arming == "1") then
		if not rule._isArmed then
			if (rule._areSettingsOk) then
				rule._isArmed = true
				log(msg .. " is now armed", "setRuleArming")
				doHook("onRuleIsArmed", rule)
				updateRulesInfos(rule._id)
				notifyRulesInfosUpdate()
			else
				log(msg .. " can not be armed - Settings are not ok", "setRuleArming")
			end
		else
			msg = msg .. " was already armed"
			log(msg, "setRuleArming")
			return false, msg
		end
	else
		if rule._isArmed then
			rule._isArmed = false
			log(msg .. " is now disarmed", "setRuleArming")
			doHook("onRuleIsDisarmed", rule)
			updateRulesInfos(rule._id)
			notifyRulesInfosUpdate()
		else
			msg = msg .. " was already disarmed"
			log(msg, "setRuleArming")
			return false, msg
		end
	end
	return true
end

-- Is rule armed
function isRuleArmed (ruleId)
	local rule = getRule(ruleId)
	if (rule == nil) then
		return false
	end
	return (rule._isArmed == true)
end

-- Rule acknowledgement
function setRuleAcknowledgement (ruleId, acknowledgement)
	local rule = getRule(ruleId)
	if (rule == nil) then
		return false, "Rule #" .. tostring(ruleId) .. " is unknown"
	end
	local msg = "Rule #" .. rule._id .. "(" .. rule.name .. ")"
	if (acknowledgement == "1") then
		if (rule._isAcknowledgeable and not rule._isAcknowledged) then
			rule._isAcknowledged = true
			log(msg .. " is now acknowledged", "setRuleAcknowledge")
			doHook("onRuleIsAcknowledged", rule)
			updateRulesInfos(rule._id)
			notifyRulesInfosUpdate()
			updatePanel()
		else
			msg = msg .. " was already acknowledged"
			log(msg, "setRuleAcknowledge")
			return false, msg
		end
	else
		if rule._isAcknowledged then
			rule._isAcknowledged = false
			log(msg .. " is now not acknowledged", "setRuleAcknowledge")
			doHook("onRuleIsUnacknowledged", rule)
			updateRulesInfos(rule._id)
			notifyRulesInfosUpdate()
			updatePanel()
		else
			msg = msg .. " was already not acknowledged"
			log(msg, "setRuleAcknowledge")
			return false, msg
		end
	end
	return true
end

-- Set the status of the rule and start linked actions
function setRuleStatus (ruleId, status, level)
	local rule = getRule(ruleId)
	if (rule == nil) then
		return false
	end
	local msg = "Rule #" .. rule._id .. "(" .. rule.name .. ")"

	-- Update rule active level
	local hasRuleLevelChanged = false
	local oldLevel = rule._level
	if ((level ~= nil) and (level ~= oldLevel)) then
		rule._level = level
		rule._lastLevelUpdateTime = os.time()
		hasRuleLevelChanged = true
		log(msg .. " level has changed (oldLevel:'" .. tostring(oldLevel).. "', newLevel:'" .. tostring(level) .. "')", "setRuleStatus", 2)
	end

	local hasRuleStatusChanged = false

	-- Check if rule is armed
	if (not rule._isArmed) then
		if (rule._status == "1") then
			log(msg .. " is disarmed and is now inactive", "setRuleStatus")
			status = "0"
		else
			log(msg .. " is disarmed - Do nothing ", "setRuleStatus")
			return
		end
	end

	if ((rule._status == "0") and (status == "1")) then
		-- The rule has just been activated
		log(msg .. " is now active", "setRuleStatus")
		rule._status = "1"
		rule._lastStatusUpdateTime = os.time()
		updateRuleContext(rule)
		setRuleAcknowledgement(rule, "0")

		hasRuleStatusChanged = true
		doHook("onRuleIsActivated", rule)
		-- Cancel all scheduled actions for this rule
		_removeScheduledTasks(rule)
		-- Execute actions linked to activation, if possible
		if doHook("beforeDoingActionsOnRuleIsActivated", rule) then
			doRuleActions(rule, "start")
			doRuleActions(rule, "reminder")
			if (level or 0 > 0) then
				doRuleActions(rule, "start", level)
				doRuleActions(rule, "reminder", level)
			end
			_addToHistory(os.time(), "RuleStatus", "Rule '" .. rule.name .. "' is now active")
		else
			_addToHistory(os.time(), "RuleStatus", "Rule '" .. rule.name .. "' is now active, but a hook prevents from doing actions")
		end

	elseif ((rule._status == "1") and (status == "0")) then
		-- The rule has just been deactivated
		log("Rule '" .. rule.name .. "' is now inactive", "setRuleStatus")
		rule._status = "0"
		rule._lastStatusUpdateTime = os.time()
		updateRuleContext(rule)

		hasRuleStatusChanged = true
		doHook("onRuleIsDeactivated", rule)
		-- Cancel all scheduled actions for this rule
		_removeScheduledTasks(rule)
		-- Execute actions linked to deactivation, if possible
		if doHook("beforeDoingActionsOnRuleIsDeactivated", rule) then
			if (hasRuleLevelChanged) then
				doRuleActions(rule, "end", oldLevel)
				if (level or 0 > 0) then
					doRuleActions(rule, "end", level)
				end
			end
			doRuleActions(rule, "end")
			_addToHistory(os.time(), "RuleStatus", "Rule '" .. rule.name .. "' is now inactive")
		else
			_addToHistory(os.time(), "RuleStatus", "Rule '" .. rule.name .. "' is now inactive, but a hook prevents from doing actions")
		end

	elseif (rule._status == "1") then
		-- The rule is still active
		if (hasRuleLevelChanged) then
			log("Rule '" .. rule.name .. "' is still active but its level has changed", "setRuleStatus")
			updateRuleContext(rule)
			-- Cancel scheduled actions for this rule and for old level
			_removeScheduledTasks(rule, oldLevel)
			-- Execute actions linked to level change
			doRuleActions(rule, "end", oldLevel)
			doRuleActions(rule, "start", level)
			doRuleActions(rule, "reminder", level)
		else
			log("Rule '" .. rule.name .. "' is still active (do nothing)", "setRuleStatus")
		end

	--elseif (rule._status == "0") then
	else
		-- The rule is still inactive
		log("Rule '" .. rule.name .. "' is still inactive (do nothing)", "setRuleStatus")
	end

	if (hasRuleStatusChanged or hasRuleLevelChanged) then
		updateRulesInfos(rule._id)
		notifyRulesInfosUpdate()
	end
	if (hasRuleStatusChanged) then
		-- Notify that rule status has changed
		updatePanel()
		_onRuleStatusIsUpdated(rule.name, rule._status)
	end

end

function updateRuleStatus (ruleId)
	local rule = getRule(ruleId)
	if (rule == nil) then
		return false
	end
	log("Update status of rule '" .. rule.name .. "'", "updateRuleStatus", 2)
	local status, level = _computeRuleStatus(rule)
	setRuleStatus(rule, status, level)
end

-- Update HTML panel show on UI
function updatePanel ()
	local status = "0"
	local style = ""

	local panel = ""

	if (_verbosity > 1) then
		panel = panel .. '<div style="color:gray;font-size:.7em;text-align:left;">Debug enabled (' .. tostring(_verbosity) .. ')</div>'
	end

	local rulePanel = ""
	for _, rule in pairs(_rules) do
		if (rule.name ~= "") then
			style = "border: gray 1px solid; padding:2px; margin:2px; display:inline-block;"
			if (rule._status == "1") then
				style = style .. " font-weight:bold;"
				if (rule._isAcknowledged == "1") then
					-- Rule active but acknowledged
					if (status ~= "1") then
						-- There's not an active rule not acknowledged
						status = "2"
					end
					style = style .. " color:orange;"
				else
					-- Rule active
					status = "1"
					style = style .. " color:red;"
				end
				rulePanel = rulePanel .. '<li style="' .. style .. '">' .. tostring(rule.name) .. '</li>'
			end
		end
	end

	if (rulePanel ~= "") then
		panel = panel .. '<ul class="AlarmPanel" style="text-align: justify; text-indent: 0px; display: inline;">' .. rulePanel .. '</ul>'
	else
		panel = panel .. '<div style="color:gray;font-size:.7em;text-align:left;">No active rule</div>'
	end
print(panel)
	luup.variable_set(SID.RulesEngine, "RulePanel", panel, _pluginParams.deviceId)
	luup.variable_set(SID.RulesEngine, "Status", status, _pluginParams.deviceId)
end

-- **************************************************
-- Main methods
-- **************************************************

-- Start
function start ()
	if (_isStarted) then
		log("RulesEngine already started", "start")
	end

	log("Start RulesEngine (v" .. _VERSION ..")", "start")
	for ruleId, rule in pairs(_rules) do
		_startRule(rule)
	end
	updatePanel()
	notifyRulesInfosUpdate()
	_isStarted = true
	--RulesEngine.dump()
end

-- Stop
function stop ()
	_isStarted = false
end

-- Dump for debug
function dump ()
	log("Dump RulesEngine datas", "dump", 4)
	log("rules:" .. json.encode(_rules), "dump", 4)
	log("_indexRulesByEvent:" .. json.encode(_indexRulesByEvent), "dump", 4)
end

-- Sets the verbosity level
function setVerbosity (level)
	_verbosity = tonumber(level) or 0
	log("Set verbosity to " .. tostring(_verbosity), "setVerbosity")
end

function getVerbosity()
	return _verbosity
end

function setMinRecurrentInterval (minInterval)
	_minRecurrentInterval = tonumber(minInterval) or _minRecurrentInterval
end

-- **************************************************
-- Unit tests
-- **************************************************

-- Reset (just for unit tests)
function reset ()
	log("Reset RulesEngine", "reset")
	-- Initialisations of rules
	-- for ruleId, rule in pairs(_rules) do
		-- _initRule(rule)
	-- end
	_rules  = {}
	_indexRulesById = {}
	_indexRulesByName = {}
	_indexRulesByEvent = {}

	_pluginParams = {
		rulesInfos = {}
	}

	_scheduledTasks = {}
	_nextWakeUps = {}
end

-- Reset hooks (just for unit tests)
function resetHooks ()
	log("Reset hooks", "resetHooks")
	-- Reset of hooks
	_hooks = {}
end

-------------------------------------------
-- External event management
-------------------------------------------

-- Changes debug level log
local function _onDebugValueIsUpdated (lul_device, lul_service, lul_variable, lul_value_old, lul_value_new)
	setVerbosity(lul_value_new)
end

-------------------------------------------
-- Handlers
-------------------------------------------

local _handlerCommands = {
	["default"] = function (params, outputFormat)
		return "Unknown command '" .. tostring(params["command"]) .. "'", "text/plain"
	end,

	["getTimeline"] = function (params, outputFormat)
		local outputFormat = outputFormat or "html"

		if (outputFormat == "html") then
			log("HTML timeline", "handleCommand.getTimeline")
			local timeline = "<div><h2>History:</h2>"
			for _, entry in ipairs(_history) do
				timeline = timeline .. "<p>" .. os.date("%X", entry.timestamp) .. " - " .. tostring(entry.eventType) .. " - " .. tostring(entry.event) .. "</p>"
			end
			timeline = timeline .. "</div>"

			timeline = timeline .. "<div><h2>Comming next:</h2>"
			for _, scheduledTask in ipairs(_scheduledTasks) do
				timeline = timeline .. "<p>" .. os.date("%X", scheduledTask.timeout) .. " - " .. _getItemSummary(scheduledTask.item) .. "</p>"
			end
			timeline = timeline .. "</div>"
			return timeline, "text/plain"

		elseif (outputFormat == "json") then
			log("JSON timeline", "handleCommand.getTimeline")
			local timeline = {
				history = _history,
				scheduled = {}
			}
			for _, scheduledTask in ipairs(_scheduledTasks) do
				table.insert(timeline.scheduled, {
					timestamp = scheduledTask.timeout,
					eventType = "Schedule",
					event = _getItemSummary(scheduledTask.item)
				})
			end
			return tostring(json.encode(timeline)), "application/json"

		end

		return false
	end,

	["getRulesInfos"] = function (params, outputFormat)
		local ruleId = params["ruleId"]
		local ruleIdx = params["ruleIdx"]
		local ruleFileName = params["ruleFileName"]
		local rulesInfos
		if (ruleId ~= nil) then
			rulesInfos = {}
			for i, ruleInfos in ipairs(_rulesInfos) do
				if (ruleInfos.id == ruleId) then
					table.insert(rulesInfos, ruleInfos)
				end
			end
		else
			rulesInfos = _rulesInfos
		end
		return tostring(json.encode(rulesInfos)), "application/json"
	end,

	["ISS"] = function (params, outputFormat)
		local path = params["path"] or "/devices"
		local result

		-- System infos
		if (path == "/system") then
			log("Get system info", "handleCommand.ISS", 2)
			result = {
				id = "RulesEngine-" .. tostring(luup.pk_accesspoint) .. "-" .. _pluginParams.deviceId,
				apiversion = 1
			}

		-- Device list
		elseif (path == "/devices") then
			log("Get device list", "handleCommand.ISS", 2)
			result = { devices = {} }
			for _, rule in pairs(_rules) do
			
--print((rule._status == "1"), (rule._isAcknowledged == "0"))
			
				table.insert(result.devices, {
					id   = rule._id,
					name = rule.name,
					type = "DevMotion",
					room = "1",
					idx = rule._idx,
					params = {
						{
							key = "FileName",
							value = rule._fileName
						},
						{
							key = "Armable",
							value = "1"
						},
						{
							key = "Ackable",
							value = ((rule._isAcknowledgeable and "1") or "0")
						},
						{
							key = "Armed",
							value = ((rule._isArmed and "1") or "0")
						},
						{
							key = "Tripped",
							value = ((((rule._status == "1") and not rule._isAcknowledged) and "1") or "0")
						},
						{
							key = "Ack",
							value = ((rule._isAcknowledged and "1") or "0")
						},
						{
							key = "lasttrip",
							value = rule._lastStatusUpdateTime
						}
					}
				})
			end

		-- Actions
		elseif string.find(path, "^/devices/[^%/]+/action/[^%/]+") then
			local deviceId, actionName, actionParam = string.match(path, "^/devices/([^%/]+)/action/([^%/]+)/*([^%/]*)$")
			log("Do action '" .. tostring(actionName) .. "' with param '" .. tostring(actionParam) .. "' on device #" .. tostring(deviceId), "handleCommand.ISS", 2)
			if (actionName == "setArmed") then
				local success, msg = setRuleArming(deviceId, actionParam)
				result = { success = success, errormsg = msg }
			elseif (actionName == "setAck") then
				--local success, msg = setRuleAcknowledgement(deviceId, actionParam)
				-- TODO : acknoledgement in ImperiHome can not be canceled
				local success, msg = setRuleAcknowledgement(deviceId, "1")
				result = { success = success, errormsg = msg }
			else
				result = {
					success = false,
					errormsg = "Action '" .. tostring(actionName) .. "' is not handled"
				}
			end

		elseif (path == "/rooms") then
			log("Get room list", "handleCommand.ISS", 2)
			result = {
				rooms = {
					{ id = "1", name = "Rules" }
				}
			}

		else
			result = {
				success = false,
				errormsg = "Path '" .. tostring(path) .. "' is not handled"
			}
		end

		return tostring(json.encode(result)), "application/json"
	end
}
setmetatable(_handlerCommands,{
	__index = function(t, command, outputFormat)
		log("No handler for command '" ..  tostring(command) .. "'", "handlerRulesEngine")
		return _handlerCommands["default"]
	end
})

local function _handleCommand (lul_request, lul_parameters, lul_outputformat)
	log("lul_request: " .. tostring(lul_request), "handleCommand")
	log("lul_parameters: " .. tostring(json.encode(lul_parameters)), "handleCommand")
	log("lul_outputformat: " .. tostring(lul_outputformat), "handleCommand")

	local command = lul_parameters["command"] or "default"
	log("Get handler for command '" .. tostring(command) .."'", "handleCommand")
	return _handlerCommands[command](lul_parameters, lul_outputformat)
end

-------------------------------------------
-- Startup
-------------------------------------------

-- Init plugin instance
local function _initPluginInstance (lul_device)
	log("initPluginInstance", "Init")

	-- Get plugin params for this device
	_getVariableOrInit(lul_device, SID.RulesEngine, "Status", "0")
	_getVariableOrInit(lul_device, SID.RulesEngine, "Message", "")
	_getVariableOrInit(lul_device, SID.RulesEngine, "LastUpdate", "")
	_getVariableOrInit(lul_device, SID.RulesEngine, "RulePanel", "")
	_pluginParams = {
		deviceId = lul_device,
		modules = _getVariableOrInit(lul_device, SID.RulesEngine, "Modules", "") or "",
		toolboxConfig = _getVariableOrInit(lul_device, SID.RulesEngine, "ToolboxConfig", "") or "",
		startupFiles = _getVariableOrInit(lul_device, SID.RulesEngine, "StartupFiles", "C_RulesEngine_Startup.lua") or "",
		ruleFiles = _getVariableOrInit(lul_device, SID.RulesEngine, "RuleFiles", "C_RulesEngine_Rules.xml") or "",
		rulesInfos = json.decode(_getVariableOrInit(lul_device, SID.RulesEngine, "RulesInfos", "[]")) or {}
	}

	-- Get debug mode
	setVerbosity(_getVariableOrInit(lul_device, SID.RulesEngine, "Debug", "0"))

	if (type(json) == "string") then
		--showErrorOnUI("initPluginInstance", lul_device, "No JSON decoder")
	else
		
	end
end

-- Deferred startup
local function _deferredStartup (lul_device)
	-- Load custom modules
	loadModules()

	-- Load custom Lua Startup
	loadStartupFiles()

	-- Load rules
	loadRuleFiles()

	-- TODO : bouton ON /OFF
	start()
end

-- Register with ALTUI once it is ready
local function _registerWithALTUI ()
	for deviceId, device in pairs(luup.devices) do
		if (device.device_type == DID.ALTUI) then
			if luup.is_ready(deviceId) then
				log("Register with ALTUI main device #" .. tostring(deviceId), "registerWithALTUI")
				luup.call_action(
					SID.ALTUI,
					"RegisterPlugin",
					{
						newDeviceType = DID.RulesEngine,
						newScriptFile = "J_ALTUI_RulesEngine1.js",
						newDeviceDrawFunc = "ALTUI_RulesEngine.drawDevice",
						newStyleFunc = "ALTUI_RulesEngine.getStyle",
						newDeviceIconFunc = "",
						newControlPanelFunc = "ALTUI_RulesEngine.drawControlPanel"
					},
					deviceId
				)
			else
				log("ALTUI main device #" .. tostring(deviceId) .. " is not yet ready, retry to register in 10 seconds...", "registerWithALTUI")
				luup.call_delay("RulesEngine.registerWithALTUI", 10)
			end
			break
		end
	end
end

-- Startup
function startup (lul_device)
	log("Start plugin '" .. _NAME .. "' (v" .. _VERSION .. ")", "startup")

	-- Update static JSON file
	if _updateStaticJSONFile(lul_device, _NAME .. "1") then
		warning("'device_json' has been updated : reload LUUP engine", "startup")
		if ((luup.version_branch == 1) and (luup.version_major > 5)) then
			luup.reload()
		end
		return false, "Reload LUUP engine"
	end

	-- Init
	_initPluginInstance(lul_device)

	-- Watch setting changes
	--luup.variable_watch("RulesEngine.initPluginInstance", SID.RulesEngine, "Options", lul_device)
	luup.variable_watch("RulesEngine.onDebugValueIsUpdated", SID.RulesEngine, "Debug", lul_device)

	-- Default action
	addActionType(
		"action_device",
		function (action, context)
			action.deviceId = tonumber(action.deviceId)
			-- Check first device com status
			if (not luup.is_ready(action.deviceId) or luup.variable_get(SID.HaDevice, "CommFailure", action.deviceId) == "1") then
				log("ERROR : Device #" .. tostring(action.deviceId) .. " is not ready or has a com failure", "doAction.action_device", 1)
			end
			local arguments = {}
			for key, value in pairs(action) do
				local paramName = string.match(key, "^param_(.*)$")
				if (paramName ~= nil) then
					arguments[paramName] = value
				end
			end
			log("Action '" .. action.action .. "' for device #" .. tostring(action.deviceId) .. " with " .. tostring(json.encode(arguments)), "doAction.action_device", 3)
			luup.call_action(action.service, action.action, arguments, action.deviceId)
		end
	)

	-- Handlers
	luup.register_handler("RulesEngine.handleCommand", "RulesEngine")

	-- Deferred startup
	luup.call_delay("RulesEngine.deferredStartup", 1)

	-- Register with ALTUI
	luup.call_delay("RulesEngine.registerWithALTUI", 10)

	luup.set_failure(0, lul_device)
	return true
end

-- Expose the RulesEngine in the Global Name Space for custom scripts
_G["RulesEngine"] = {
	log = log,
	getEnhancedMessage = getEnhancedMessage,
	addHook = addHook,
	doHook = doHook,
	addActionType = addActionType,
	doRuleActions = doRuleActions,
	setVerbosity = setVerbosity,
	setMinRecurrentInterval = setMinRecurrentInterval
}

-- Promote the functions used by Vera's luup.xxx functions to the Global Name Space
_G["RulesEngine.onDeviceVariableIsUpdated"] = _onDeviceVariableIsUpdated
_G["RulesEngine.onTimerIsTriggered"] = _onTimerIsTriggered

_G["RulesEngine.initPluginInstance"] = _initPluginInstance
_G["RulesEngine.onDebugValueIsUpdated"] = _onDebugValueIsUpdated
_G["RulesEngine.deferredStartup"] = _deferredStartup
_G["RulesEngine.handleCommand"] = _handleCommand
_G["RulesEngine.registerWithALTUI"] = _registerWithALTUI

_G["RulesEngine.doScheduledTasks"] = _doScheduledTasks
_G["RulesEngine.doRuleAction"] = _doRuleAction
_G["RulesEngine.updateConditionStatus"] = _updateConditionStatus
_G["RulesEngine.updateRuleStatus"] = updateRuleStatus
