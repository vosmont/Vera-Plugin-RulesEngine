--[[
  This file is part of the plugin RulesEngine.
  https://github.com/vosmont/Vera-Plugin-RulesEngine
  Copyright (c) 2016 Vincent OSMONT
  This code is released under the MIT License, see LICENSE.
--]]

module("L_RulesEngine1", package.seeall)

-- Load json library (in global)
local status
status, json = pcall(require, "dkjson")
if (type(json) ~= "table") then
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

-- This table defines all device variables that are used by the plugin
-- Each entry is a table of 4 elements:
-- 1) the service ID
-- 2) the variable name
-- 3) true if the variable is not updated when the value is unchanged
-- 4) variable that is used for the timestamp
local VARIABLE = {
	TEMPERATURE = { "urn:upnp-org:serviceId:TemperatureSensor1", "CurrentTemperature", true },
	HUMIDITY = { "urn:micasaverde-com:serviceId:HumiditySensor1", "CurrentLevel", true },
	SWITCH_POWER = { "urn:upnp-org:serviceId:SwitchPower1", "Status", true },
	DIMMER_LEVEL = { "urn:upnp-org:serviceId:Dimming1", "LoadLevelStatus", true },

	-- Security
	ARMED = { "urn:micasaverde-com:serviceId:SecuritySensor1", "Armed", true },
	TRIPPED = { "urn:micasaverde-com:serviceId:SecuritySensor1", "Tripped", false, "LAST_TRIP" },
	LAST_TRIP = { "urn:micasaverde-com:serviceId:SecuritySensor1", "LastTrip", true },
	-- Battery
	BATTERY_LEVEL = { "urn:micasaverde-com:serviceId:HaDevice1", "BatteryLevel", true, "BATTERY_DATE" },
	BATTERY_DATE = { "urn:micasaverde-com:serviceId:HaDevice1", "BatteryDate", true },
	-- Alarm
	ALARM_TYPE = { "urn:micasaverde-com:serviceId:HaDevice1", "sl_Alarm", true },
	TAMPER_ALARM = { "urn:micasaverde-com:serviceId:HaDevice1", "sl_TamperAlarm", false, "LAST_TAMPER" },
	LAST_TAMPER = { "urn:micasaverde-com:serviceId:HaDevice1", "LastTamper", true },
	COMM_FAILURE = { "urn:micasaverde-com:serviceId:HaDevice1", "CommFailure", true },
	-- Specific RulesEngine
	PLUGIN_VERSION = { "urn:upnp-org:serviceId:RulesEngine1", "PluginVersion", true },
	DEBUG_MODE = { "urn:upnp-org:serviceId:RulesEngine1", "Debug", true },
	LAST_UPDATE = { "urn:upnp-org:serviceId:RulesEngine1", "LastUpdate", true },
	MESSAGE = { "urn:upnp-org:serviceId:RulesEngine1", "Message", true },
	MODULES = { "urn:upnp-org:serviceId:RulesEngine1", "Modules", true },
	TOOLBOX_CONFIG = { "urn:upnp-org:serviceId:RulesEngine1", "ToolboxConfig", true },
	STARTUP_FILES = { "urn:upnp-org:serviceId:RulesEngine1", "StartupFiles", true },
	RULES_FILES = { "urn:upnp-org:serviceId:RulesEngine1", "RuleFiles", true },
	STORE_PATH = { "urn:upnp-org:serviceId:RulesEngine1", "StorePath", true }
}
local indexVariable = {}
for _, variable in pairs(VARIABLE) do
	indexVariable[variable[1] .. ";" .. variable[2]] = variable
end

-------------------------------------------
-- Plugin variables
-------------------------------------------

_NAME = "RulesEngine"
_DESCRIPTION = "Rules Engine for the Vera with visual editor"
_VERSION = "0.11"
_AUTHOR = "vosmont"

local _params = {}
local _isInitialized = false
local _isEnabled = false
local _isStarted = false
local _verbosity = 0
local _minRecurrentInterval = 60
local _maxHistoryInterval = 30 * 24 * 60 * 60


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
		if ((currentStaticJsonFile ~= nil) and (currentStaticJsonFile ~= expectedStaticJsonFile)) then
			luup.attr_set("device_json", expectedStaticJsonFile, lul_device)
			isUpdated = true
		end
	end
	return isUpdated
end

-- **************************************************
-- Table functions
-- **************************************************

-- Merges (deeply) the contents of one table (t2) into another (t1)
local function table_extend (t1, t2)
	if ((t1 == nil) or (t2 == nil)) then
		return
	end
	for key, value in pairs(t2) do
		if (type(value) == "table") then
			if (type(t1[key]) == "table") then
				t1[key] = table_extend(t1[key], value)
			else
				t1[key] = table_extend({}, value)
			end
		elseif (value ~= nil) then
			t1[key] = value
		end
	end
	return t1
end

local table = table_extend({}, table) -- do not pollute original "table"
do -- Extend table
	table.extend = table_extend

	-- Checks if a table contains the given item.
	-- Returns true and the key / index of the item if found, or false if not found.
	function table.contains (t, item)
		for k, v in pairs(t) do
			if (v == item) then
				return true, k
			end
		end
		return false
	end

	-- Checks if table contains all the given items (table).
	function table.containsAll (t1, items)
		if ((type(t1) ~= "table") or (type(t2) ~= "table")) then
			return false
		end
		for _, v in pairs(items) do
			if not table.contains(t1, v) then
				return false
			end
		end
		return true
	end

	-- Appends the contents of the second table at the end of the first table
	function table.append (t1, t2, noDuplicate)
		if ((t1 == nil) or (t2 == nil)) then
			return
		end
		local table_insert = table.insert
		table.foreach(
			t2,
			function (_, v)
				if (noDuplicate and table.contains(t1, v)) then
					return
				end
				table_insert(t1, v)
			end
		)
		return t1
	end

	-- Get first value which is of type "table"
	function table.getFirstTable (t)
		for _, item in ipairs(t) do
			if (type(item) == "table") then
				return item
			end
		end
		return nil
	end
end

-- **************************************************
-- String functions
-- **************************************************

local string = table_extend({}, string) -- do not pollute original "string"
do -- Extend string
	-- Pads string to given length with given char from left.
	function string.lpad (s, length, c)
		s = tostring(s)
		length = length or 2
		c = c or " "
		return c:rep(length - #s) .. s
	end

	-- Pads string to given length with given char from right.
	function string.rpad (s, length, c)
		s = tostring(s)
		length = length or 2
		c = char or " "
		return s .. c:rep(length - #s)
	end

	-- Splits a string based on the given separator. Returns a table.
	function string.split (s, sep, convert)
		if (type(convert) ~= "function") then
			convert = nil
		end
		if (type(s) ~= "string") then
			return {}
		end
		sep = sep or " "
		local t = {}
		for token in s:gmatch("[^" .. sep .. "]+") do
			if (convert ~= nil) then
				token = convert(token)
			end
			table.insert(t, token)
		end
		return t
	end
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
local compressScript = [[
compress_lzo_file_in_tmp() {
	SRC_FILE=/tmp/$1
	DEST_FILE=/etc/cmh-ludl/$1.lzo
	if [ ! -e $DEST_FILE -o $SRC_FILE -nt $DEST_FILE ]
	then
		TEMP_FILE=$(mktemp)
		pluto-lzo c $SRC_FILE $TEMP_FILE
		mv $TEMP_FILE $DEST_FILE
	fi
}
]]

------------------------------------------------------------------------------------------------------------------------
-- Variable managment functions
------------------------------------------------------------------------------------------------------------------------

Variable = {
	-- Get variable timestamp
	getTimestamp = function (deviceId, variable)
		if ((type(variable) == "table") and (type(variable[4]) == "string")) then
			local variableTimestamp = VARIABLE[variable[4]]
			if (variableTimestamp ~= nil) then
				return luup.variable_get(variableTimestamp[1], variableTimestamp[2], deviceId)
			end
		end
		return nil
	end,

	-- Set variable timestamp
	setTimestamp = function (deviceId, variable, timestamp)
		if (variable[4] ~= nil) then
			local variableTimestamp = VARIABLE[variable[4]]
			if (variableTimestamp ~= nil) then
				luup.variable_set(variableTimestamp[1], variableTimestamp[2], (timestamp or os.time()), deviceId)
			end
		end
	end,

	-- Get variable value (can deal with unknown variable)
	get = function (deviceId, variable)
		deviceId = tonumber(deviceId)
		if (deviceId == nil) then
			error("deviceId is nil", "Variable.get")
			return
		elseif (variable == nil) then
			error("variable is nil", "Variable.get")
			return
		end
		local value, timestamp = luup.variable_get(variable[1], variable[2], deviceId)
		local storedTimestamp = Variable.getTimestamp(deviceId, variable)
		if (storedTimestamp ~= nil) then
			timestamp = storedTimestamp
		end
		return value, timestamp
	end,

	getUnknown = function (deviceId, serviceId, variableName)
		local variable = indexVariable[tostring(serviceId) .. ";" .. tostring(variableName)]
		if (variable ~= nil) then
			return Variable.get(deviceId, variable)
		else
			return luup.variable_get(serviceId, variableName, deviceId)
		end
	end,

	-- Set variable value
	set = function (deviceId, variable, value)
		deviceId = tonumber(deviceId)
		if (deviceId == nil) then
			error("deviceId is nil", "Variable.get")
			return
		elseif (variable == nil) then
			error("variable is nil", "Variable.get")
			return
		elseif (value == nil) then
			error("value is nil", "Variable.get")
			return
		end
		if (type(value) == "number") then
			value = tostring(value)
		end
		local doChange = true
		local currentValue = luup.variable_get(variable[1], variable[2], deviceId)
		local deviceType = luup.devices[deviceId].device_type
		if ((currentValue == value) and variable[3] == true) then
			-- Variable is not updated when the value is unchanged
			doChange = false
		end
	
		if (doChange) then
			luup.variable_set(variable[1], variable[2], value, deviceId)
		end

		-- Updates linked variable for timestamp
		Variable.setTimestamp(deviceId, variable, os.time())
	end,

	-- Get variable value and init if value is nil
	getOrInit = function (deviceId, variable, defaultValue)
		local value, timestamp = Variable.get(deviceId, variable)
		if (value == nil) then
			Variable.set(deviceId, variable, defaultValue)
			value = defaultValue
			timestamp = os.time()
		end
		return value, timestamp
	end
}

-- **************************************************
-- Helpers
-- **************************************************

local function _isLogLevel (level)
	if (level > _verbosity) then
		return false
	end
	return true
end

local function getFormatedMethodName (methodName)
	if (methodName == nil) then
		methodName = "UNKNOWN"
	else
		methodName = "(" .. _NAME .. "::" .. tostring(methodName) .. ")"
	end
	return string.rpad(methodName, 45)
end

function log (msg, methodName, level)
	level = tonumber(level) or 1
	if not _isLogLevel(level)then
		return
	end
	--[[
	if (_verbosity > 2) then
		methodName = "(" .. tostring(level or 1) .. ")" .. methodName
	end
	--]]
	luup.log(getFormatedMethodName(methodName) .. " " .. msg, 50)
end

local _memoryLevel = 0
local _memoryUsedByLevel = {}
local function debugLogBegin (methodName)
	if (_verbosity < 4) then
		return
	end
	_memoryLevel = _memoryLevel + 1
	--collectgarbage()
	_memoryUsedByLevel[_memoryLevel] = collectgarbage("count")
	local msg = ""
	for i = 1, _memoryLevel do
		msg = msg .. "--"
	end
	msg = msg .. "> begin '" .. tostring(methodName) .. "' - " .. tostring(math.ceil(_memoryUsedByLevel[_memoryLevel])) .. "ko"
	log (msg, methodName, 4)
end
local function debugLogEnd (methodName)
	if (_verbosity < 4) then
		return
	end
	local formerMemoryUsed = _memoryUsedByLevel[_memoryLevel]
	_memoryUsedByLevel[_memoryLevel] = collectgarbage("count")
	local _memoryUsed = _memoryUsedByLevel[_memoryLevel]
	local memoryInfos = tostring(math.ceil(_memoryUsed)) .. "ko("
	if (_memoryUsed - formerMemoryUsed >= 0) then
		memoryInfos = memoryInfos .. "+"
	end
	memoryInfos = memoryInfos .. tostring((_memoryUsed - formerMemoryUsed) * 1024) .. ")"
	local msg = "<"
	for i = 1, _memoryLevel do
		msg = msg .. "--"
	end
	msg = msg .. " end   '" .. tostring(methodName) .. "' - " .. memoryInfos
	log (msg, methodName, 4)
	_memoryLevel = _memoryLevel - 1
end

local function debug (msg, methodName)
	
end

local function warning (msg, methodName)
	luup.log(getFormatedMethodName(methodName) .. " WARNING: " .. msg, 2)
end

local function error (msg, methodName)
	luup.log(getFormatedMethodName(methodName) .. " ERROR: " .. msg, 1)
	-- Add to known errors
	History.add(os.time(), "ERROR", msg)
end

local function _getItemSummary (item)
	if (type(item) ~= "table") then
		return ""
	end
	--local summary = "Rule #" .. tostring(item._ruleId) .. " - " .. tostring(item.mainType) .. " #" .. tostring(item.id)
	--local summary = tostring(item.mainType) .. " #" .. tostring(item.id)
	local summary = "#" .. tostring(item.id) .. "(" .. tostring(item.mainType) .. ")"
	if (item.type ~= nil) then
		summary = summary .. " of type '" .. tostring(item.type) .. "'"
	end
	local separator = "with"
	if (item.mainType == "ActionGroup") then
		separator = "for"
	end
	if (item.event ~= nil) then
		summary = summary .. " " .. separator .. " event '" .. tostring(item.event) .. "'"
	end
	if (item.level ~= nil) then
		summary = summary .. " " .. separator .. " level '" .. tostring(item.level) .. "'"
	end
	if ((item.levels ~= nil) and (table.getn(item.levels) > 0)) then
		summary = summary .. " " .. separator .. " levels " .. tostring(json.encode(item.levels))
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
		Rule.addError(input._ruleId, "Check parameter", msg .. " - Input is not defined")
		isOk = false
	else
		for _, parameterAND in ipairs(parameters) do
			-- AND
			if (type(parameterAND) == "string") then
				if (input[parameterAND] == nil) then
					Rule.addError(input._ruleId, "Check parameter", msg .. " - Parameter '" .. parameterAND .. "' is not defined")
					isOk = false
				elseif ((type(input[parameterAND]) == "table") and (next(input[parameterAND]) == nil)) then
					Rule.addError(input._ruleId, "Check parameter", msg .. " - Parameter '" .. parameterAND .. "' is empty")
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
					Rule.addError(input._ruleId, "Check parameter", msg .. " - Not a single parameter in " .. json.encode(parameterAND) .. "' is defined or not empty")
					isOk = false
				end
			end
		end
	end
	if not isOk then
		input._parent = nil
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
-- Store
-- **************************************************

local _storePath

Store = {
	setPath = function (path)
		if (Store.checkPath(path)) then
			warning("Path is set to '" .. tostring(path) .. "'", "Store.setPath")
			_storePath = path
		else
		end
	end,

	getDefaultPath = function ()
		local lfs = require("lfs")
		local storePath = ""
		if (lfs.attributes("/tmp/log/cmh", "mode") == "directory") then
			-- Directory "/tmp/log/cmh" is stored on sda1 in Vera box
			storePath = "/tmp/log/cmh/"
		elseif (lfs.attributes("/tmp", "mode") == "directory") then
			-- Directory "/tmp" is stored in memory in Vera box (lost on reboot)
			storePath = "/tmp/"
		else
			-- Use current directory ("./etc/cmh-ludl" in openLuup)
			storePath = ""
		end
		log("Path to store datas : '" .. storePath .. "'", "Store.getDefaultPath")
		return storePath
	end,

	getPath = function ()
		if (_storePath == nil) then
			_storePath = Store.getDefaultPath()
		end
		return _storePath
	end,

	checkPath = function (path)
		local lfs = require("lfs")
		if (lfs.attributes(path, "mode") == "directory") then
			return true
		else
			warning("'" .. tostring(path) .. "' is not a valid folder", "Store.checkPath")
			return false
		end
	end
}

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

--RulesEngine.Tools.formatMessage
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
			local device = luup.devices[deviceId]
			if (device) then
				message = string.gsub(message, "#devicename#", device.description)
			end
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
-- RulesEngine.Events
-- **************************************************

local _indexItemsByEvent = {}
local _indexWatchedEvents = {}

Events = {
	registerItem = function (eventName, item)
		log(_getItemSummary(item) .. " - Register for event '" .. tostring(eventName) .. "'", "Events.registerItem", 3)
		if (_indexItemsByEvent[eventName] == nil) then
			_indexItemsByEvent[eventName] = {}
		end
		if not table.contains(_indexItemsByEvent[eventName], item) then
			table.insert(_indexItemsByEvent[eventName], item)
		else
			log(_getItemSummary(item) .. " - Do not register for event '" .. tostring(eventName) .. "' because it was already done", "Events.registerItem", 3)
		end
	end,

	getRegisteredItems = function (eventName)
		local registeredItems = _indexItemsByEvent[eventName]
		if (registeredItems == nil) then
			log("Event '" .. tostring(eventName) .. "' has no registered items", "Events.getRegisteredItems", 2)
		end
		return registeredItems
	end,

	removeRule = function (ruleId)
		local nbRemoved = 0
		for eventName, registeredItems in pairs(_indexItemsByEvent) do
			for i = #registeredItems, 1, -1 do
				if (registeredItems[i]._ruleId == ruleId) then
					nbRemoved = nbRemoved + 1
					table.remove(registeredItems, i)
				end
			end
		end
		log("Unregister events for rule #" .. tostring(ruleId) .. ": " .. tostring(nbRemoved) .. " event(s) unregistered", "Events.removeRule", 2)
	end,

	setIsWatched = function (eventName)
		_indexWatchedEvents[eventName] = true
	end,

	isWatched = function (eventName)
		return (_indexWatchedEvents[eventName] == true)
	end
}


-- **************************************************
-- RulesEngine.Event - Callbacks on event
-- **************************************************

Event = {
	-- Callback on device variable update (mios call)
	onDeviceVariableIsUpdated = function (lul_device, lul_service, lul_variable, lul_value_old, lul_value_new)
		local eventName = lul_service .. "-" .. lul_variable .. "-" .. tostring(lul_device)
		log("Event '" .. eventName .. "'(" .. luup.devices[lul_device].description .. ") - New value:'" .. tostring(lul_value_new) .. "'", "Event.onDeviceVariableIsUpdated")
		-- Check if engine is enabled
		if (not isEnabled()) then
			log("Engine is not enabled - Do nothing", "Event.onDeviceVariableIsUpdated")
			return false
		end
		local linkedConditions = Events.getRegisteredItems(eventName)
		if (linkedConditions == nil) then
			return false
		end
		-- Update status of the linked conditions for this event
		local context = {
			deviceId = lul_device,
			value = lul_value_new,
			lastUpdateTime = os.time()
		}
		for _, condition in ipairs(linkedConditions) do
			log("This event is linked to rule #" .. tostring(condition._ruleId) .. " and condition #" .. tostring(condition.id), "Event.onDeviceVariableIsUpdated", 2)
		end
		-- Update the status of the conditions (asynchronously to release the lock the fatest possible)
		ScheduledTasks.add(nil, Conditions.updateStatus, 0, { linkedConditions, { context = context } })
	end,

	-- Callback on timer triggered (mios call)
	onTimerIsTriggered = function (data)
		log("Event '" .. tostring(data) .. "'", "Event.onTimerIsTriggered")
		-- Check if engine is enabled
		if (not isEnabled()) then
			log("Engine is not enabled - Do nothing", "Event.onTimerIsTriggered")
			return false
		end
		local linkedConditions = Events.getRegisteredItems(data)
		if (linkedConditions == nil) then
			return false
		end
		-- Update status of the linked conditions for this event
		local context = {
			lastUpdateTime = os.time()
		}
		for _, condition in ipairs(linkedConditions) do
			log("This event is linked to rule #" .. tostring(condition._ruleId) .. " and condition #" .. tostring(condition.id), "Event.onTimerIsTriggered", 2)
			-- Update the context of the condition
			--condition.status = 1
			--condition._context.status     = 1
			--condition._context.lastUpdateTime = os.time()
		end
		-- Update the status of the conditions (asynchronously to release the lock the fatest possible)
		ScheduledTasks.add(nil, Conditions.updateStatus, 0, { linkedConditions, { context = context } })
	end,

	-- Callback on rule status update (inside call)
	onRuleStatusIsUpdated = function (watchedRuleId, newStatus)
		local eventName = "RuleStatus-" .. tostring(watchedRuleId)
		log("Event '" .. eventName .. "' - New status:'" .. tostring(newStatus) .. "'", "Event.onRuleStatusIsUpdated")
		-- Check if engine is enabled
		if (not isEnabled()) then
			log("Engine is not enabled - Do nothing", "Event.onRuleStatusIsUpdated")
			return false
		end
		local linkedConditions = Events.getRegisteredItems(eventName)
		if (linkedConditions == nil) then
			return false
		end
		-- Update status of the linked conditions for this event
		local context = {
			ruleId = watchedRuleId,
			ruleStatus = newStatus,
			lastUpdateTime = os.time()
		}
		for _, condition in ipairs(linkedConditions) do
			log("This event is linked to rule #" .. tostring(ruleId) .. " and condition #" .. tostring(condition.id), "Event.onRuleStatusIsUpdated")
			-- Update the context of the condition
			--condition._context.ruleStatus = newStatus
			--condition._context.lastUpdateTime = os.time()
			-- Update the status of the condition
			--Condition.updateStatus(condition, { context = context })
		end
		-- Update the status of the conditions (asynchronously to release the lock the fatest possible)
		ScheduledTasks.add(nil, Conditions.updateStatus, 0, { linkedConditions, { context = context } })
	end,

	-- Change debug level log
	onDebugValueIsUpdated = function (lul_device, lul_service, lul_variable, lul_value_old, lul_value_new)
		setVerbosity(lul_value_new)
	end
}


-- **************************************************
-- RulesEngine.ScheduledTasks
-- **************************************************

local _scheduledTasks = {}
local _nextWakeUps = {}
local _indexFunctionNames = {}

ScheduledTasks = {
	createIndexFunctionNames = function ()
		_indexFunctionNames[ tostring(Condition.updateStatus) ]  = "Condition.updateStatus"
		_indexFunctionNames[ tostring(Conditions.updateStatus) ] = "Conditions.updateStatus"
		_indexFunctionNames[ tostring(Rule.updateStatus) ]       = "Rule.updateStatus"
		_indexFunctionNames[ tostring(ActionGroup.execute) ]     = "ActionGroup.execute"
	end,

	getTaskInfo = function (task)
		local taskInfo = {
			timeout = os.date("%X", task.timeout),
			duration = _getDuration(task.delay),
			delay = task.delay,
			callback = (_indexFunctionNames[ tostring(task.callback) ] or "Unknown name"),
			attributes = task.attributes
		}
		return tostring(json.encode(taskInfo))
	end,

	purgeExpiredWakeUp = function ()
		local now = os.time()
		for i = #_nextWakeUps, 1, -1 do
			if (_nextWakeUps[i] <= now) then
				if _isLogLevel(4) then
					log("Wake-up #" .. tostring(i) .. "/" .. tostring(#_nextWakeUps) .. " at " .. os.date("%X", _nextWakeUps[i]) .. " (" .. tostring(_nextWakeUps[i]) .. ") is expired", "ScheduledTasks.purgeExpiredWakeUp", 4)
				end
				table.remove(_nextWakeUps, i)
			end
		end
	end,

	prepareNextWakeUp = function()
		if (table.getn(_scheduledTasks) == 0) then
			log("No more scheduled task", "ScheduledTasks.prepareNextWakeUp", 2)
			notifyTimelineUpdate()
			return false
		end
		local now = os.time()

		if ((#_nextWakeUps == 0) or (_scheduledTasks[1].timeout < _nextWakeUps[1])) then
			-- No scheduled wake-up yet or more recent task to scheduled
			table.insert(_nextWakeUps, 1, _scheduledTasks[1].timeout)
			local remainingSeconds = os.difftime(_nextWakeUps[1], now)
			if _isLogLevel(2) then
				log(
					"Now is " .. os.date("%X", now) .. " (" .. tostring(now) .. ")" ..
					" - Next wake-up in " .. tostring(remainingSeconds) .. " seconds at " .. os.date("%X", _nextWakeUps[1]) .. " - " .. tostring(#_scheduledTasks) .. " scheduled task(s)",
					"ScheduledTasks.prepareNextWakeUp", 2
				)
			elseif _isLogLevel(4) then
				log(
					"Now is " .. os.date("%X", now) .. " (" .. tostring(now) .. ")" ..
					" - Next wake-up in " .. tostring(remainingSeconds) .. " seconds at " .. os.date("%X", _nextWakeUps[1]) ..
					" for scheduled task: " .. ScheduledTasks.getTaskInfo(_scheduledTasks[1]),
					"ScheduledTasks.prepareNextWakeUp", 4
				)
			end
			notifyTimelineUpdate()
			luup.call_delay("RulesEngine.ScheduledTasks.execute", remainingSeconds, nil)
		else
			log("Doesn't change next wakeup : no scheduled task before current timeout", "ScheduledTasks.prepareNextWakeUp", 2)
		end
	end,

	-- Add a scheduled task
	add = function (attributes, callback, delay, callbackParams)
		local _newScheduledTask = {
			attributes = attributes or {},
			timeout = (os.time() + (tonumber(delay) or 0)),
			delay = (tonumber(delay) or 0),
			callback = callback,
			callbackParams = callbackParams
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
			log("Add task at index #" .. tostring(index) .. "/" .. tostring(#_scheduledTasks) .. ": " .. ScheduledTasks.getTaskInfo(_newScheduledTask), "ScheduledTasks.add", 4)
		end

		ScheduledTasks.prepareNextWakeUp()
	end,

	-- Remove all scheduled actions for given attributes
	remove = function (attributes)
		attributes = attributes or {}
		local msg = "Remove"
		if (attributes == nil) then
			msg = msg .. " all scheduled tasks"
		else
			msg = msg .. " scheduled tasks with " .. json.encode(attributes)
		end
		local nbTaskRemoved = 0
		for i = #_scheduledTasks, 1, -1 do
			local isMatching = true
			if (attributes ~= nil) then
				for name, value in pairs (attributes) do
					if ((_scheduledTasks[i].attributes[name] == nil) or (_scheduledTasks[i].attributes[name] ~= value)) then
						isMatching = false
						break
					end
				end
			end
			if (isMatching) then
				if (_scheduledTasks[i].attributes.isCritical) then
					log("Can not remove critical task #" .. tostring(i) .. "/" .. tostring(#_scheduledTasks) .. ": " .. ScheduledTasks.getTaskInfo(_scheduledTasks[i]), "ScheduledTasks.remove", 2)
				else
					if _isLogLevel(4) then
						log("Remove task #" .. tostring(i) .. "/" .. tostring(#_scheduledTasks) .. ": " .. ScheduledTasks.getTaskInfo(_scheduledTasks[i]), "ScheduledTasks.remove", 4)
					end
					table.remove(_scheduledTasks, i)
					nbTaskRemoved = nbTaskRemoved + 1
				end
			end
		end
		log(msg .. ": " .. tostring(nbTaskRemoved) .. " task(s) removed", "ScheduledTasks.remove", 3)
		ScheduledTasks.prepareNextWakeUp()
	end,

	-- Do all scheduled tasks that have expired
	execute = function ()
		local current = os.time()
		if _isLogLevel(2) then
			log("Now is " .. os.date("%X", os.time()) .. " (" .. tostring(os.time()) .. ") - Do sheduled tasks", "ScheduledTasks.execute", 2)
		end
		ScheduledTasks.purgeExpiredWakeUp()
		if (#_scheduledTasks > 0) then
			for i = #_scheduledTasks, 1, -1 do
				local scheduledTask = _scheduledTasks[i]
				if (scheduledTask.timeout <= current) then
					if _isLogLevel(4) then
						log("Timeout reached for task #" .. tostring(i) .. "/" .. tostring(#_scheduledTasks) .. ":\n" .. ScheduledTasks.getTaskInfo(scheduledTask), "ScheduledTasks.execute", 4)
					end
					table.remove(_scheduledTasks, i)
					if (type(scheduledTask.callback) == "function") then
						scheduledTask.callback(unpack(scheduledTask.callbackParams))
					else
						error("callback is not a function", "ScheduledTasks.execute")
					end
				end
			end
			--_nextScheduledTimeout = -1
			if (table.getn(_scheduledTasks) > 0) then
				ScheduledTasks.prepareNextWakeUp()
			else
				log("There's no more sheduled task to do", "ScheduledTasks.execute", 2)
				notifyTimelineUpdate()
			end
		else
			log("There's no sheduled task to do", "ScheduledTasks.execute", 2)
			notifyTimelineUpdate()
		end
	end,

	get = function (attributes)
		local scheduledTasks = {}
		for _, scheduledTask in ipairs(_scheduledTasks) do
			local isMatching = true
			if (attributes ~= nil) then
				for name, value in pairs (attributes) do
					if (scheduledTask.attributes[name] ~= value) then
						isMatching = false
						break
					end
				end
			end
			if (isMatching) then
				table.insert(scheduledTasks, scheduledTask)
			end
		end
		return scheduledTasks
	end
}

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

Params = {}

local _addParam = {}
setmetatable(_addParam, {
	__index = function(t, item, conditionParamName)
		log("SETTING WARNING - Param type '" .. tostring(conditionParamName) .. "' is unknown", "getParam")
		return function ()
		end
	end
})
do
	_addParam["property_auto_untrip"] = function (item, param)
		local autoUntripInterval = _getIntervalInSeconds(param.autoUntripInterval, param.unit)
		log(_getItemSummary(item) .. " - Add 'autoUntripInterval': '" .. tostring(autoUntripInterval) .. "'", "addParams", 4)
		item.autoUntripInterval = autoUntripInterval
	end

	_addParam["condition_param_since"] = function (item, param)
		local sinceInterval = _getIntervalInSeconds(param.sinceInterval, param.unit)
		log(_getItemSummary(item) .. " - Add 'sinceInterval': '" .. tostring(sinceInterval) .. "'", "addParams", 4)
		item.sinceInterval = sinceInterval
	end

	_addParam["condition_param_level"] = function (item, param)
		local level = tonumber(param.level)
		if ((level ~= nil) and (level >= 0)) then
			log(_getItemSummary(item) .. " - Add 'level': '" .. tostring(level) .. "'", "addParams", 4)
			item.level = level
		else
			log(_getItemSummary(item) .. " - Value '" .. tostring(level) .. "' is not authorized for param 'level'", "addParams", 1)
		end
	end

	_addParam["action_param_level"] = function (item, param)
		local level = tonumber(param.level)
		if ((level ~= nil) and (level >= 0)) then
			if (item.levels == nil) then
				item.levels = {}
			end
			log(_getItemSummary(item) .. " - Add '" .. tostring(level) .. "' to 'levels'", "addParams", 4)
			table.insert(item.levels, level)
		else
			log(_getItemSummary(item) .. " - Value '" .. tostring(level) .. "' is not authorized for param 'level'", "addParams", 1)
		end
	end

	_addParam["action_param_delay"] = function (item, param)
		local delayInterval = _getIntervalInSeconds(param.delayInterval, param.unit)
		log(_getItemSummary(item) .. " - Add 'delayInterval': '" .. tostring(delayInterval) .. "'", "addParams", 4)
		item.delayInterval = delayInterval
	end

	_addParam["action_param_critical"] = function (item, param) 
		local isCritical = (param.isCritical == "TRUE")
		log(_getItemSummary(item) .. " - Add 'isCritical': '" .. tostring(isCritical) .. "'", "addParams", 4)
		item.isCritical = isCritical
	end
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
			log("Rule #" .. tostring(ruleId) .. " - Add property '" .. tostring(propertyName) .. "': " .. tostring(json.encode(property)), "initProperties", 2)
		end
	end
	return result
end

-- **************************************************
-- Condition (rule condition, action condition)
-- **************************************************

local function _getDeviceIdsFromCriterias (criterias)
	local deviceIds = {}
	if (type(criterias) ~= "table") then
		return {}
	end
	local isMatching
	for deviceId, device in pairs(luup.devices) do
		isMatching = true
		-- Filter on id
		if (tonumber(criterias.deviceId) and (deviceId ~= tonumber(criterias.deviceId))) then
			isMatching = false
		end
		-- Filter on room
		if (tonumber(criterias.roomId) and (device.room_num ~= tonumber(criterias.roomId))) then
			isMatching = false
		end
		-- Filter on type
		if (criterias.deviceType and (device.device_type ~= criterias.deviceType)) then
			isMatching = false
		end
		-- Filter on category
		if (criterias.category) then
			local tmpCategory = string.split(criterias.category, ",")
			if (tonumber(tmpCategory[1]) and (device.category_num ~= tonumber(tmpCategory[1]))) then
				isMatching = false
			end
			if (tonumber(tmpCategory[2]) and (device.subcategory_num ~= tonumber(tmpCategory[2]))) then
				isMatching = false
			end
		end
		if (isMatching) then
			table.insert(deviceIds, deviceId)
		end
	end
	log("Retrieve ids " .. json.encode(deviceIds) .. " for criterias " .. json.encode(criterias), "getDeviceIdsFromCriterias", 4)
	return deviceIds
end

local function _getDeviceIds (item)
	local deviceIds = {}
	if ((type(item) ~= "table") or (type(item.device) ~= "table")) then
		return {}
	end
	if (item.device.type == "device") then
		item.device.type = nil
		item.device.mutation = nil
		table.append(deviceIds, _getDeviceIdsFromCriterias(item.device))
	else
		for _, device in pairs(item.device) do
			if ((type(device) == "table") and (device.type == "device")) then
				device.type = nil
				device.mutation = nil
				table.append(deviceIds,_getDeviceIdsFromCriterias(device), true)
			end
		end
	end
	log(_getItemSummary(item) .. " - Retrieve ids " .. json.encode(deviceIds), "getDeviceIdsFromParam", 4)
	return deviceIds
end

-- **************************************************
-- ConditionTypes
-- **************************************************

local ConditionTypes = {}
setmetatable(ConditionTypes, {
	__index = function(t, conditionTypeName)
		return ConditionTypes["unknown"]
	end
})
do
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
		init = function( condition, ruleContext )
			-- Get properties from mutation
			if ( condition.mutation ~= nil ) then
				if ( ( condition.service == nil ) and ( condition.mutation.service ~= nil ) ) then
					condition.service = condition.mutation.service
				end
				if ( ( condition.variable == nil ) and ( condition.mutation.variable ~= nil ) ) then
					condition.variable = condition.mutation.variable
				end
				if ( ( condition.operator == nil ) and ( condition.mutation.operator ~= nil ) ) then
					condition.operator = condition.mutation.operator
				end
				if ( ( condition.value == nil ) and ( condition.mutation.value ~= nil ) ) then
					condition.value = condition.mutation.value
				end
				condition.mutation = nil
			end

			-- Main type
			if (condition.action ~= nil) then
				condition.mainType = "External"
			else
				condition.mainType = "Trigger"
			end

			-- Multi-state (serviceStateTable in D_*.json)
			-- Armed;EQ;1|Tripped;EQ;1
			if ( condition.variable ) then
				local multiVariables = string.split( condition.variable, "|" )
				if ( #multiVariables > 1 ) then
					-- List of variables - Transform condition into a group of conditions
					log( _getItemSummary( condition ) .. " - Several variables : transform into a group of conditions", "Condition.init", 4 )
					local parent, actions = condition._parent, condition.actions
					condition._parent, condition.actions = nil, nil
					local newConditionTemplate = table.extend( {}, condition )
					--
					condition._parent = parent
					condition.actions = actions
					condition.mainType = "ConditionGroup"
					condition.type = "list_with_operator_condition"
					condition.operator = "AND"
					condition.items = {}
					condition.isMainConditionValue = true
					--
					for i, multiVariable in ipairs( multiVariables ) do
						local params = string.split( multiVariable, ";" )
						local newCondition = table.extend( {}, newConditionTemplate )
						newCondition.id = condition.id .. "." .. tostring( i )
						newCondition._parent = condition
						newCondition.variable = params[1]
						newCondition.operator = params[2]
						newCondition.value    = params[3]
						newCondition.isChildConditionValue = true
						log( "Create " .. _getItemSummary( newCondition ), "Condition.init", 4 )
						table.insert( condition.items, newCondition )
						-- Now, process device ids
						ConditionTypes["condition_value"].init( newCondition, ruleContext )
					end
					return
				end
			end

			-- Get device id(s)
			if ( type( condition.device ) == "table" ) then
				local deviceIds = _getDeviceIds( condition )
				condition.device = nil
				if ( #deviceIds == 1 ) then
					-- Just one device
					condition.deviceId = deviceIds[1]
				else
					-- List of devices - Transform condition into a group of conditions
					log( _getItemSummary( condition ) .. " - Several devices : transform into a group of conditions", "Condition.init", 4 )
					local parent, actions = condition._parent, condition.actions
					condition._parent, condition.actions = nil, nil
					local newConditionTemplate = table.extend( {}, condition )
					--
					condition._parent = parent
					condition.actions = actions
					condition.mainType = "ConditionGroup"
					condition.type = "list_with_operator_condition"
					condition.operator = "OR"
					condition.items = {}
					condition.isMainConditionValue = true
					-- 
					for i, deviceId in ipairs( deviceIds ) do
						local newCondition = table.extend( {}, newConditionTemplate )
						newCondition.id = condition.id .. "." .. tostring( i )
						newCondition._parent = condition
						newCondition.deviceId = deviceId
						newCondition.isChildConditionValue = true
						log( "Create " .. _getItemSummary( newCondition ), "Condition.init", 4 )
						table.insert( condition.items, newCondition )
						--if ( ruleContext ~= nil ) then
						--	ruleContext.conditions[ newCondition.id ] = newCondition._context
						--end
					end
					--ConditionTypes[ "list_with_operator_condition" ].init( condition )
					--Condition.init( conditions, condition._ruleId, parent )
				end
			else
				condition.deviceId = tonumber( condition.deviceId )
			end
		end,

		check = function( condition )
			if not _checkParameters( condition, { "deviceId", "service", "variable" } ) then
				return false
			end
			-- Check if device exists
			local luDevice = luup.devices[ condition.deviceId ]
			if ( luDevice == nil ) then
				Rule.addError( condition._ruleId, "Init condition", _getItemSummary( condition ) .. " - Device #" .. tostring( condition.deviceId ) .. " is unknown" )
				-- TODO : check if device exposes the variable ?
				return false
			end
			return true
		end,

		start = function( condition )
			local msg = _getItemSummary( condition )
			if ( condition.action == nil ) then
				-- Register for event service/variable/device
				Events.registerItem( condition.service .. "-" .. condition.variable .. "-" .. tostring( condition.deviceId ), condition )
				-- Register (and eventually watch) for event service/variable (optimisation)
				if not Events.isWatched(condition.service .. "-" .. condition.variable) then
					log(msg .. " - Watch device #" .. tostring(condition.deviceId) .. "(" .. luup.devices[condition.deviceId].description .. ")", "ConditionValue.start", 3)
					luup.variable_watch("RulesEngine.Event.onDeviceVariableIsUpdated", condition.service, condition.variable, nil)
					Events.setIsWatched(condition.service .. "-" .. condition.variable)
				else
					log(msg .. " - Watch device #" .. tostring(condition.deviceId) .. "(" .. luup.devices[condition.deviceId].description .. ") (watch already registered for this service/variable)", "Condition.start", 3)
				end
			else
				log(msg .. " - Can not watch external condition", "Condition.start", 3)
			end
		end,

		updateStatus = function (condition, params)
			local msg = _getItemSummary(condition)
			local context = condition._context
			local deviceId = condition.deviceId
			local params = params or {}

			-- Condition of type 'value' / 'value-' / 'value+' / 'value<>'
			msg = msg .. " for device #" .. tostring(deviceId) .. "(" .. luup.devices[deviceId].description .. ")" .. " - '" .. tostring(condition.service)
			if (condition.action ~= nil) then
				msg = msg .. "-" .. condition.action
			end
			msg = msg .. "-" ..  condition.variable .. "'"

			-- Update known value (if needed)
			if (condition.mainType == "Trigger") then
				if (context.lastUpdateTime == 0) then
					-- The value has not yet been updated
					context.value, context.lastUpdateTime = Variable.getUnknown(deviceId, condition.service, condition.variable)
					msg = msg .. " (value retrieved, last change " .. tostring(os.difftime(os.time(), context.lastUpdateTime)) .. "s ago)"
				end
			else
				-- Update value if too old (not automatically updated because not a trigger)
				--if (os.difftime(os.time(), context.lastUpdateTime) > 0) then
				if (os.difftime(os.time(), context.lastUpdateTime) > 1) then
					msg = msg .. " (value retrieved)"
					if (condition.action == nil) then
						context.value, context.lastUpdateTime = Variable.getUnknown(deviceId, condition.service, condition.variable)
					else
						local resultCode, resultString, job, returnArguments = luup.call_action(condition.service, condition.action, condition.arguments, deviceId)
						context.value = returnArguments[ condition.variable ]
						context.lastUpdateTime = os.time()
					end
				end
			end

			-- Status update
			local status = 1
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
				local conditionValue = tonumber(condition.value) or condition.value
				local contextValue   = tonumber(context.value)   or context.value
				log("condition.operator:" .. tostring(condition.operator) .. ", conditionValue:" .. tostring(conditionValue) .. ", contextValue:" .. tostring(contextValue), "ConditionValue.updateStatus", 3)
				if ((context.value == nil)
					or (OPERATORS[condition.operator] == nil)
					or (type(contextValue) ~= type(conditionValue))
					or ((condition.operator == "EQ") and (contextValue ~= conditionValue))
					or (((condition.operator == "LT") or (condition.operator == "LTE")) and (contextValue > conditionValue))
					or (((condition.operator == "GT") or (condition.operator == "GTE")) and (contextValue < conditionValue))
					or (((condition.operator == "NEQ") or (condition.operator == "LT") or (condition.operator == "GT")) and (contextValue == conditionValue))
					or ((condition.operator == "LIKE") and (string.match(context.value, condition.value) == nil))
					or ((condition.operator == "NOTLIKE") and (string.match(context.value, condition.value) ~= nil))
				) then
					-- Threshold is not respected
					msg = msg .. " - Does not respect the condition '{value:" .. tostring(context.value) .. "} " .. OPERATORS[condition.operator] .. " " .. tostring(condition.value) .. "'"
					status = 0
				else
					msg = msg .. " - Respects the condition '{value:" .. tostring(context.value) .. "} " .. OPERATORS[condition.operator] .. " " .. tostring(condition.value) .. "'"
				end
			else
				-- No specific value condition on that condition
				msg = msg .. " - The condition has no value condition"
			end

			-- Check since interval if exists
			local currentInterval
			local hasToRemoveFormerScheduledTasks, hasToCheckConditionStatusLater = false, false
			if (condition.sinceInterval ~= nil) then
				if (status == 1) then
					currentInterval = os.difftime(os.time(), context.lastUpdateTime)
					if (currentInterval < condition.sinceInterval) then
						status = 0
						msg = msg .. " but not since " .. tostring(condition.sinceInterval) .. " seconds"
						-- Have to check later again the status of the condition
						if not condition.noPropagation then
							hasToRemoveFormerScheduledTasks = true
							hasToCheckConditionStatusLater = true
							msg = msg .. " - Check condition status later" 
						end
					else
						msg = msg .. " since " .. tostring(condition.sinceInterval) .. " seconds"
					end
				else
					hasToRemoveFormerScheduledTasks = true
				end
			end

			log(msg, "ConditionValue.updateStatus", 3)
			if hasToRemoveFormerScheduledTasks then
				log(_getItemSummary(condition) .. " has a 'since' condition : remove its former schedule if exist", "Condition.updateStatus", 4)
				--ScheduledTasks.remove({ ruleId = condition._ruleId, condition = tostring(condition) })
				ScheduledTasks.remove({ condition = tostring(condition) })
			end
			if hasToCheckConditionStatusLater then
				local remainingSeconds = condition.sinceInterval - currentInterval
				log(_getItemSummary(condition) .. " - Check condition status in " .. tostring(remainingSeconds) .. " seconds", "Condition.updateStatus", 4)
				ScheduledTasks.add(
					{ ruleId = condition._ruleId, conditionId = condition.id, condition = tostring(condition) },
					Condition.updateStatus, remainingSeconds, { condition }
				)
			end

			params.lastUpdateTime = context.lastUpdateTime
			params.maxInterval    = condition.sinceInterval
			local hasStatusChanged, hasParentStatusChanged = Condition.setStatus(condition, status, params )

			-- Report the change of the child condition to the parent if needed
			if (
				hasStatusChanged and not hasParentStatusChanged
				and condition.isChildConditionValue and condition._parent.isMainConditionValue
				and (condition._parent.actions ~= nil)
			) then
				if ((status == 1) and ActionGroups.isMatchingEvent(condition._parent.actions, "conditionStart")) then
					ActionGroups.execute(condition._parent.actions, condition._ruleId, "conditionStart", nil, params )
				elseif ((status == 0) and ActionGroups.isMatchingEvent(condition._parent.actions, "conditionEnd")) then
					ActionGroups.execute(condition._parent.actions, condition._ruleId, "conditionEnd", nil, params )
				end
			end

			return hasStatusChanged
		end

	}

	-- Condition of type 'rule'
	ConditionTypes["condition_rule"] = {
		init = function (condition)
			condition.mainType = "Trigger"
			condition.ruleId = tonumber(condition.ruleId)
			condition.ruleStatus = tonumber(condition.ruleStatus)
		end,

		check = function (condition)
			if not _checkParameters(condition, { "ruleId", "ruleStatus"}) then
				return false
			else
				-- If the rule is after in the XML file, the id does not exist for the moment
				--[[
				if not Rules.get(condition.ruleId) then
					error(_getItemSummary(condition) .. " - Rule #" .. tostring(condition.ruleId) .. "' is unknown", "ConditionRule.check")
					return false
				end
				--]]
			end
			return true
		end,

		start = function (condition)
			-- Register the watch of the rule status
			log(_getItemSummary(condition) .. " - Watch status of rule #" .. tostring(condition.ruleId), "ConditionRule.start", 3)
			Events.registerItem("RuleStatus-" .. tostring(condition.ruleId), condition)
		end,

		updateStatus = function (condition, params)
			local msg = _getItemSummary(condition) .. " for rule #" .. tostring(condition.ruleId)
			local context = condition._context
			local status = 1

			if (context.lastUpdateTime == 0) then
				context.ruleStatus = Rule.getStatus(condition.ruleId)
				context.lastUpdateTime = os.time()
			end
			if (context.ruleStatus ~= condition.ruleStatus) then
				msg = msg .. " - Does not respect the condition '{status:" .. tostring(context.ruleStatus) .. "}==" ..tostring(condition.ruleStatus) .. "'"
				status = 0
			else
				msg = msg .. " - Respects the condition '{status:" .. tostring(context.ruleStatus) .. "}==" ..tostring(condition.ruleStatus) .. "'"
				status = 1
			end
			log(msg, "ConditionRule.updateStatus", 3)

			return Condition.setStatus(condition, status, params)
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
			elseif (type(condition.daysOfMonth) == "string") then
				condition.timerType = 3
				condition.days = string.split(condition.daysOfMonth, ",")
			end
			if ((condition.daysOfWeek == nil) and (condition.daysOfMonth == nil)) then
				condition.timerType = 2
				condition.days = {"1","2","3","4","5","6","7"}
			end
			condition.mainType = "Trigger"
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
					Events.registerItem(eventName, condition)
					if not Events.isWatched(eventName) then
						log(msg .. " - Starts timer '" .. eventName .. "'", "ConditionTime.start", 3)
						luup.call_timer("RulesEngine.Event.onTimerIsTriggered", condition.timerType, time, day, eventName)
						Events.setIsWatched(eventName)
					else
						log(msg .. " - Timer '" .. eventName .. "' is already started", "ConditionTime.start", 3)
					end
				end
			end
		end,

		updateStatus = function (condition)
			local msg = _getItemSummary(condition)
			local status = 1
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
				local msgDay = "of " .. typeOfDay .. " '" .. tostring(currentDay) .. "'"
				local msgTimeBetween = "between '" .. tostring(condition.time1) .. "' and '" .. tostring(condition.time2) .. "'"
				if (condition.time1 <= condition.time2) then
					-- The bounds are on the same day
					if not table.contains(condition.days, currentDay) then
						msg = msg .. " - Current day " .. msgDay .. " is not in " .. tostring(json.encode(condition.days))
						status = 0
					elseif ((currentTime < condition.time1) or (currentTime > condition.time2)) then
						msg = msg .. " - Current time '" .. tostring(currentTime) .. "' is not " .. msgTimeBetween
						status = 0
					else
						msg = msg .. " - Current day " .. msgDay .. " is in " .. tostring(json.encode(condition.days)) .. " and current time '" .. tostring(currentTime) .. "' is " .. msgTimeBetween
					end
				else
					-- The bounds are on 2 days
					if table.contains(condition.days, currentDay) then
						-- D
						if (currentTime < condition.time1) then
							msg = msg .. " - Current time '" .. tostring(currentTime) .. "' is not " .. msgTimeBetween
							status = 0
						end
					elseif table.contains(condition.days, previousDay) then
						-- D+1
						if (currentTime < condition.time2) then
							msg = msg .. " - Current time '" .. tostring(currentTime) .. "' is not between '" .. tostring(condition.time1) .. "' and '" .. tostring(condition.time2) .. "' (D+1)"
							status = 0
						else
							msg = msg .. " - Current time '" .. tostring(currentTime) .. "' is between '" .. tostring(condition.time1) .. "' and '" .. tostring(condition.time2) .. "' (D+1)"
						end
					else
						msg = msg .. " - Current day " .. msgDay .. " is not in " .. tostring(json.encode(condition.days))
						status = 0
					end
				end
			else
				hasToTriggerOff = true
				local currentTime = os.date('%H:%M:%S', os.time())
				if not table.contains(condition.days, currentDay) then
					msg = msg .. " - Current day of " .. typeOfDay .. " '" .. tostring(currentDay) .. "' is not in " .. tostring(json.encode(condition.days))
					status = 0
				elseif (currentTime ~= condition.time) then
					msg = msg .. " - Current time '" .. tostring(currentTime) .. "' is not equal to '" .. tostring(condition.time) .. "'"
					status = 0
				end
			end

			log(msg, "ConditionTime.updateStatus", 3)

			if Condition.setStatus(condition, status) then
				luup.call_delay("RulesEngine.Rule.updateStatus", 0, condition._ruleId)
			end

			-- TODO time of untrip (like motion sensor)
			if (hasToTriggerOff and (status == 1)) then
				if Condition.setStatus(condition, 0) then
					luup.call_delay("RulesEngine.Rule.updateStatus", 0, condition._ruleId)
				end
			end

			return true
		end
	}

	-- Group of conditions with an operator (OR/AND)
	ConditionTypes["list_with_operators_condition"] = {
		init = function (condition, ruleContext)
			condition.mainType = "ConditionGroup"
			if ((condition.operator == nil) and (condition.operators == nil)) then
				condition.operator = "OR"
			end
			for i, item in ipairs(condition.items) do
				if (item.type ~= "empty") then
					item.id = condition.id .. "." .. tostring(i)
					Condition.init(item, condition._ruleId, condition, ruleContext)
				end
			end
			for i = #(condition.items), 1, -1 do
				if (condition.items[i].type == "empty") then
					log("Condition #" .. condition.id .. "." .. tostring(i) .. " is empty: remove it", "Condition.init", 4)
					table.remove(condition.items, i)
				end
			end
		end,

		check = function (condition)
			for i, item in ipairs(condition.items) do
				if not Condition.checkSettings(item) then
					return false
				end
			end
			return true
		end,

		start = function (condition)
			for i, item in ipairs(condition.items) do
				Condition.start(item)
			end
		end,

		updateStatus = function (condition, params)
			local params = params or {}
			local status, level = 0, 0
			local item, itemStatus, itemLevel
			local operator
			local isActive = false
			local msg = ""

			if (#(condition.items) > 1) then

				item = condition.items[1]
				itemStatus = Condition.getStatus(item)
				isActive = (itemStatus == 1)
				if (itemStatus == 1) then
					itemLevel  = Condition.getLevel(item)
					level = itemLevel
					msg = "{#" .. item.id .. ":" .. tostring(itemStatus) .. "/" .. tostring(itemLevel) .. "}"
				else
					msg = "{#" .. item.id .. ":" .. tostring(itemStatus) .. "}"
				end

				for i = 2, #(condition.items) do
					operator = condition.operator or condition.operators[i - 1] or "OR"
					item = condition.items[i]
					itemStatus = Condition.getStatus(item)
					if (operator == "AND") then
						isActive = isActive and (itemStatus == 1)
					else
						isActive = isActive or (itemStatus == 1)
					end
					msg = "(" .. msg .. " " .. tostring(operator) .. " {#" .. item.id .. ":" .. tostring(itemStatus)
					if (itemStatus == 1) then
						itemLevel  = Condition.getLevel(item)
						if (itemLevel > level) then
							level = itemLevel
						end
						msg = msg .. "/" .. tostring(itemLevel)
					end
					msg = msg .. "}) => " .. tostring(isActive) .. ")"
				end
				if isActive then
					status = 1
				else
					status = 0
					level = 0
				end
			elseif (#(condition.items) == 1) then
				status = Condition.getStatus(condition.items[1])
				level  = Condition.getLevel(condition.items[1])
			end

			log(_getItemSummary(condition) .. " - " .. msg, "Condition.updateStatus", 4)
			-- TODO  level ?
			if (status == 0) then
				level = 0
			end
			condition.level = level
			--params.lastUpdateTime = context.lastUpdateTime
			return Condition.setStatus(condition, status, params )
		end
	}
	ConditionTypes["list_with_operator_condition"] = ConditionTypes["list_with_operators_condition"]

	-- Sequence of conditions
	ConditionTypes["condition_sequence"] = {
		init = function (sequence, ruleContext)
			sequence.mainType = "ConditionSequence"
			if (sequence.items ~= nil) then
				-- Init items of the sequence
				for i, item in ipairs(sequence.items) do
					item.id = sequence.id .. "." .. tostring(i)
					Condition.init(item, sequence._ruleId, sequence, ruleContext)
				end
				-- Report the minimum interval between the two conditions on the second condition
				for i = #sequence.items, 1, -1 do
					if (sequence.items[i].mainType == "SequenceSeparator") then
						if (sequence.items[i + 1] ~= nil) then
							sequence.items[i + 1].sequenceInterval = (sequence.items[i + 1].sequenceInterval or 0) + sequence.items[i].sequenceInterval
						end
						table.remove(sequence.items, i)
					end
				end
			end
		end,

		check = function (sequence)
			if (sequence.items ~= nil) then
				for i, item in ipairs(sequence.items) do
					if ((item.condition ~= nil) and not Condition.checkSettings(item.condition)) then
						return false
					end
				end
			end
			return true
		end,

		start = function (sequence)
			if (sequence.items ~= nil) then
				for i, item in ipairs(sequence.items) do
					if (item.condition ~= nil) then
						Condition.start(item.condition)
					end
				end
			end
		end,

		updateStatus = function (sequence, params)
			if (sequence.items == nil) then
				return
			end
			local params = params or {}
			local status, level = 0, 0
			local item, condition, conditionStatus, lastConditionStatusUpdateTime, conditionLevel
			local isActive, lastStatusUpdateTime = true, 0
			local msg = ""

			if (#(sequence.items) > 0) then
				for i, item in ipairs(sequence.items) do
					condition = item.condition
					if ((item.mainType == "SequenceItem") and (condition ~= nil)) then
						conditionStatus, lastConditionStatusUpdateTime = Condition.getStatus(condition)
						isActive = isActive and (conditionStatus == 1)
						if (i > 1) then
							msg = "(" .. msg
							if (isActive) then
								-- Check if condition is after previous condition
								local minimunStatusUpdateTime = lastStatusUpdateTime + (item.sequenceInterval or 0)
								if (os.difftime(lastConditionStatusUpdateTime, minimunStatusUpdateTime) < 0) then
									isActive = false
									-- TODO : a timer to activate when it becomes true ?
								end
							end
							msg = msg .. " after " .. tostring(item.sequenceInterval) .. "s "
						end

						msg = msg .. "{#" .. condition.id .. ":" .. tostring(conditionStatus)
						if (conditionStatus == 1) then
							conditionLevel = Condition.getLevel(condition)
							if (conditionLevel > level) then
								level = conditionLevel
							end
							msg = msg .. ":" .. tostring(conditionLevel)
						end
						msg = msg .. "}"

						if (i > 1) then
							msg = msg .. " => " .. tostring(isActive) .. ")"
						end

						lastStatusUpdateTime = lastConditionStatusUpdateTime
					end
				end
				if isActive then
					status = 1
				else
					status = 0
					level = 0
				end
			end

			log(_getItemSummary(sequence) .. " - " .. msg, "Condition.updateStatus", 4)
			if (status == 0) then
				level = 0
			end
			-- TODO  level ?
			sequence._context.level = level
			--params.lastUpdateTime = context.lastUpdateTime
			return Condition.setStatus(sequence, status, params )
		end
	}
	ConditionTypes["condition_sequence_separator"] = {
		init = function (condition, ruleContext)
			condition.mainType = "SequenceSeparator"
			condition.sequenceInterval = _getIntervalInSeconds(condition.sequenceInterval, condition.unit)
		end
	}
	ConditionTypes["condition_sequence_item"] = {
		init = function (sequenceItem, ruleContext)
			sequenceItem.mainType = "SequenceItem"
			if (sequenceItem.condition ~= nil) then
				sequenceItem.condition.id = sequenceItem.id .. ".1"
				Condition.init(sequenceItem.condition, sequenceItem._ruleId, sequenceItem._parent, ruleContext)
			end
		end
	}

end

-- **************************************************
-- RulesEngine.Condition
--  Conditions of a rule
--  Conditions of a group of actions
-- **************************************************

Condition = {
	init = function (condition, ruleId, parent, ruleContext)
		--log("Init condition " .. json.encode(condition), "Condition.init", 4)
		if ((condition == nil) or (type(condition) ~= "table")) then
			return
		end
		local id
		if (parent == nil) then
			-- Should not occur
			id = tostring(ruleId) .. ".1"
		else
			id = tostring(parent.id) .. ".1"
		end
		condition.mainType = "Condition"
		condition.type = condition.type or ""
		if (condition.id == nil) then
			condition.id = id
		end
		condition._ruleId = ruleId
		condition._parent = parent -- (pointer on an object)
		-- Context
		condition._context = {
			status = -1,
			lastStatusUpdateTime = 0,
			lastUpdateTime = 0
		}
		log(_getItemSummary(condition) .. " - Init condition", "Condition.init", 3)
		-- Params
		if (condition.params ~= nil) then
			log(_getItemSummary(condition) .. " - Add parameters of the condition", "Condition.init", 4)
			_addParams(condition, condition.params)
			condition.params = nil
		end
		condition.params = nil
		-- Specific initialisation for this type of condition
		ConditionTypes[condition.type].init(condition, ruleContext)
		-- Actions of the condition
		if (condition.actions ~= nil) then
			log(_getItemSummary(condition) .. " - Init the groups of actions of the condition", "Condition.init", 4)
			--condition.actions.id = condition.id
			ActionGroups.init(condition.actions, condition._ruleId, condition)
		end
		-- Add a pointer on the context of the condition in the context of the rule
		if (ruleContext ~= nil) then
			ruleContext.conditions[condition.id] = condition._context
		end
	end,

	checkSettings = function (condition)
		if (condition == nil) then
			return true
		end
		log(_getItemSummary(condition) .. " - Check settings", "Condition.checkSettings", 4)
		if (condition == nil) then
			return false
		end
		return ConditionTypes[condition.type].check(condition)
	end,

	start = function (condition)
		log(_getItemSummary(condition) .. " - Start", "Condition.start", 4)
		ConditionTypes[condition.type].start(condition)
	end,

	-- Update the status of the condition
	updateStatus = function(condition, params)
		msg = _getItemSummary(condition) .. " - Update status"
		if (params ~= nil) then
			msg = msg .. " with params " .. json.encode(params)
			if (params.context ~= nil) then
				table.extend(condition._context, params.context)
				msg = msg .. " (contains extended context)"
			end
		end
		log(msg, "Condition.updateStatus", 4)
		return ConditionTypes[condition.type].updateStatus(condition, params)
	end,

	-- Modify status of the condition
	setStatus = function (condition, status, params)
		local msg = _getItemSummary(condition)
		local hasStatusChanged, hasParentStatusChanged = false, false
		local params = params or {}
		local elapsedTime = os.difftime(os.time(), math.max((condition._context.lastUpdateTime or 0), (params.lastUpdateTime or 0))) -- If elapsedTime > 0, the change could come from a reload
		if ((condition._context.status < 1) and (status == 1)) then
			-- The condition has just been activated
			log(msg .. " is now active (since " .. tostring(elapsedTime) .. "s)", "Condition.setStatus", 3)
			condition._context.status = 1
			condition._context.lastStatusUpdateTime = os.time()
			hasStatusChanged = true
			if (condition.actions ~= nil) then
				--ActionGroups.execute(condition.actions, condition._ruleId, "conditionStart", condition.level, params )
				ActionGroups.execute(condition.actions, condition._ruleId, "conditionStart", nil, params )
			end
		elseif ((condition._context.status == 1) and (status == 0)) then
			-- The condition has just been deactivated
			log(msg .. " is now inactive (since " .. tostring(elapsedTime) .. "s)", "Condition.setStatus", 3)
			condition._context.status = 0
			condition._context.lastStatusUpdateTime = os.time()
			hasStatusChanged = true
			if (condition.actions ~= nil) then
				--ActionGroups.execute(condition.actions, condition._ruleId, "conditionEnd", condition.level, params )
				ActionGroups.execute(condition.actions, condition._ruleId, "conditionEnd", nil, params )
			end
		elseif (condition._context.status == 1) then
			-- The condition is still active
			log(msg .. " is still active", "Condition.setStatus", 3)
		elseif (condition._context.status == 0) then
			-- The condition is still inactive
			log(msg .. " is still inactive", "Condition.setStatus", 3)
		else
			condition._context.status = 0
			log(msg .. " is inactive", "Condition.setStatus", 3)
		end

		if (hasStatusChanged and not params.noPropagation and (condition._parent ~= nil)) then
			local parent = condition._parent
			-- Update the parent of the condition
			log(msg .. " - Update parent " .. _getItemSummary(parent), "Condition.setStatus", 3)
			if (parent.mainType == "Rule") then
				hasParentStatusChanged = Rule.updateStatus(parent)
			elseif (parent.mainType ~= "ActionGroup") then
				hasParentStatusChanged = Condition.updateStatus(parent, { lastUpdateTime = condition._context.lastStatusUpdateTime, context = params.context })
			else
				log(msg .. " - No update for parent " .. parent.mainType, "Condition.setStatus", 3)
			end
		end

		return hasStatusChanged, hasParentStatusChanged
	end,

	getStatus = function (condition)
		--log(_getItemSummary(condition) .. " - Get status", "Condition.getStatus", 4)

		local context = condition._context
		if (condition.mainType == "Trigger") then
			if (context.status == -1) then
				Condition.updateStatus(condition, { noPropagation = true })
			end
		elseif (os.difftime(os.time(), math.max(context.lastUpdateTime, context.lastStatusUpdateTime)) > 1) then
			-- The last update time is more than a one second ago
			Condition.updateStatus(condition, { noPropagation = true })
		end

		log(_getItemSummary(condition) .. " - status:" .. tostring(context.status) .. ", level:" .. tostring(condition.level), "Condition.getStatus", 4)
		return context.status, (context.lastStatusUpdateTime or 0)
	end,

	getLevel = function (condition)
		return (condition.level or 0), (condition._context.lastLevelUpdateTime or 0)
	end
}

Conditions = {
	updateStatus = function(conditions, params)
		local hasSomethingChange = false
		for _, condition in ipairs(conditions) do
			if Condition.updateStatus(condition, params) then
				hasSomethingChange = true
			end
		end
		if hasSomethingChange then
			RulesInfos.save()
		end
	end
}

-- **************************************************
-- RulesEngine.ActionTypes
-- **************************************************

local _actionTypes = {}
do
	_actionTypes["action_wait"] = {
		init = function (action)
			action.delayInterval = _getIntervalInSeconds(action.delayInterval, action.unit)
		end
	}

	_actionTypes["action_device"] = {
		init = function (action)
			action.deviceId = tonumber(action.deviceId)
			-- Get properties from mutation
			if (action.mutation ~= nil) then
				if ((action.service == nil) and (action.mutation.service ~= nil)) then
					action.service = action.mutation.service
				end
				if ((action.action == nil) and (action.mutation.action ~= nil)) then
					action.action = action.mutation.action
				end
				action.mutation = nil
			end
			-- Get arguments
			action.arguments = {}
			for key, value in pairs(action) do
				local paramName = string.match(key, "^param_(.*)$")
				if (paramName ~= nil) then
					action.arguments[paramName] = value
				elseif (key == "actionParams") then
					-- params are encoded into JSON
					local decodeSuccess, arguments, strError = pcall(json.decode, value)
					if ((not decodeSuccess) or (type(arguments) ~= "table")) then
					-- error
					else
						table.extend(action.arguments, arguments)
					end
				end
			end
			-- Get device ids
			action.deviceIds = _getDeviceIds(action)
			action.device = nil
			log("Action '" .. tostring(json.encode(action)), "ActionType.action_device.init", 4)
		end,
		check = function (action)
			if not _checkParameters(action, {"deviceIds", "service", "action", "arguments"}) then
				return false
			end
			return true
		end,
		execute = function (action, context)
			for _, deviceId in ipairs(action.deviceIds) do
				-- Check first device com status
				if (not luup.is_ready(deviceId) or (Variable.get(deviceId, VARIABLE.COMM_FAILURE) == "1")) then
					error("Device #" .. tostring(deviceId) .. " is not ready or has a com failure", "ActionType.action_device.execute")
				end
				-- Call luup action
				log("Action '" .. action.action .. "' for device #" .. tostring(deviceId) .. " with " .. tostring(json.encode(action.arguments)), "ActionType.action_device.execute", 3)
				luup.call_action(action.service, action.action, action.arguments, deviceId)
			end
		end
	}

	_actionTypes["action_function"] = {
		init = function (action)
			if (action.functionContent == nil) then
				return
			end
			--local chunk, strError = loadstring("return function(context, RulesEngine) \n" .. action.functionContent .. "\nend")
			local chunk, strError = loadstring("return function(context) \n" .. action.functionContent .. "\nend")
			if (chunk == nil) then
				Rule.addError(action._ruleId, "Init rule actions", "Error in functionContent: " .. tostring(strError))
			else
				-- Put the chunk in the plugin environment
				setfenv(chunk, getfenv(1))
				action.callback = chunk()
				action.functionContent = nil
			end
		end,
		check = function (action)
			if not _checkParameters(action, {"callback"}) then
				return false
			end
			return true
		end,
		execute = function (action, context)
			log(_getItemSummary(action) .. " - type : " .. type(action.callback), "ActionGroup.execute", 2)
			if (type(action.callback) == "function") then
				-- Execute function
				--log("Action '" .. action.action .. "' for device #" .. tostring(deviceId) .. " with " .. tostring(json.encode(action.arguments)), "ActionType.action_function.execute", 3)
				log(_getItemSummary(action) .. " - Do custom function with context :" .. tostring(json.encode(context)), "ActionGroup.execute", 2)
				action.callback(context)
			end
		end
	}
end

ActionTypes = {
	-- Add a type of action
	add = function (actionTypeName, actionType)
		if (actionTypeName == nil) then
			log("WARNING - Given actionTypeName is nil", "ActionTypes.add")
			return nil
		end
		if (_actionTypes[actionTypeName] ~= nil) then
			error("Action of type '" .. tostring(actionTypeName) ..  "' is already defined (overload it)", "ActionTypes.add")
		end
		log("Add action of type '" .. tostring(actionTypeName) .. "'", "ActionTypes.add")
		_actionTypes[actionTypeName] = actionType
	end,

	-- Get a type of action
	get = function (actionTypeName)
		if (actionTypeName == nil) then
			log("WARNING - Given actionTypeName is nil", "ActionTypes.get")
			return nil
		end
		local actionType = _actionTypes[actionTypeName]
		if (actionType == nil) then
			log("WARNING - Action of type '" .. tostring(actionTypeName) .. "' is unknown", "ActionTypes.get")
		end
		return actionType
	end
}

-- **************************************************
-- RulesEngine.History
-- **************************************************

-- TODO : use syslog ?

local _history = {}

History = {
	load = function ()
		local path = Store.getPath()
		local fileName = "C_RulesEngine_History.csv"

		local hasToPurge = false
		_history = {}
		log( "Load history from file '" .. path .. fileName .. "'", "History.load" )
		local file = io.open( path .. fileName, "r" )
		if ( file == nil ) then
			log( "File '" .. path .. fileName .. "' does not exist", "History.load" )
			return
		end
		local now = os.time()
		local params, entry
		for line in file:lines() do
			params = string.split( line, ";" )
			entry = {
				timestamp = tonumber( params[1] ),
				eventType = params[2],
				event     = params[3]
			}
			if ( os.difftime( now, entry.timestamp ) <= _maxHistoryInterval ) then
				table.insert( _history, entry )
			else
				hasToPurge = true
			end
		end
		file:close()

		if hasToPurge then
			file = io.open( path .. fileName, "w+" )
			for _, entry in ipairs( _history ) do
				file:write( string.format( "%s;%s;%s\n", entry.timestamp, entry.eventType, entry.event ) )
			end
			file:close()
		end
	end,

	append = function (entry)
		local path = Store.getPath()
		local fileName = "C_RulesEngine_History.csv"
		log("Append entry of history in file '" .. path .. fileName .. "'", "History.append")
		local file = io.open(path .. fileName, "a")
		if (file == nil) then
			log("File '" .. path .. fileName .. "' can not be written", "History.append")
			return
		end
		file:write(entry.timestamp .. ";" .. entry.eventType .. ";" .. entry.event .. "\n")
		file:close()
	end,

	add = function (timestamp, eventType, event)
		log("Add entry : " .. tostring(timestamp) .. " - " .. tostring(eventType) .. " - " .. tostring(event), "History.add", 2)
		local entry = {
			timestamp = timestamp,
			eventType = eventType,
			event = event
		}
		table.insert(_history, entry)
		History.append(entry)
		notifyTimelineUpdate()
	end,

	-- TODO : store ruleId
	get = function( params )
		local history = {}
		for _, item in ipairs( _history ) do
			if ( ( params.id == nil ) or ( item.ruleIid == params.id ) ) then
				table.insert( history, item )
			end
		end
		return history
	end
}

function notifyTimelineUpdate ()
	if (_params.deviceId == nil) then
		return false
	end
	-- TODO : faind a way to notify changes on scheduled tasks
	--luup.variable_set(SID.RulesEngine, "LastUpdate", os.time(), _params.deviceId)
end


-- **************************************************
-- RulesEngine.ActionGroup
-- **************************************************

ActionGroup = {
	init = function (actionGroup, ruleId, parent, idx)
		if (actionGroup == nil) then
			return
		end
		if (actionGroup.id == nil) then
			actionGroup.id = tostring(parent.id) .. "-" .. tostring(idx)
		end
		actionGroup.mainType = "ActionGroup"
		actionGroup.type = nil
		actionGroup._parent = parent
		actionGroup._ruleId = ruleId
		actionGroup._context = { lastUpdateTime = 0 }
		actionGroup.levels = {}
		log(_getItemSummary(actionGroup) .. " - Init group of actions", "ActionGroup.init", 3)
		-- Params
		if (actionGroup.params ~= nil) then
			log(_getItemSummary(actionGroup) .. " - Add params", "ActionGroup.init", 4)
			_addParams(actionGroup, actionGroup.params)
			actionGroup.params = nil
		end
		-- Condition of the group of actions
		if (actionGroup.condition ~= nil) then
			log(_getItemSummary(actionGroup) .. " - Init condition", "ActionGroup.init", 4)
			Condition.init(actionGroup.condition, ruleId, actionGroup)
		end
		-- Actions to do
		if (type(actionGroup["do"]) ~= "table") then
			actionGroup["do"] = {}
		end
		for i, action in ipairs(actionGroup["do"]) do
			action.id = actionGroup.id .. "." .. tostring(i)
			action.mainType = "Action"
			--action._parent = actionGroup
			action._ruleId = ruleId
			local actionType = ActionTypes.get(action.type)
			if ((type(actionType) == "table") and (type(actionType.init) == "function")) then
				log(_getItemSummary(action) .. " - Init", "ActionGroup.init", 4)
				actionType.init(action)
			end
		end
	end,

	checkSettings = function (actionGroup)
		log(_getItemSummary(actionGroup) .. " - Check settings", "ActionGroups.checkSettings", 3)
		local isOk = true
		for _, action in ipairs(actionGroup["do"]) do
			if not _checkParameters(action, {"type"}) then
				isOk = false
			else
				local actionType = ActionTypes.get(action.type)
				if (
						(type(actionType) == "table")
					and (type(actionType.check) == "function")
					and not actionType.check(action)
				) then
					isOk = false
				end
			end
		end
		if ((actionGroup.condition ~= nil) and not Condition.checkSettings(actionGroup.condition)) then
			isOk = false
		end
		return isOk
	end,

	getDelay = function (rule, actionGroup, params, isRecurrent)
		local delay = nil
		local params = params or {}

		local delayInterval
		if (not isRecurrent) then
			-- Get first delay
			if (type(actionGroup.delayInterval) == "function") then
				delayInterval = tonumber(actionGroup.delayInterval()) or 0
			else
				delayInterval = tonumber(actionGroup.delayInterval) or 0
			end
			if ((delayInterval == 0) and (actionGroup.event == "reminder")) then
				isRecurrent = true
			end
		end

		if (not isRecurrent) then
			--if ((actionGroup.event == "conditionStart") or (actionGroup.event == "conditionEnd")) then
			--	delay = 0
			--else
				-- For event concerning rule, adjust delay according to elapsed time since last change on rule
				--local elapsedTime = os.difftime(os.time(), rule._context.lastStatusUpdateTime)
				-- test
				--local elapsedTime = os.difftime(os.time(), math.max(rule._context.lastStatusUpdateTime, rule._context.lastLevelUpdateTime or 0))
				--local elapsedTime = os.difftime(os.time(), math.max(rule._context.lastStatusUpdateTime, rule._context.lastLevelUpdateTime or 0))
				local elapsedTime = os.difftime(os.time(), math.max(rule._context.lastStatusUpdateTime, (rule._context.lastLevelUpdateTime or 0), (params.lastUpdateTime or 0)))
				if (elapsedTime == 0) then
					delay = delayInterval
					log("Delay interval: " .. tostring(delay), "ActionGroup.getDelay", 4)
				elseif (delayInterval >= elapsedTime) then
					delay = delayInterval - elapsedTime
					if _isLogLevel(4) then
						log(
							"Adjusted delay interval: " .. tostring(delay) ..
							" - Initial interval " .. tostring(delayInterval) .. " >= elapsed time " .. tostring(elapsedTime) ..
							" since last change of rule status " .. string.format("%02d:%02d", math.floor(elapsedTime / 60), (elapsedTime % 60)),
							"ActionGroup.getDelay", 4
						)
					end
				elseif (elapsedTime - delayInterval <= (params.maxInterval or 10)) then
					delay = 0
					log("Delay interval is zero" , "ActionGroup.getDelay", 4)
				else
					log("Delay interval " .. tostring(delayInterval) .. " < elapsed time " .. tostring(elapsedTime) .. " (problem)", "ActionGroup.getDelay", 4)
		--print(rule._context.lastStatusUpdateTime)
		--print(rule._context.lastLevelUpdateTime)
				end
			--end
		end

		if (isRecurrent) then
			-- Get recurrent delay
			delay = _getIntervalInSeconds(actionGroup.recurrentInterval, actionGroup.unit)
			if (delay < _minRecurrentInterval) then
				-- Security on minimal interval time for recurrent actions
				log("Reminder recurrent interval is set to min interval " .. tostring(_minRecurrentInterval), "ActionGroup.getDelay", 2)
				delay = _minRecurrentInterval
			end
			log("Recurrent delay: " .. tostring(delay), "ActionGroup.getDelay", 3)
			--[[
			log("Reminder recurrent interval: " .. tostring(recurrentInterval), 4, "getDelay")
			log("DEBUG - (elapsedTime - delayInterval): " .. tostring((elapsedTime - delayInterval)), 4, "getDelay")
			log("DEBUG - ((elapsedTime - delayInterval) / recurrentInterval): " .. tostring(math.floor((elapsedTime - delayInterval) / recurrentInterval)), 4, "getDelay")
			log("DEBUG - ((elapsedTime - delayInterval) % recurrentInterval): " .. tostring(((elapsedTime - delayInterval) % recurrentInterval)), 4, "getDelay")
			delay = recurrentInterval - ((elapsedTime - delayInterval) % recurrentInterval)
			log("DEBUG - Delay interval: " .. tostring(delayInterval) .. " - recurrentInterval: " .. tostring(recurrentInterval) .. " - Ajusted delay: " .. tostring(delay), 4, "getDelay")
			--]]
		end

		log("DEBUG - Ajusted delay: " .. tostring(delay), "ActionGroup.getDelay", 3)
		return delay
	end,

	isMatchingEvent = function (actionGroup, event)
		if ((event ~= nil) and ((actionGroup.event == nil) or (actionGroup.event ~= event))) then
			log(_getItemSummary(actionGroup) .. " - The requested event '" .. tostring(event) .. "' is not respected", "ActionGroup.isMatchingEvent", 4)
			return false
		end
		return true
	end,

	isMatchingLevel = function (actionGroup, level)
		log("DEBUG " .. _getItemSummary(actionGroup) .. " - level " .. json.encode(actionGroup.levels), "ActionGroup.isMatchingLevel", 3)
		if (level ~= nil) then
			if ((table.getn(actionGroup.levels) == 0) or not table.contains(actionGroup.levels, level)) then
				log(_getItemSummary(actionGroup) .. " - The requested level '" .. tostring(level) .. "' is not respected", "ActionGroup.isMatchingLevel", 4)
				return false
			end
		else
			if ((table.getn(actionGroup.levels) > 0) and not table.contains(actionGroup.levels, 0)) then
				log(_getItemSummary(actionGroup) .. " - There's at least a level different from '0' and none was requested", "ActionGroup.isMatchingLevel", 4)
				return false
			end
		end
		return true
	end,

	-- Execute a group of actions
	execute = function (actionGroup, level, params)
	-- TODO : check level ?
		if (actionGroup == nil) then
			-- TODO : msg
			return
		end
		local rule = Rules.get(actionGroup._ruleId)
		if (rule == nil) then
			-- TODO : msg
			return
		end
		local params = params or {}
		--local level = params.level

		-- Check if engine is enabled
		if (not isEnabled()) then
			log("Rules engine is not enabled - Do nothing", "ActionGroup.execute")
			return false
		end

		-- Update context level
		rule._context.level = level or rule._context.level

		local msg = "*   Rule #" .. rule.id .. "(" .. rule.name .. ") - Group of actions #" .. tostring(actionGroup.id) .. " for event '" .. tostring(actionGroup.event) .. "'"
		if (actionGroup.level ~= nil) then
			msg = msg .. "(level " .. json.encode(actionGroup.levels) .. ")"
		end

		-- Check if a hook prevents to do the actions
		if not Hooks.execute("beforeDoingAction", rule, actionGroup.id) then
			log(msg .. " - A hook prevent from doing these actions", "ActionGroup.execute", 3)
		-- Check if the rule is disarmed
		-- TODO : use Rule.isArmed()
		elseif (not rule._context.isArmed and (actionGroup.event ~= "end")) then
			log(msg .. " - Don't do actions - Rule is disarmed and event is not 'end'", "ActionGroup.execute")
		-- Check if the rule is acknowledged
		elseif (rule._context.isAcknowledged and (actionGroup.event == "reminder")) then
			log(msg .. " - Don't do reminder actions - Rule is acknowledged", "ActionGroup.execute")

		--[[
		-- TODO faire maj pour condition externe de la règle
		-- Check if the rule main conditions are still respected
		if not isMatchingAllConditions(rule.condition, rule._context.deviceId) then
			log(msg .. " - Don't do action - Rule conditions are not respected", "ActionGroup.execute", 2)
			Rule.setStatus(rule, "0")
			return false
		end
		--]]

		-- Check if the condition of the group of actions is still respected
		elseif ((actionGroup.condition ~= nil) and (Condition.getStatus(actionGroup.condition) == 0)) then
			log(msg .. " - Don't do anything - Rule is still active but the condition of the group of actions is no more respected", "ActionGroup.execute", 3)
		-- Check if the level is still respected (TODO : est-ce nécessaire puisque au changement, les schedule sont enlevés)
		elseif not ActionGroup.isMatchingLevel(actionGroup, level) then
			log(msg .. " - Don't do anything - Level doesn't match the requested level " .. tostring(level), "ActionGroup.execute", 3)
		else
			--log(msg .. " - Do actions", "ActionGroup.execute", 3)
			if (params.idx ~= nil) then
				log(msg .. " - Resume from action #" .. tostring(params.idx), "ActionGroup.execute", 3)
			end
			for i = (params.idx or 1), #actionGroup["do"] do
				local action = actionGroup["do"][i]
				if (action.type == "action_wait") then
					-- Wait and resume
					log(msg .. " - Do action #" .. tostring(action.id) ..  " - Wait " .. tostring(action.delayInterval) .. " seconds", "ActionGroup.execute", 3)
					ScheduledTasks.add(
						{ ruleId = rule.id, event = actionGroup.event, level = level, actionGroupId = actionGroup.id, isCritical = actionGroup.isCritical },
						ActionGroup.execute, action.delayInterval, { actionGroup, level, { idx = i + 1 } }
					)
					return
				else
					local actionType = ActionTypes.get(action.type)
					if (actionType == nil) then
						log(msg .. " - Can not do action #" .. tostring(action.id) ..  " of type '" .. tostring(action.type) .. "' - Unknown action type", "ActionGroup.execute", 1)
					else
						log(msg .. " - Do action #" .. tostring(action.id) ..  " of type '" .. action.type .. "'", "ActionGroup.execute", 3)
						local functionToDo
						if (type(actionType) == "function") then
							functionToDo = actionType
						else
							functionToDo = actionType.execute
						end
						--local ok, err = pcall(functionToDo, action, rule._context)
						local ok, err = pcall(functionToDo, action, actionGroup._parent._context)
						if not ok then
							Rule.addError(ruleId, "Rule action", tostring(err))
							History.add(os.time(), "RuleAction", "ERROR Rule action : " .. _getItemSummary(action) .. " - " .. tostring(err))
						else
							History.add(os.time(), "RuleAction", "Do rule action : " .. _getItemSummary(action))
						end
						--assert(ok, "ERROR: " .. tostring(err))
					end
				end
			end
		end

		if (actionGroup.event == "reminder") then
			-- Relaunching of the surveillance of the status of the rule
			local delay = ActionGroup.getDelay(rule, actionGroup, nil, true)
			log(msg .. " - Do recurrent group of actions in " .. tostring(delay) .. " seconds", "ActionGroup.execute", 2)
			ScheduledTasks.add(
				{ ruleId = rule.id, event = "reminder", level = level, actionGroupId = actionGroup.id, isCritical = actionGroup.isCritical },
				ActionGroup.execute, delay, { actionGroup, level }
			)
		end

	end
}

-- **************************************************
-- RulesEngine.ActionGroups
-- **************************************************

ActionGroups = {
	init = function (actionGroups, ruleId, parent)
		if (actionGroups == nil) then
			return
		end
		actionGroups.events = {}
		for i, actionGroup in ipairs(actionGroups) do
			ActionGroup.init(actionGroup, ruleId, parent, i)
			if not table.contains(actionGroups.events, actionGroup.event) then
				table.insert(actionGroups.events, actionGroup.event)
			end
		end
	end,

	checkSettings = function (actionGroups)
		if (actionGroups == nil) then
			return true
		end
		local isOk = true
		for i, actionGroup in ipairs(actionGroups) do
			if not ActionGroup.checkSettings(actionGroup) then
				isOk = false
			end
		end
		return isOk
	end,

	isMatchingEvent = function (actionGroups, event)
		if (actionGroups == nil) then
			return
		end
		return table.contains(actionGroups.events, event)
	end,

	startConditions = function (actionGroups)
		if (actionGroups == nil) then
			return
		end
		for i, actionGroup in ipairs(actionGroups) do
			if (actionGroup.condition ~= nil) then
				Condition.start(actionGroup.condition)
			end
		end
	end,

	-- Execute groups of actions matching an event and optionally a level
	execute = function (actionGroups, ruleId, event, level, params)
		if (actionGroups == nil) then
			return
		end
		local rule = Rules.get(ruleId)
		if (rule == nil) then
			log("Rule #" .. tostring(ruleId) .. " do not exist", "ActionGroups.execute")
			return false
		end

		-- Check if engine is enabled
		if (not isEnabled()) then
			log("Rules engine is not enabled - Do nothing", "ActionGroups.execute")
			return false
		end

		-- Check if rule is disarmed
		if (not rule._context.isArmed and (event ~= "end")) then
			log("Rule #" .. tostring(rule.id) .. " is disarmed and event is not 'end' - Do nothing", "ActionGroups.execute")
			return false
		end

		-- Check if a group of action is matching the event
		if not table.contains(actionGroups.events, event) then
			log("Rule #" .. tostring(rule.id) .. " has no group of actions for event '" .. event .. "' - Do nothing", "ActionGroups.execute")
			return false
		end
		
		-- Announce what will be done
		if (level ~= nil) then
			log("*** Rule #" .. tostring(rule.id) .. " - Do group of actions for event '" .. event .. "' with explicit level '" .. tostring(level) .. "'", "ActionGroups.execute")
		--elseif (rule._context.level > 0) then
		--	log("*** " .. Rule.getSummary(rule) .. " - Do group of actions for event '" .. event .. "' matching rule level '" .. tostring(rule._context.level) .. "'", "ActionGroups.execute")
		else
			log("*** Rule #" .. tostring(rule.id) .. " - Do group of actions for event '" .. event .. "'", "ActionGroups.execute")
		end

		local params = params or {}
		-- Search group of actions, linked to the event
		local isAtLeastOneToExecute = false
		for _, actionGroup in ipairs(actionGroups) do
			local msg = "**  " .. _getItemSummary(actionGroup)
			-- Check if the event is respected
			if not ActionGroup.isMatchingEvent(actionGroup, event) then
				log(msg .. " - Don't do because event '" .. tostring(event) .. "' is not respected", "ActionGroups.execute", 3)
			-- Check if the level is respected
			elseif not ActionGroup.isMatchingLevel(actionGroup, level) then
				log(msg .. " - Don't do because level '" .. tostring(level) .. "' is not respected", "ActionGroups.execute", 3)
			-- Check if the specific condition of the group of rule actions is respected
			elseif ((actionGroup.condition ~= nil) and (Condition.getStatus(actionGroup.condition) == 0)) then
				log(msg .. " - Don't do anything - Rule is still active but the condition of the group of actions is not respected", "ActionGroup.execute", 3)
			else
				local delay = ActionGroup.getDelay(rule, actionGroup, params)
				if (delay == nil) then
					-- Delay is passed (the action has already been done)
					log(msg .. " - Don't do because it already has been done", "ActionGroups.execute", 3)
				else
					-- Execute the action
					isAtLeastOneToExecute = true
					if (delay > 0) then
						log(msg .. " - Do in " .. tostring(delay) .. " second(s)", "ActionGroups.execute", 2)
					else
						log(msg .. " - Do immediately", "ActionGroups.execute", 2)
					end
					-- The calls are made all in asynchronous to avoid the blockings
					ScheduledTasks.add(
						{ ruleId = rule.id, event = event, level = level, actionGroupId = actionGroup.id, isCritical = actionGroup.isCritical },
						ActionGroup.execute, delay, { actionGroup, level }
					)
				end
			end
		end
		if not isAtLeastOneToExecute then
			local msg = Rule.getSummary(rule) .. " - No action to do for event '" .. tostring(event) .. "'"
			if (level ~= nil) then
				msg = msg .. " and level '" .. tostring(level) .. "'"
			end
			log(msg, "ActionGroups.execute", 2)
		end
	end
}

-- **************************************************
-- RulesEngine.RulesInfos
-- **************************************************

local _rulesInfos = {}

RulesInfos = {
	load = function ()
		_rulesInfos = {}
		local _path = Store.getPath()
		local _fileName = "C_RulesEngine_RulesInfos.json"
		log("Load rules infos from file '" .. _path .. _fileName .. "'", "RulesInfos.load")
		local file = io.open(_path .. _fileName)
		if (file == nil) then
			log("File '" .. _path .. _fileName .. "' does not exist", "RulesInfos.load")
			return
		end
		local jsonInfos = file:read("*a")
		file:close()
		local decodeSuccess, infos, strError = pcall(json.decode, jsonInfos)
		if ((not decodeSuccess) or (type(infos) ~= "table")) then
			-- TODO : log error
		else
			_rulesInfos = infos
		end
		-- Mark the loaded rules
		for _, ruleInfos in ipairs(_rulesInfos) do
			ruleInfos.isFormer = true
		end
	end,

	save = function ()
		if (_params.deviceId == nil) then
			return false
		end
		local _path = Store.getPath()
		local _fileName = "C_RulesEngine_RulesInfos.json"
		log("Save rules infos in file '" .. _path .. _fileName .. "'", "RulesInfos.save")
		local file = io.open(_path .. _fileName, "w")
		if (file == nil) then
			log("File '" .. _path .. _fileName .. "' can not be written or created", "RulesInfos.save")
			return
		end
		local modifiedRuleIds = {}
		local rulesInfos = {}
		for _, rule in pairs(Rules.getAll()) do
			--[[
			if (rule._context.lastUpdateTime) then
				table.insert(modifiedRuleIds, rule.id)
			end
			--]]
			table.insert(rulesInfos, rule._context)
		end
		file:write(json.encode(rulesInfos))
		file:close()

		-- Notify a change to the client
		-- TODO : notifier que si changement effectif : voir sur ALTUI comment fonctionne les maj de variable
		-- TODO : notify which rules have changed
		luup.variable_set(SID.RulesEngine, "LastUpdate", tostring(os.time()), _params.deviceId)
	end,

	get = function (params)
		local rulesInfos = {}
		for _, ruleInfos in ipairs(_rulesInfos) do
			if (
				((params.fileName == nil) or (ruleInfos.fileName == params.fileName))
				and ((params.idx == nil) or (ruleInfos.idx == params.idx))
				and ((params.id == nil) or (ruleInfos.id == params.id))
			) then
				table.insert(rulesInfos, ruleInfos)
			end
		end
		if (#rulesInfos == 0) then
			log("Can not find rule infos for params " .. tostring(json.encode(params)), "RulesInfos.get", 4)
		end
		return rulesInfos
	end,

	add = function (ruleInfos)
		log("Add informations for rule #" .. tostring(ruleInfos.id), "RulesInfos.add")
		table.insert(_rulesInfos, ruleInfos)
	end,

	remove = function (params)
		for i = #_rulesInfos, 1, -1 do
			local ruleInfos = _rulesInfos[i]
			if ((params.isFormer == true) and (ruleInfos.isFormer == true)) then
				log("Remove former informations for rule #" .. tostring(ruleInfos.id), "RulesInfos.remove")
				table.remove(_rulesInfos, i)
			elseif ((ruleInfos.id == params.id) and (ruleInfos.fileName == params.fileName) and (ruleInfos.idx == params.idx)) then
				log("Remove informations for rule #" .. tostring(ruleInfos.id), "RulesInfos.remove")
				table.remove(_rulesInfos, i)
				return true
			end
		end
		return false
	end
}

-- **************************************************
-- RulesEngine.Hooks
-- **************************************************

local _hooks = {}

Hooks = {
	-- Add a hook
	add = function (moduleName, event, callback)
		if (_hooks[event] == nil) then
			_hooks[event] = {}
		end
		log("Add hook for event '" .. event .. "'", "Hooks.add")
		table.insert(_hooks[event], { moduleName, callback} )
	end,

	-- Execute a hook for an event and a rule
	execute = function (event, rule)
		if (_hooks[event] == nil) then
			return true
		end
		local nbHooks = table.getn(_hooks[event])
		if (nbHooks == 1) then
			log(Rule.getSummary(rule) .. " - Event '" .. event .. "' - There is 1 hook to do", "Hooks.execute", 2)
		elseif (nbHooks > 1) then
			log(Rule.getSummary(rule) .. " - Event '" .. event .. "' - There are " .. tostring(nbHooks) .. " hooks to do" , "Hooks.execute", 2)
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
					log(Rule.getSummary(rule) .. " - Event '" .. event .. "' - ERROR: " .. tostring(result), "Hooks.execute", 1)
					Rule.addError(rule, "Hook " .. event, tostring(result))
				elseif not result then
					isHookOK = false
				end
			end
		end
		return isHookOK
	end,

	-- Reset hooks (just for unit tests)
	reset = function ()
		log("Reset hooks", "Hooks.reset")
		_hooks = {}
	end
}

-- **************************************************
-- RulesEngine.Rule
-- **************************************************

Rule = {
	getSummary = function (rule)
		return "Rule #" .. tostring(rule.id) .. "(" .. tostring(rule.name) .. ")"
	end,

	-- Rule initialisation
	init = function (rule)
		log(Rule.getSummary(rule) .. " - Init rule", "Rule.init", 3)
		table.extend(rule, {
			mainType = "Rule",
			areSettingsOk = false,
			_context = {
				id = rule.id,
				name = rule.name,
				fileName = rule.fileName,
				idx = rule.idx,
				version = rule.version,
				hashcode = rule.hashcode,
				lastUpdateTime = 0,
				status = -1,
				lastStatusUpdateTime = 0,
				level = 0,
				lastLevelUpdateTime = 0,
				isArmed = true,
				isStarted = false,
				isAcknowledgeable = false,
				isAcknowledged = false,
				errors = {},
				conditions = {}
			}
		})
		if (rule.properties ~= nil) then
			log("Rule #" .. tostring(rule.id) .. " - Add properties", "Rule.init", 4)
			rule.properties = _initProperties(rule.id, rule.properties)
		else
			rule.properties = {}
		end
		if (rule.condition ~= nil) then
			log("Rule #" .. tostring(rule.id) .. " - Init condition", "Rule.init", 4)
			--Condition.init(rule.condition, rule.id, rule, rule._context)
			Condition.init(rule.condition, rule.id, rule, rule._context)
		else
			warning(Rule.getSummary(rule) .. " has no condition", "Rule.init")
		end
		if (rule.actions ~= nil) then
			log("Rule #" .. tostring(rule.id) .. " - Init groups of actions", "Rule.init", 4)
			ActionGroups.init(rule.actions, rule.id, rule)
		else
			warning(Rule.getSummary(rule) .. " has no action", "Rule.init")
		end
	end,

	-- Check the settings of a rule
	checkSettings = function (rule)
		log(Rule.getSummary(rule) .. " - Check settings", "Rule.checkSettings", 4)
		if (
			Condition.checkSettings(rule.condition)
			and ActionGroups.checkSettings(rule.actions)
		) then
			rule.areSettingsOk = true
			return true
		else
			rule.areSettingsOk = false
			return false
		end
	end,

	-- Compute rule status according to conditions
	computeStatus = function (rule)
		if (not rule._context.isArmed) then
			return -2, nil
		end
		local msg = Rule.getSummary(rule)
		log(msg .. " - Compute rule status", "Rule.computeStatus", 3)
		local status, level
		if (rule.condition ~= nil) then
			status = Condition.getStatus(rule.condition)
			level = Condition.getLevel(rule.condition)
		else
			status, level = 0, 0
		end
		log(msg .. " - Rule status: '" .. tostring(status) .. "' - Rule level: '" .. tostring(level) .. "'", "Rule.computeStatus")
		return status, level
	end,

	-- Start a rule
	start = function (rule)
		debugLogBegin("Rule.start")
		local msg = Rule.getSummary(rule)

		-- Init the status of the rule
		if (not rule.areSettingsOk) then
			log(msg .. " - Can not start the rule - Settings are not correct", "Rule.start", 1)
			debugLogEnd("Rule.start")
			return
		end
		log(msg .. " - Init rule status", "Rule.start", 2)

		-- Check if rule is acknowledgeable
		if (rule.properties["property_is_acknowledgeable"] ~= nil) then
			rule._context.isAcknowledgeable = (rule.properties["property_is_acknowledgeable"].isAcknowledgeable == "TRUE")
		end

		Hooks.execute("onRuleStatusInit", rule)
		if (rule._context.status > -1) then
			-- Status of the rule has already been initialized (by a hook or already started)
			-- Update statuses of the conditions
			Rule.computeStatus(rule)
		else
			-- Compute the status of the rule
			rule._context.status, rule._context.level = Rule.computeStatus(rule)
		end
		if (rule._context.status == 1) then
			log(msg .. " is active on start", "Rule.start", 2)
		else
			log(msg .. " is not active on start", "Rule.start", 2)
		end

		-- Start condition
		if (rule.condition ~= nil) then
			log(msg .. " - Start condition", "Rule.start", 3)
			Condition.start(rule.condition)
		end
		if (rule.actions ~= nil) then
			log(msg .. " - Start conditions of group of actions", "Rule.start", 3)
			ActionGroups.startConditions(rule.actions)
		end

		-- Exécution si possible des actions liées à l'activation
		-- Actions avec délai (non faites si redémarrage Luup) ou de rappel
		if (rule._context.status == 1) then
			if Hooks.execute("beforeDoingActionsOnRuleIsActivated", rule) then
				ActionGroups.execute(rule.actions, rule, "start")
				ActionGroups.execute(rule.actions, rule, "reminder")
				if (rule._context.level > 0) then
					ActionGroups.execute(rule.actions, rule, "start", rule._context.level)
					ActionGroups.execute(rule.actions, rule, "reminder", rule._context.level)
				end
			else
				log(msg .. " is now active, but a hook prevents from doing actions", 1, "Rule.start")
			end
		end

		rule._context.isStarted = true

		-- Update rule status
		-- Start actions won't be done again if status is still activated (no change)
		Event.onRuleStatusIsUpdated(rule.id, rule._context.status)

		debugLogEnd("Rule.start")
	end,

	-- Stop a rule (without doing "end" events)
	stop = function (rule, status)
		local msg = Rule.getSummary(rule)
		log(Rule.getSummary(rule) .. " is stoping", "Rule.stop", 2)
		ScheduledTasks.remove({ ruleId = rule.id })
		if ((status ~= nil) and (status >= 0)) then
			log("WARNING - " .. msg .. " - Status is not negative", "Rule.stop")
		end
		rule._context.status = status or -1
		rule._context.isStarted = false
	end,

	-- Add an error to a rule
	addError = function (ruleId, event, message)
		error(tostring(event) .. ": " .. tostring(message), "Rule.addError")
		local rule = Rules.get(ruleId)
		if (rule == nil) then
			error("can not add to errors because rule #" .. tostring(ruleId) .. " is unknown", "Rule.addError")
			return
		end
		table.insert(rule._context.errors, {
			timestamp = os.time(),
			event = event,
			message = message
		})
	end,

	updateStatus = function (ruleId)
		local rule = Rules.get(ruleId)
		if (rule == nil) then
			return false
		end
		log("Update status of rule #" .. tostring(rule.id) .. "(" .. rule.name .. ")", "Rule.updateStatus", 2)
		local status, level = Rule.computeStatus(rule)
		Rule.setStatus(rule, status, level)
	end,

	-- Get rule status
	getStatus = function (ruleId)
		local rule = Rules.get(ruleId)
		if (rule ~= nil) then
			return rule._context.status
		else
			return nil
		end
	end,

	-- Is rule active
	isActive = function (ruleId)
		return (Rule.getStatus(ruleId) == 1)
	end,

	-- Is rule started
	isStarted = function (ruleId)
		local rule = Rules.get(ruleId)
		if (rule == nil) then
			return false
		end
		return (rule._context.isStarted == true)
	end,

	-- Get rule level
	getLevel = function (ruleId)
		local rule = Rules.get(ruleId)
		if (rule ~= nil) then
			return rule._context.level or 0
		else
			return nil
		end
	end,

	-- Rule arming
	setArming = function (ruleId, arming)
		local rule = Rules.get(ruleId)
		if (rule == nil) then
			return false, "Rule #" .. tostring(ruleId) .. " is unknown"
		end
		local msg = Rule.getSummary(rule)
		if ((arming == "1") or (arming == true)) then
			-- Arm the rule
			if not rule._context.isArmed then
				if (rule.areSettingsOk) then
					rule._context.isArmed = true
					log(msg .. " is now armed", "Rule.setArming")
					Hooks.execute("onRuleIsArmed", rule)
					Rule.start(rule)
					RulesInfos.save()
				else
					log(msg .. " can not be armed - Settings are not ok", "Rule.setArming")
				end
			else
				msg = msg .. " was already armed"
				log(msg, "Rule.setArming")
				return false, msg
			end
		else
			-- Disarm the rule
			if rule._context.isArmed then
				rule._context.isArmed = false
				log(msg .. " is now disarmed", "Rule.setArming")
				Hooks.execute("onRuleIsDisarmed", rule)
				Rule.stop(rule, -2)
				RulesInfos.save()
			else
				msg = msg .. " was already disarmed"
				log(msg, "Rule.setArming")
				return false, msg
			end
		end
		return true
	end,

	-- Is rule armed
	isArmed = function (ruleId)
		local rule = Rules.get(ruleId)
		if (rule == nil) then
			return false
		end
		return (rule._context.isArmed == true)
	end,

	-- Rule acknowledgement
	setAcknowledgement = function (ruleId, acknowledgement)
		local rule, err = Rules.get(ruleId)
		if (rule == nil) then
			return false, err
		end
		local msg = Rule.getSummary(rule)
		if ((acknowledgement == "1") or (acknowledgement == true)) then
			if (rule._context.isAcknowledgeable and not rule._context.isAcknowledged) then
				rule._context.isAcknowledged = true
				log(msg .. " is now acknowledged", "Rule.Acknowledgement")
				Hooks.execute("onRuleIsAcknowledged", rule)
				RulesInfos.save()
			else
				msg = msg .. " was already acknowledged"
				log(msg, "Rule.Acknowledgement")
				return false, msg
			end
		else
			if rule._context.isAcknowledged then
				rule._context.isAcknowledged = false
				log(msg .. " is now not acknowledged", "Rule.Acknowledgement")
				Hooks.execute("onRuleIsUnacknowledged", rule)
				RulesInfos.save()
			else
				msg = msg .. " was already not acknowledged"
				log(msg, "Rule.Acknowledgement")
				return false, msg
			end
		end
		return true
	end,

	-- Set the status of the rule and start linked actions
	setStatus = function (ruleId, status, level)
		local rule, err = Rules.get(ruleId)
		if (rule == nil) then
			return false, err
		end
		local msg = Rule.getSummary(rule)

		-- Update rule active level
		local hasRuleLevelChanged = false
		local oldLevel = rule._context.level
		if ((level ~= nil) and (level ~= oldLevel)) then
			rule._context.level = level
			rule._context.lastLevelUpdateTime = os.time()
			hasRuleLevelChanged = true
			log(msg .. " Level has changed (oldLevel:'" .. tostring(oldLevel).. "', newLevel:'" .. tostring(level) .. "')", "Rule.setStatus", 2)
		end

		local hasRuleStatusChanged = false

		-- Check if rule is armed
		if (not rule._context.isArmed) then
			--[[
			if (rule._context.status == 1) then
				log(msg .. " is disarmed and is now inactive", "Rule.setStatus")
				status = 0
			else
				log(msg .. " is disarmed - Do nothing ", "Rule.setStatus")
				return
			end
			--]]
			if (status == 1) then
				log(msg .. " is disarmed - Do nothing ", "Rule.setStatus")
				return
			end
		end

		if ((rule._context.status < 1) and (status == 1)) then
			-- The rule has just been activated
			log(msg .. " is now active", "Rule.setStatus")
			rule._context.status = 1
			rule._context.lastStatusUpdateTime = os.time()
			-- Reset acknowledgement
			Rule.setAcknowledgement(rule, "0")

			hasRuleStatusChanged = true
			Hooks.execute("onRuleIsActivated", rule)
			-- Cancel all scheduled actions for this rule (of type 'end')
			ScheduledTasks.remove({ ruleId = rule.id, event = "conditionEnd" })
			ScheduledTasks.remove({ ruleId = rule.id, event = "end" })
			-- Execute actions linked to activation, if possible
			if Hooks.execute("beforeDoingActionsOnRuleIsActivated", rule) then
				ActionGroups.execute(rule.actions, rule, "start")
				ActionGroups.execute(rule.actions, rule, "reminder")
				if ((level or 0) > 0) then
					ActionGroups.execute(rule.actions, rule, "start", level)
					ActionGroups.execute(rule.actions, rule, "reminder", level)
				end
				History.add(os.time(), "RuleStatus", Rule.getSummary(rule) .. " is now active")
			else
				History.add(os.time(), "RuleStatus", Rule.getSummary(rule) .. " is now active, but a hook prevents from doing actions")
			end

		elseif ((rule._context.status == 1) and (status < 1)) then
			-- The rule has just been deactivated
			log(msg .. " is now inactive", "Rule.setStatus")
			rule._context.status = status
			rule._context.lastStatusUpdateTime = os.time()

			hasRuleStatusChanged = true
			Hooks.execute("onRuleIsDeactivated", rule)
			-- Cancel all scheduled actions for this rule (for event start)
			ScheduledTasks.remove({ ruleId = rule.id, event = "start" })
			ScheduledTasks.remove({ ruleId = rule.id, event = "startCondition" })
			ScheduledTasks.remove({ ruleId = rule.id, event = "reminder" })
			-- Execute actions linked to deactivation, if possible
			if Hooks.execute("beforeDoingActionsOnRuleIsDeactivated", rule) then
				if (hasRuleLevelChanged) then
					ActionGroups.execute(rule.actions, rule, "end", oldLevel)
					if (level or 0 > 0) then
						ActionGroups.execute(rule.actions, rule, "end", level)
					end
				end
				ActionGroups.execute(rule.actions, rule, "end")
				History.add(os.time(), "RuleStatus", Rule.getSummary(rule) .. " is now inactive")
			else
				History.add(os.time(), "RuleStatus", Rule.getSummary(rule) .. " is now inactive, but a hook prevents from doing actions")
			end

		elseif (rule._context.status == 1) then
			-- The rule is still active
			if (hasRuleLevelChanged) then
				log(msg .. " is still active but its level has changed", "Rule.setStatus")
				-- Cancel scheduled actions for this rule and for old level
				ScheduledTasks.remove({ ruleId = rule.id, event = "start", level = oldLevel })
				ScheduledTasks.remove({ ruleId = rule.id, event = "reminder", level = oldLevel })
				-- Execute actions linked to level change
				ActionGroups.execute(rule.actions, rule, "end", oldLevel)
				ActionGroups.execute(rule.actions, rule, "start", level)
				ActionGroups.execute(rule.actions, rule, "reminder", level)
			else
				log(msg .. " is still active (do nothing)", "Rule.setStatus")
			end

		--elseif (rule._context.status == 0) then
		else
			-- The rule is still inactive
			log("Rule '" .. rule.name .. "' is still inactive (do nothing)", "Rule.setStatus")
		end

		if (hasRuleStatusChanged or hasRuleLevelChanged) then
			RulesInfos.save()
		end
		if (hasRuleStatusChanged) then
			-- Notify that rule status has changed
			updatePanel()
			Event.onRuleStatusIsUpdated(rule.id, rule._context.status)
		end

	end,

	-- Save compute id in the xml file
	saveId = function (rule)
		log(Rule.getSummary(rule) .. " - Save rule id at position " .. tostring(rule.idx) .. " in file '" .. rule.fileName .. "'", "Rule.saveId")

		-- save id of the rule in its file (and compress if needed)
		local content, path, wasCompressed = RulesFile.getContent(rule.fileName)
		if (content == nil) then
			return
		end

		-- Search and modify id in the content (XML)
		local newContent
		local idx = 1
		local i1, j1, i2, j2 = 1, 1, 1, 1
		local k, l, id = 1, 1
		i1, j1 = string.find(content, '<block type="rule".->', 1)
		while ((i1 ~= nil) and (idx <= rule.idx)) do
			i2, j2 = string.find(content, '<block type="rule".->', j1 + 1)
	--print("i1",i1,"j1",j1,"i2",i2,"j2",j2)

			-- Search the id tag
			k, l, id = string.find(content, '<field name="id">(.-)</field>', j1 + 1)
	--print("idx",idx,"rule.idx",rule.idx,"k",k,"l",l,"id",id)

			if ((k == nil) or ((i2 ~= nil) and (k > i2))) then
				-- The tag id does not exist or is after the next rule tag
				break
			end

			if (idx == rule.idx) then
				-- The position of the id tag for this rule is found
				if ((id ~= nil) and (id ~= "")) then
					-- The id was already here ?
					break
				end
				log(Rule.getSummary(rule) .. " - Modify file content", "Rule.saveId")
				newContent = string.sub(content, 1, k - 1) .. '<field name="id">' .. tostring(rule.id) .. '</field>' .. string.sub(content, l + 1)

				break
			end
			
			i1, j1 = i2, j2
			idx = idx + 1
		end

		-- Save the modifications
		if (newContent ~= nil) then
			RulesFile.saveContent(path, rule.fileName, newContent, wasCompressed)
		end
	end,

	-- Update rule context
	updateContext = function (ruleId, context)
		local rule = Rules.get(ruleId)
		if (rule == nil) then
			return
		end
		log(Rule.getSummary(rule) .. " - Update rule context", "Rule.updateContext", 4)
		table.extend(rule._context, context)
	end,

	-- Change last change timestamp
	touch = function (ruleId)
		local rule = Rules.get(ruleId)
		if (rule == nil) then
			return
		end
		rule._context.lastUpdateTime = os.time()
	end
}

-- **************************************************
-- RulesEngine.Rules
-- **************************************************

local _rules = {}
local _rulesWithoutId = {}
local _indexRulesById = {}
local _indexRulesByName = {}
local _lastRuleId = 1

Rules = {
	getNextFreeId = function ()
		_lastRuleId = _lastRuleId + 1
		return _lastRuleId
	end,

	-- Add a rule
	add = function (rule, keepFormerRuleWithSameId)
		debugLogBegin("Rules.add")
		local msg = Rule.getSummary(rule)

		if ((rule == nil) or (type(rule) ~= "table")) then
			debugLogEnd("Rules.add")
			return false
		end
		if (rule.name == nil) then
			rule.name = "Undefined"
		end
		log("Add " .. msg , "Rules.add")

		-- Check if id of the rule is defined
		if ((rule.id == nil) or (rule.id == "")) then
			log("WARNING : Rule '" .. rule.name .. "' has no id (will be calculated later)", "Rules.add")
			table.insert(_rulesWithoutId, rule)
			debugLogEnd("Rules.add")
			return false
		end

		-- Get former informations of the rule
		local formerRuleInformations = RulesInfos.get(rule)[1]
		RulesInfos.remove(rule)

		-- Check if a rule already exists with this id (it must be a change on the rule)
		local formerRule = _indexRulesById[tostring(rule.id)]
		if (formerRule ~= nil) then
			if not keepFormerRuleWithSameId then
				log(Rule.getSummary(formerRule) .. " already exists - Remove it (but keep its informations)", "Rules.add")
				Rules.remove(formerRule.fileName, formerRule.idx, formerRule.id)
				formerRule = nil
			else
				Rule.addError(rule, "Rules.add", "Duplicate rule with id #" .. formerRule.id .. "(" .. formerRule.name .. ")")
			end
		end

		-- Update the last known free rule id
		if (rule.id > _lastRuleId) then
			_lastRuleId = rule.id
		end

		-- Add the rule
		table.insert(_rules, rule)
		-- Add to indexes
		_indexRulesById[tostring(rule.id)] = rule
		_indexRulesByName[rule.name] = rule

		-- Init
		Rule.init(rule)

		-- Informations of the rule
		if (formerRuleInformations ~= nil) then
			if ((rule.hashcode ~= nil) and (rule.hashcode ~= formerRuleInformations.hashcode)) then
				log(msg .. " - Can not update context of the rule with former informations because hashcode has changed", "Rules.add")
			else
				log(msg .. " - Update context of the rule with former informations", "Rules.add")
				formerRuleInformations.isFormer = nil
				formerRuleInformations.name = nil
				formerRuleInformations.status = nil
				formerRuleInformations.errors = nil
				for conditionId, conditionInfos in pairs(formerRuleInformations.conditions) do
					conditionInfos.status = -1
				end
				table.extend(rule._context, formerRuleInformations)
			end
		end
		RulesInfos.add(rule._context)

		-- Check settings
		if Rule.checkSettings(rule) then
			if (isStarted()) then
				-- If the RulesEngine is already started, then start the rule just after adding
				Rule.start(rule)
			end
			if (isInitialized()) then
				RulesInfos.save()
			end
		else
			--rule._context.isArmed = false
			error(msg .. " has at least one error in settings", "Rules.add")
		end

		debugLogEnd("Rules.add")
		return true
	end,

	addRulesWithoutId = function ()
		-- Add remaining rules without id
		-- For the moment, I've not found a way to edit safely the XML files
		-- So it's done by the UI client which upload the modified XML file
		for _, rule in ipairs(_rulesWithoutId) do
			rule.id = Rules.getNextFreeId()
			log("Set id to #" .. tostring(rule.id) .. " for rule '" .. rule.name .. "' in file '" .. rule.fileName .. "' at position " .. tostring(rule.idx), "Rules.addRulesWithoutId")
			Rule.saveId(rule)
			Rules.add(rule, true)
		end
		_rulesWithoutId = {}
	end,

	-- Remove a rule
	remove = function (fileName, ruleIdx, ruleId, updateOtherRuleIdxes)
		ruleIdx, ruleId = tonumber(ruleIdx), tonumber(ruleId)
		if ((fileName == nil) or (ruleIdx == nil) or (ruleId == nil)) then
			error("fileName(" .. tostring(fileName) .. "), ruleIdx(" .. tostring(ruleIdx) .. ") and ruleId(" .. tostring(ruleId) .. ") are mandatory", "Rules.remove")
			return
		end
		local rule = Rules.get(ruleId)
		if ((rule ~= nil) and (rule.fileName == fileName) and (rule.idx == ruleIdx)) then
			log("Remove rule #" .. rule.id .. "(" .. rule.name .. ")", "Rules.remove")
			-- Remove events on the rule
			Events.removeRule(rule.id)
			-- Remove scheduled tasks of the rule
			if (Rule.isStarted(rule)) then
				ScheduledTasks.remove({ ruleId = rule.id })
			end
			-- Remove informations of the rule
			RulesInfos.remove(rule)
			-- Remove rule from indexes
			_indexRulesById[tostring(rule.id)] = nil
			_indexRulesByName[rule.name] = nil
			-- Remove rule
			for i = #_rules, 1, -1 do
				if (_rules[i] == rule) then
					table.remove(_rules, i)
					break
				end
			end
			rule = nil

			if (updateOtherRuleIdxes == true) then
				for _, rule in ipairs(_rules) do
					if ((rule.fileName == fileName) and (rule.idx > ruleIdx)) then
						rule.idx = rule.idx - 1
						rule._context.idx = rule.idx
					end
				end
			end

		else
			error("Can not remove rule #" .. rule.id .. "(" .. rule.name .. ") because fileName(" .. tostring(fileName) .. "-" .. tostring(rule.fileName) .. ") and ruleIdx(" .. tostring(ruleIdx) .. "-" .. tostring(rule.idx) .. ") do not match", "Rules.remove")
		end
	end,

	-- Get rule (try first by id, then by name or return the input if it is a table)
	get = function (ruleId)
		local rule
		if (ruleId == nil) then
			error("Parameter #1 is nil", "Rules.get")
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
				log("WARNING - Rule '" .. ruleId .. "' is unknown", "Rules.get")
				--rule = { name = "unknown" }
			end
		elseif (type(ruleId) == "table") then
			if (ruleId.id ~= nil) then
				rule = Rules.get(ruleId.id)
				if (rule ~= ruleId) then
					error("Given rule is not the rule added with this id", "Rules.get")
				end
			else
				error("Given rule has not been retrieved", "Rules.get")
			end

		else
			error("Parameter #1 is not a table", "Rules.get")
		end
		return rule
	end,

	getAll = function ()
		return _rules
	end,

	-- Start all the rules
	start = function ()
		for ruleId, rule in pairs(_rules) do
			Rule.start(rule)
		end
	end,

	-- Stop all the rules
	stop = function ()
		for ruleId, rule in pairs(_rules) do
			Rule.stop(rule)
		end
	end
}

-- **************************************************
-- RulesEngine.RulesFile
-- **************************************************

RulesFile = {
	getContent = function (fileName)
		local lfs = require("lfs")
		local fileName = fileName or "C_RulesEngine_Rules.xml"
		local path = ""
		local wasCompressed = false

		if lfs.attributes("/etc/cmh-ludl/" .. fileName .. ".lzo", "mode") then
			wasCompressed = true
			log("Decompress file '/etc/cmh-ludl/" .. fileName .. ".lzo'", "RulesFile.getContent")
			path = "/tmp/"
			os.execute(decompressScript .. "decompress_lzo_file_in_tmp " .. fileName)
		end

		log("Load content from file '" .. path .. fileName .. "'", "RulesFile.getContent")
		local file = io.open(path .. fileName)
		if (file == nil) then
			log("File '" .. path .. fileName .. "' does not exist", "RulesFile.getContent")
			return
		end

		local content = file:read("*a")
		file:close()

		return content, path, wasCompressed
	end,

	saveContent = function (path, fileName, content, hasToCompress)
		log("Save content into file '" .. path .. fileName .. "'", "RulesFile.saveContent")
		local file = io.open(path .. fileName, "w")
		if (file == nil) then
			log("File '" .. path .. fileName .. "' can not be created", "RulesFile.saveContent")
			return
		end
		file:write(content)
		file:close()
		if (hasToCompress) then
			log("Compress file '/etc/cmh-ludl/" .. fileName .. ".lzo'", "RulesFile.saveContent")
			os.execute(compressScript .. "compress_lzo_file_in_tmp " .. fileName)
		end
	end,

	-- Load rules from xml file (Blockly format)
	-- Get the rule descriptions in the file lzo uploaded by javascript client
	-- For openLuup, this file is save in etc/cmh-ludl
	load = function (fileName, keepFormerRuleWithSameId, ruleIdxes)
		debugLogBegin("RulesFile.load")
		ruleIdxes = string.split(ruleIdxes, ",", tonumber)
		log("Load rules from file '" .. fileName .. "' and idx " .. json.encode(ruleIdxes), "RulesFile.load")

		-- Parser of an LOM item
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
	--log("xmlItem : " .. json.encode(xmlItem))
					item = {}
					item.type = xmlItem.attr.type
					if (item.type == "rule") then
						item.hashcode = xmlItem.attr.hashcode
						item.version = xmlItem.attr.version
					end
					if (xmlItem.attr.id ~= nil) then
						item.id = xmlItem.attr.id
					end
					nextItem = nil
					-- Parse XML sub items
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
						table.append(item, nextItem)
						--print("item", json.encode(item))
						--table.insert(a, 1, item)
					end
	--print("item", json.encode(item))
					if (item.type ~= nil) then
						-- Specific post-processing
						if (string.match(item.type, "^list_with_operator_.*")) then
							-- List with operator
							local items = {}
							for i = 0, (tonumber(item.mutation.items) - 1) do
								table.insert(items, item["ADD" .. tostring(i)] or { type = "empty" })
							end
							item = {
								type = item.type,
								operator = item["operator"],
								items = items
							}
						elseif (string.match(item.type, "^list_with_operators_.*")) then
							-- List with operatorS
							local items = {}
							local operators = {}
							for i = 0, (tonumber(item.mutation.items) - 1) do
								table.insert(items, item["ADD" .. tostring(i)] or { type = "empty" })
								table.insert(operators, (item["operator" .. tostring(i + 1)] or ""))
							end
							item = {
								type = item.type,
								operators = operators,
								items = items
							}
						elseif ((item.type == "lists_create_with") or string.match(item.type, "^list_.*")) then
							-- List
							local items = {}
							for i = 0, (tonumber(item.mutation.items) - 1) do
								table.insert(items, item["ADD" .. tostring(i)] or { type = "empty" })
							end
							item = items
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
				key = "mutation"
				item = table.extend({}, xmlItem.attr)

			else
				--print("tag '" .. json.encode(xmlItem) .. "' not used")
			end

	--print(string.rep(" ", lvl * 2) .. "<-- \"" .. tostring(key) .. "\": " .. tostring(json.encode(item)))
			return item, key
		end

		-- Parse the XML string into LOM (Lua Object Model from LuaExpat)
		local content = RulesFile.getContent(fileName)
		if (content == nil) then
			RulesInfos.save()
			debugLogEnd("RulesFile.load")
			return
		end
		local lom = require("lxp.lom")
		xmltable = lom.parse(content)
	--log(json.encode(xmltable))
	--print("")

		-- Add the rules parsed from XML
		local idx = 1
		if ((type(xmltable) == "table") and (xmltable.tag == "xml")) then
			for _, xmlRule in ipairs(xmltable) do
				if ((type(xmlRule) == "table") and (xmlRule.tag == "block") and (xmlRule.attr.type == "rule")) then
					if ((#ruleIdxes == 0) or (table.contains(ruleIdxes, idx))) then
						local rule = parseXmlItem(xmlRule, 0)
						log("Rule parsed from XML: " .. json.encode(rule), "RulesFile.load", 4)
						rule.id = tonumber(rule.id or "")
						rule.fileName = fileName
						rule.idx = idx -- Index in the XML file
						Rules.add(rule, keepFormerRuleWithSameId)
					end
					idx = idx +1
				end
			end
			if (isInitialized()) then
				Rules.addRulesWithoutId()
				RulesInfos.save()
			end
			--notifyRulesInfosUpdate()
		else
			log("File '" .. fileName .. "' does not contain XML", "RulesFile.load")
		end

		debugLogEnd("RulesFile.load")
	end
}

-- RulesEngine.updatePanel
-- Update HTML panel show on UI
function updatePanel ()
	local status = 0
	local style = ""

	local panel = ""

	if (_verbosity > 1) then
		panel = panel .. '<div style="color:gray;font-size:.7em;text-align:left;">Debug enabled (' .. tostring(_verbosity) .. ')</div>'
	end

	local nbRules, nbArmedRules, nbActiveRules, nbAcknowledgedRules = 0, 0, 0, 0
	for _, rule in pairs(_rules) do
		nbRules = nbRules + 1
		if (rule._context.status == 1) then
			nbActiveRules = nbActiveRules + 1
		end
		if (rule._context.isAcknowledged) then
			nbAcknowledgedRules = nbAcknowledgedRules + 1
		end
	end
	panel = panel .. '<div style="color:gray;font-size:.7em;text-align:left;">' .. tostring(nbRules) .. ' rules</div>'
--print(panel)
	luup.variable_set(SID.RulesEngine, "RulePanel", panel, _params.deviceId)
	luup.variable_set(SID.RulesEngine, "Status", status, _params.deviceId)
end

-- **************************************************
-- Main methods
-- **************************************************

function loadModules ()
	debugLogBegin("loadModules")

	local moduleNames = string.split(_params.modules, ",")
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

	debugLogEnd("loadModules")
end

function loadStartupFiles ()
	debugLogBegin("loadStartupFiles")

	local lfs = require("lfs")
	local fileNames = string.split(_params.startupFiles, ",")
	for _, fileName in ipairs(fileNames) do
		-- Load and execute startup LUA file
		local path = ""
		if lfs.attributes("/etc/cmh-ludl/" .. fileName .. ".lzo", "mode") then
			log("Decompress LUA startup file '/etc/cmh-ludl/" .. tostring(fileName) .. ".lzo'", "loadStartupFiles")
			path = "/tmp/"
			os.execute(decompressScript .. "decompress_lzo_file_in_tmp " .. fileName)
		end
		log("Load LUA startup from file '" .. path .. tostring(fileName) .. "'", "loadStartupFiles")
		if lfs.attributes(path .. fileName, "mode") then
			local startup, errorMessage = loadfile(path .. fileName)
			if (startup ~= nil) then
				log("Execute startup LUA code", "loadStartupFiles")
				-- Put the startup in the plugin environment
				setfenv(startup, getfenv(1))
				local status, result = pcall(startup)
				if not status then
					error(result, "startup")
				end
			else
				error("Can not execute startup LUA code: " .. tostring(errorMessage), "loadStartupFiles")
			end
		else
			warning("File '" .. path .. fileName .. "' does not exist", "loadStartupFiles")
		end
	end

	debugLogEnd("loadStartupFiles")
end

function loadRulesFiles ()
	debugLogBegin("loadRulesFiles")

	local fileNames = string.split(_params.rulesFiles, ",")
	log("Load rules from files", "loadRulesFiles")
	-- Add rules from XML files
	for _, fileName in ipairs(fileNames) do
		RulesFile.load(fileName, true)
	end
	Rules.addRulesWithoutId()

	debugLogEnd("loadRulesFiles")
end

function isEnabled()
	return (_isEnabled == true)
end

function isStarted()
	return (_isStarted == true)
end

function isInitialized()
	return (_isInitialized == true)
end

-- Start engine
function start ()
	debugLogBegin("start")

	if (_isStarted) then
		log("RulesEngine already started", "start")
		return
	end

	log("Start RulesEngine (v" .. _VERSION ..")", "start")
	History.add(os.time(), "General", "Start engine (v" .. _VERSION ..")")
	Rules.start()
	--updatePanel()
	RulesInfos.save()
	--RulesEngine.dump()
	_isStarted = true

	debugLogEnd("start")
end

-- Stop engine
function stop ()
	debugLogBegin("stop")

	if (not _isStarted) then
		log("RulesEngine already stopped", "stop")
		return
	end

	log("Stop RulesEngine", "stop")
	History.add(os.time(), "General", "Stop engine")
	Rules.stop()
	RulesInfos.save()
	_isStarted = false

	debugLogEnd("stop")
end

-- Enable engine
function enable ()
	log("Enable RulesEngine", "enable")
	if (_isEnabled) then
		log("RulesEngine is already enabled", "enable")
		return
	end
	_isEnabled = true
	History.add(os.time(), "General", "Enable engine")
	start()
	Variable.set(_params.deviceId, VARIABLE.SWITCH_POWER, "1")
end

-- Disable engine
function disable ()
	log("Disable RulesEngine", "disable")
	if (not _isEnabled) then
		log("RulesEngine is already disabled", "disable")
		return
	end
	_isEnabled = false
	History.add(os.time(), "General", "Disable engine")
	stop()
	Variable.set(_params.deviceId, VARIABLE.SWITCH_POWER, "0")
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
		-- Rule.init(rule)
	-- end
	_rules = {}
	_indexRulesById = {}
	_indexRulesByName = {}
	_indexRulesByEvent = {}
	_params = {}

	_scheduledTasks = {}
	_nextWakeUps = {}
end

-------------------------------------------
-- HTTP request handler
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
			for _, scheduledTask in ipairs(ScheduledTasks.get()) do
				timeline = timeline .. "<p>" .. os.date("%X", scheduledTask.timeout) .. " - " .. _getItemSummary(scheduledTask.item) .. "</p>"
			end
			timeline = timeline .. "</div>"
			return timeline, "text/plain"

		elseif (outputFormat == "json") then
			log("JSON timeline", "handleCommand.getTimeline")
			local timeline = {
				history = History.get({
					fileName = params["ruleFileName"],
					idx = tonumber(params["ruleIdx"]),
					id = tonumber(params["ruleId"])
				}),
				scheduled = {}
			}
			for _, scheduledTask in ipairs(ScheduledTasks.get()) do
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
		local rulesInfos = RulesInfos.get({
			fileName = params["ruleFileName"],
			idx = tonumber(params["ruleIdx"]),
			id = tonumber(params["ruleId"])
		})
		return tostring(json.encode(rulesInfos)), "application/json"
	end,

	-- ImperiHome Standard System (ISS)
	["ISS"] = function (params, outputFormat)
		local path = params["path"] or "/devices"
		local result

		-- System infos
		if (path == "/system") then
			log("Get system info", "handleCommand.ISS", 2)
			result = {
				id = "RulesEngine-" .. tostring(luup.pk_accesspoint) .. "-" .. _params.deviceId,
				apiversion = 1
			}

		-- Device list
		elseif (path == "/devices") then
			log("Get device list", "handleCommand.ISS", 2)
			result = { devices = {} }
			for _, rule in pairs(_rules) do
				table.insert(result.devices, {
					id   = rule.id,
					name = rule.name,
					type = "DevMotion",
					room = "1",
					idx = rule.idx,
					params = {
						{
							key = "FileName",
							value = rule.fileName
						},
						{
							key = "Armable",
							value = "1"
						},
						{
							key = "Ackable",
							value = ((rule._context.isAcknowledgeable and "1") or "0")
						},
						{
							key = "Armed",
							value = ((rule._context.isArmed and "1") or "0")
						},
						{
							key = "Tripped",
							value = ((((rule._context.status == 1) and not rule._context.isAcknowledged) and "1") or "0")
						},
						{
							key = "Ack",
							value = ((rule._context.isAcknowledged and "1") or "0")
						},
						{
							key = "lasttrip",
							value = rule._context.lastStatusUpdateTime
						}
					}
				})
			end

		-- Actions
		elseif string.find(path, "^/devices/[^%/]+/action/[^%/]+") then
			local deviceId, actionName, actionParam = string.match(path, "^/devices/([^%/]+)/action/([^%/]+)/*([^%/]*)$")
			log("Do action '" .. tostring(actionName) .. "' with param '" .. tostring(actionParam) .. "' on device #" .. tostring(deviceId), "handleCommand.ISS", 2)
			if (actionName == "setArmed") then
				local success, msg = Rule.setArming(deviceId, actionParam)
				result = { success = success, errormsg = msg }
			elseif (actionName == "setAck") then
				--local success, msg = Rule.setAcknowledgement(deviceId, actionParam)
				-- TODO : acknoledgement in ImperiHome can not be canceled
				local success, msg = Rule.setAcknowledgement(deviceId, "1")
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
	--log("lul_request: " .. tostring(lul_request), "handleCommand")
	--log("lul_parameters: " .. tostring(json.encode(lul_parameters)), "handleCommand")
	--log("lul_outputformat: " .. tostring(lul_outputformat), "handleCommand")

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
	Variable.set(lul_device, VARIABLE.PLUGIN_VERSION, _VERSION)
	_isEnabled = (Variable.getOrInit(lul_device, VARIABLE.SWITCH_POWER, "0") == "1")
	Variable.getOrInit(lul_device, VARIABLE.MESSAGE, "")
	Variable.getOrInit(lul_device, VARIABLE.LAST_UPDATE, "")
	_params = {
		deviceId = lul_device,
		modules = Variable.getOrInit(lul_device, VARIABLE.MODULES, "") or "",
		toolboxConfig = Variable.getOrInit(lul_device, VARIABLE.TOOLBOX_CONFIG, "") or "",
		startupFiles = Variable.getOrInit(lul_device, VARIABLE.STARTUP_FILES, "C_RulesEngine_Startup.lua") or "",
		rulesFiles = Variable.getOrInit(lul_device, VARIABLE.RULES_FILES, "C_RulesEngine_Rules.xml") or ""
	}

	--[[
	-- Store path
	if (not Store.setPath(Variable.getOrInit(lul_device, VARIABLE.STORE_PATH, "/tmp/log/cmh/rules"))) then
		-- critical error
	end
	--]]

	-- Get debug mode
	setVerbosity(Variable.getOrInit(lul_device, VARIABLE.DEBUG_MODE, "0"))

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
	History.load()
	RulesInfos.load()
	loadRulesFiles()
	RulesInfos.remove({ isFormer = true })

	_isInitialized = true

	if (isEnabled()) then
		start()
	end
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
	luup.variable_watch("RulesEngine.Event.onDebugValueIsUpdated", SID.RulesEngine, "Debug", lul_device)

	-- Handlers
	luup.register_handler("RulesEngine.handleCommand", "RulesEngine")

	-- Deferred startup
	luup.call_delay("RulesEngine.deferredStartup", 1)

	-- Register with ALTUI
	luup.call_delay("RulesEngine.registerWithALTUI", 10)

	luup.set_failure(0, lul_device)
	return true
end


ScheduledTasks.createIndexFunctionNames()


local RulesEngine = {
	log = log,
	--
	Rule = Rule,
	Rules = Rules,
	RulesFile = RulesFile,
	--
	start = start,
	stop = stop,
	enable = enable,
	disable = disable,
	isEnabled = isEnabled,
	isStarted = isStarted,
	--
	getEnhancedMessage = getEnhancedMessage,
	getDeviceIdByName = _getDeviceIdByName,
	addHook = Hooks.add,
	doHook = Hooks.execute,
	addActionType = ActionTypes.add,
	ActionTypes = ActionTypes,
	ActionGroups = ActionGroups,
	doRuleActions = ActionGroups.execute,
	setVerbosity = setVerbosity,
	setMinRecurrentInterval = setMinRecurrentInterval,
	--
	startup = startup
}
-- Expose the RulesEngine in the Global Name Space for custom scripts
_G["RulesEngine"] = RulesEngine

_G["RulesEngine.Tools"] = {
	formatMessage = getEnhancedMessage
}
-- Promote the functions used by Vera's luup.xxx functions to the Global Name Space
_G["RulesEngine.Event.onDeviceVariableIsUpdated"] = Event.onDeviceVariableIsUpdated
_G["RulesEngine.Event.onTimerIsTriggered"] = Event.onTimerIsTriggered

_G["RulesEngine.initPluginInstance"] = _initPluginInstance
_G["RulesEngine.Event.onDebugValueIsUpdated"] = Event.onDebugValueIsUpdated
_G["RulesEngine.deferredStartup"] = _deferredStartup
_G["RulesEngine.handleCommand"] = _handleCommand
_G["RulesEngine.registerWithALTUI"] = _registerWithALTUI

_G["RulesEngine.ScheduledTasks.execute"] = ScheduledTasks.execute
--_G["RulesEngine.ActionGroup.execute"] = ActionGroup.execute
--_G["RulesEngine.Condition.updateStatus"] = Condition.updateStatus
_G["RulesEngine.Rule.updateStatus"] = Rule.updateStatus

-- TODO : to check
return RulesEngine