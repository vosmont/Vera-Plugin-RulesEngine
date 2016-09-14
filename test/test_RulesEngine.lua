-- Unit tests

local _verbosity = 4

local t = require( "tests.luaunit" )
local RulesEngine = require( "L_RulesEngine1" )
local json = require( "dkjson" )

luup.variable_set( "urn:upnp-org:serviceId:RulesEngine1", "NoLoadIfDisabled", "1", RulesEngine.getDeviceIdByName( "RulesEngine" ) )
RulesEngine.setVerbosity( 4 )
t.LuaUnit:setVerbosity( _verbosity )
RulesEngine.setMinRecurrentInterval( 1 )

-- Log messages concerning these unit tests
local function log( msg )
	RulesEngine.log( "### " .. msg, "Test" )
end

-- Trace inside calls to be able to check them
local _calls = {}
function traceCall( ruleName, event )
	if ( _calls[ruleName] == nil ) then
		_calls[ruleName] = {}
	end
	if ( _calls[ruleName][event] == nil ) then
		_calls[ruleName][event] = 0
	end
	_calls[ruleName][event] = _calls[ruleName][event] + 1
	log( "   " .. ruleName .. "-" .. event .. " has been called: " .. tostring( _calls[ruleName][event] ) )
end

-- *****************************************************
-- Time hook
-- *****************************************************

local socket = require( "socket" )
local socketGetTimeFunction = socket.gettime
local osTimeFunction = os.time
local osDateFunction = os.date

local _offset = 0

socket.gettime = function()
	local fakeTime = socketGetTimeFunction()
	return fakeTime + _offset
end
_G.os.time = function( t )
	local fakeTime = osTimeFunction( t )
	if ( t == nil ) then
		fakeTime = fakeTime + _offset
	end
	return fakeTime
end
_G.os.date = function( dateFormat, t )
	if ( t == nil ) then
		t = os.time()
	end
	return osDateFunction( dateFormat, t )
end

-- Set current time
function setTime( fakeT )
	log( "======================================================================================" )
	log( "/!\\ Set time : " .. json.encode( fakeT ) )
	local currentFakeTime = os.time()
	-- Set hours, minutes, secondes
	local fakeTime = osTimeFunction( {
		year  = osDateFunction( "%Y", currentFakeTime ),
		month = osDateFunction( "%m", currentFakeTime ),
		day   = osDateFunction( "%d", currentFakeTime ),
		hour  = fakeT.hour,
		min   = fakeT.min,
		sec   = fakeT.sec
	} )
	-- Week day
	if ( fakeT.wday ) then
		local t = osDateFunction( "*t", fakeTime )
		local offset = ( fakeT.wday - t.wday - 1) % 7 + 1
		if ( ( offset ~= 7 ) or ( fakeTime <= currentFakeTime ) ) then
			fakeTime = fakeTime + offset * 24 * 60 * 60
		end
	end
	log( osDateFunction( "%Y-%m-%d %H:%M:%S", currentFakeTime ) .. " => " .. osDateFunction( "%Y-%m-%d %H:%M:%S", fakeTime ) )
	local now = osTimeFunction()
	_offset = os.difftime( fakeTime, now )

	luup.refresh_timers()
	log( "======================================================================================" )
end

function setVariableIfChange( service, variable, newValue, deviceId )
	local value = luup.variable_get( service, variable, deviceId )
	if ( newValue ~= value ) then
		luup.variable_set( service, variable, newValue, deviceId )
	end
end

function resetEngine()
	--log( "Reset engine" )
	RulesEngine.Test.resetTasks()
	RulesEngine.Test.resetRules()
end

function resetDevices()
	--log( "Reset devices" )
	for deviceId, device in ipairs( luup.devices ) do
		local deviceType = luup.attr_get( "device_type", deviceId )
		if ( deviceType == "urn:schemas-micasaverde-com:device:MotionSensor:1" ) then
			setVariableIfChange( "urn:micasaverde-com:serviceId:SecuritySensor1", "Armed", "0", deviceId )
			setVariableIfChange( "urn:micasaverde-com:serviceId:SecuritySensor1", "Tripped", "0", deviceId )
		elseif ( deviceType == "urn:schemas-upnp-org:device:BinaryLight:1" ) then
			setVariableIfChange( "urn:upnp-org:serviceId:SwitchPower1", "Status", "0", deviceId )
		elseif ( deviceType == "urn:schemas-upnp-org:device:DimmableLight:1" ) then
			setVariableIfChange( "urn:upnp-org:serviceId:SwitchPower1", "Status", "0", deviceId )
			setVariableIfChange( "urn:upnp-org:serviceId:Dimming1", "LoadLevelStatus", "0", deviceId )
		elseif ( deviceType == "urn:schemas-micasaverde-com:device:TemperatureSensor:1" ) then
			setVariableIfChange( "urn:upnp-org:serviceId:TemperatureSensor1", "CurrentTemperature", "0", deviceId )
		end
	end
end

function disarmRules()
	log( "Disarm rules" )
	for _, rule in ipairs( RulesEngine.Rules.getAll() ) do
		if RulesEngine.Rule.isArmed( rule ) then
			RulesEngine.Rule.setArming( rule, false )
		end
	end
end

-- Wrap temporary a function in the global context
-- Make the function reacheable by luup fonctions
-- Once the function is called, the pointer in the global context
-- is released for garbage collecting
function wrapAnonymousCallback( callback )
	local callbackName = "anonymousCallback-" .. tostring(callback)
	_G[callbackName] = function( ... )
		local args = {...}
		callback( unpack( args ) )
		_G[callbackName] = nil
	end
	return callbackName
end

-- Execute an asynchronous test sequence, 
-- params are functions to execute by LuaUnit and optionnal waiting times
local _sequenceItemIdx
function _doAsyncTestSequence( ... )
	local args = {...}
	local firstArg = table.remove( args, 1 )
	if ( type( firstArg ) == "number" ) then
		log( "Wait " .. firstArg .. " second(s) before doing sequence part #" .. _sequenceItemIdx )
		luup.call_delay(
			wrapAnonymousCallback( function()
				_doAsyncTestSequence( unpack( args ) )
			end ),
			firstArg, ""
		)
	elseif ( type( firstArg ) == "function" ) then
		-- Execute by LuaUnit (to catch error)
		log( "-------> Begin of sequence part #" .. _sequenceItemIdx )
		local ok, errMsg = t.protectedCall( firstArg )
		log( "<------- End of sequence part #" .. _sequenceItemIdx )
		if ok then
			-- If there's no error, resume the sequence
			if (#args > 0) then
				_sequenceItemIdx = _sequenceItemIdx + 1
				_doAsyncTestSequence( unpack( args ) )
			end
		else
			-- Otherwise, the test sequence is finished
			log( "There's an error : stop test sequence" )
			t.done()
			return
		end
	else
		-- error
		log( "arg of type " .. type( firstArg ) .. " is not handled" )
	end
	if ( #args == 0 ) then
		-- It's finished
		t.done()
	end
end
function doAsyncTestSequence( ... )
	_sequenceItemIdx = 1
	_doAsyncTestSequence( ... )
end

-- **************************************************
-- RulesEngine TestCases
-- **************************************************

TestRulesEngine = {}

	function TestRulesEngine:setUp( testName )
		log( "\n\n-------> Begin of TestCase '" .. tostring(testName) .. "'\n" )
		log( "********************************************************" )
		log( "Initialize environment" )
		resetEngine()
		resetDevices()
		RulesEngine.enable( false )
		log( "********************************************************" )
		log( "START OF THE TEST" )
	end

	function TestRulesEngine:tearDown( testName )
		log( "END OF THE TEST" )
		log( "********************************************************" )
		log( "Clear environment" )
		RulesEngine.disable()
		resetDevices()
		log( "********************************************************" )
		log( "\n\n<------- End of TestCase '" .. tostring(testName) .. "'\n" )
	end

	function TestRulesEngine:asynctest_condition_value_EQ()
		RulesEngine.RulesFile.load( nil, nil, nil, "Rule_Condition_Value_EQ" )
		doAsyncTestSequence(
			function()
				log("(Value ==) Under")
				luup.variable_set("urn:upnp-org:serviceId:TemperatureSensor1", "CurrentTemperature", 9.2, RulesEngine.getDeviceIdByName("Temperature 1"))
			end,
			1,
			function()
				t.assertFalse(RulesEngine.Rule.isActive("Rule_Condition_Value_EQ"))
				log("(Value ==) Equals")
				luup.variable_set("urn:upnp-org:serviceId:TemperatureSensor1", "CurrentTemperature", 10.0, RulesEngine.getDeviceIdByName("Temperature 1"))
			end,
			1,
			function()
				t.assertTrue(RulesEngine.Rule.isActive("Rule_Condition_Value_EQ"))
				log("(Value ==) Above")
				luup.variable_set("urn:upnp-org:serviceId:TemperatureSensor1", "CurrentTemperature", "11", RulesEngine.getDeviceIdByName("Temperature 1"))
			end,
			1,
			function()
				t.assertFalse(RulesEngine.Rule.isActive("Rule_Condition_Value_EQ"))
			end
		)
	end

	function TestRulesEngine:asynctest_condition_value_LTE()
		RulesEngine.RulesFile.load( nil, nil, nil, "Rule_Condition_Value_LTE" )
		doAsyncTestSequence(
			function()
				log("(Value <=) Under and negative")
				luup.variable_set("urn:upnp-org:serviceId:TemperatureSensor1", "CurrentTemperature", "-10.1", RulesEngine.getDeviceIdByName("Temperature 2"))
			end,
			1,
			function()
				t.assertTrue(RulesEngine.Rule.isActive("Rule_Condition_Value_LTE"))
				log("(Value <=) Under")
				luup.variable_set("urn:upnp-org:serviceId:TemperatureSensor1", "CurrentTemperature", 9.9, RulesEngine.getDeviceIdByName("Temperature 2"))
			end,
			1,
			function()
				t.assertTrue(RulesEngine.Rule.isActive("Rule_Condition_Value_LTE"))
				log("(Value <=) Equals")
				luup.variable_set("urn:upnp-org:serviceId:TemperatureSensor1", "CurrentTemperature", 10.0, RulesEngine.getDeviceIdByName("Temperature 2"))
			end,
			1,
			function()
				t.assertTrue(RulesEngine.Rule.isActive("Rule_Condition_Value_LTE"))
				log("(Value <=) Above")
				luup.variable_set("urn:upnp-org:serviceId:TemperatureSensor1", "CurrentTemperature", "10.1", RulesEngine.getDeviceIdByName("Temperature 2"))
			end,
			1,
			function()
				t.assertFalse(RulesEngine.Rule.isActive("Rule_Condition_Value_LTE"))
			end
		)
	end

	function TestRulesEngine:asynctest_condition_value_GTE()
		RulesEngine.RulesFile.load( nil, nil, nil, "Rule_Condition_Value_GTE" )
		doAsyncTestSequence(
			function()
				log("(Value >=) Above")
				luup.variable_set("urn:upnp-org:serviceId:TemperatureSensor1", "CurrentTemperature", "20.11", RulesEngine.getDeviceIdByName("Temperature 2"))
			end,
			1,
			function()
				t.assertTrue(RulesEngine.Rule.isActive("Rule_Condition_Value_GTE"))
				log("(Value >=) Equals")
				luup.variable_set("urn:upnp-org:serviceId:TemperatureSensor1", "CurrentTemperature", 20.1, RulesEngine.getDeviceIdByName("Temperature 2"))
			end,
			1,
			function()
				t.assertTrue(RulesEngine.Rule.isActive("Rule_Condition_Value_GTE"))
				log("(Value >=) Under")
				luup.variable_set("urn:upnp-org:serviceId:TemperatureSensor1", "CurrentTemperature", "20.09", RulesEngine.getDeviceIdByName("Temperature 2"))
			end,
			1,
			function()
				t.assertFalse(RulesEngine.Rule.isActive("Rule_Condition_Value_GTE"))
			end
		)
	end

	function TestRulesEngine:asynctest_condition_value_NEQ()
		RulesEngine.RulesFile.load( nil, nil, nil, "Rule_Condition_Value_NEQ" )
		doAsyncTestSequence(
			function()
				log("(Value <>) Above")
				luup.variable_set("urn:upnp-org:serviceId:TemperatureSensor1", "CurrentTemperature", "20.01", RulesEngine.getDeviceIdByName("Temperature 3"))
			end,
			1,
			function()
				t.assertTrue(RulesEngine.Rule.isActive("Rule_Condition_Value_NEQ"))
				log("(Value <>) Equals")
				luup.variable_set("urn:upnp-org:serviceId:TemperatureSensor1", "CurrentTemperature", 20.0, RulesEngine.getDeviceIdByName("Temperature 3"))
			end,
			1,
			function()
				t.assertFalse(RulesEngine.Rule.isActive("Rule_Condition_Value_NEQ"))
				log("(Value <>) Under")
				luup.variable_set("urn:upnp-org:serviceId:TemperatureSensor1", "CurrentTemperature", "19.99", RulesEngine.getDeviceIdByName("Temperature 3"))
			end,
			1,
			function()
				t.assertTrue(RulesEngine.Rule.isActive("Rule_Condition_Value_NEQ"))
				log("(Value <>) Equals")
				luup.variable_set("urn:upnp-org:serviceId:TemperatureSensor1", "CurrentTemperature", "20.00", RulesEngine.getDeviceIdByName("Temperature 3"))
			end,
			1,
			function()
				t.assertFalse(RulesEngine.Rule.isActive("Rule_Condition_Value_NEQ"))
			end
		)
	end

	function TestRulesEngine:asynctest_condition_value_LIKE()
		RulesEngine.RulesFile.load( nil, nil, nil, "Rule_Condition_Value_LIKE" )
		doAsyncTestSequence(
			function()
				log("(Value like) Not like")
				luup.variable_set("urn:upnp-org:serviceId:TemperatureSensor1", "CurrentTemperature", "1test2", RulesEngine.getDeviceIdByName("Temperature 4"))
			end,
			1,
			function()
				t.assertFalse(RulesEngine.Rule.isActive("Rule_Condition_Value_LIKE"))
				log("(Value like) Like")
				luup.variable_set("urn:upnp-org:serviceId:TemperatureSensor1", "CurrentTemperature", "test_123", RulesEngine.getDeviceIdByName("Temperature 4"))
			end,
			1,
			function()
				t.assertTrue(RulesEngine.Rule.isActive("Rule_Condition_Value_LIKE"))
				log("(Value like) Not like")
				luup.variable_set("urn:upnp-org:serviceId:TemperatureSensor1", "CurrentTemperature", "test456", RulesEngine.getDeviceIdByName("Temperature 4"))
			end,
			1,
			function()
				t.assertFalse(RulesEngine.Rule.isActive("Rule_Condition_Value_LIKE"))
			end
		)
	end

	function TestRulesEngine:asynctest_condition_value_NOTLIKE()
		RulesEngine.RulesFile.load( nil, nil, nil, "Rule_Condition_Value_NOTLIKE" )
		doAsyncTestSequence(
			function()
				log("(Value not like) Like")
				luup.variable_set("urn:upnp-org:serviceId:TemperatureSensor1", "CurrentTemperature", "test_2", RulesEngine.getDeviceIdByName("Temperature 5"))
			end,
			1,
			function()
				t.assertFalse(RulesEngine.Rule.isActive("Rule_Condition_Value_NOTLIKE"))
				log("(Value not like) Not like")
				luup.variable_set("urn:upnp-org:serviceId:TemperatureSensor1", "CurrentTemperature", "something", RulesEngine.getDeviceIdByName("Temperature 5"))
			end,
			1,
			function()
				t.assertTrue(RulesEngine.Rule.isActive("Rule_Condition_Value_NOTLIKE"))
				log("(Value not like) Like")
				luup.variable_set("urn:upnp-org:serviceId:TemperatureSensor1", "CurrentTemperature", "824test_456", RulesEngine.getDeviceIdByName("Temperature 5"))
			end,
			1,
			function()
				t.assertFalse(RulesEngine.Rule.isActive("Rule_Condition_Value_NOTLIKE"))
			end
		)
	end

	function TestRulesEngine:asynctest_condition_value_multi()
		RulesEngine.RulesFile.load( nil, nil, nil, "Rule_Condition_Value_Multi" )
		doAsyncTestSequence(
			function()
				log( "Condition 1 OK and condition 2 KO" )
				luup.variable_set( "urn:micasaverde-com:serviceId:SecuritySensor1", "Armed", "1", RulesEngine.getDeviceIdByName( "Motion 1" ) )
				luup.variable_set( "urn:micasaverde-com:serviceId:SecuritySensor1", "Tripped", "0", RulesEngine.getDeviceIdByName( "Motion 1" ) )
			end,
			1,
			function()
				t.assertFalse( RulesEngine.Rule.isActive( "Rule_Condition_Value_Multi" ) )
				log( "Condition 1 OK and condition 2 OK" )
				luup.variable_set( "urn:micasaverde-com:serviceId:SecuritySensor1", "Tripped", 1, RulesEngine.getDeviceIdByName( "Motion 1" ) )
			end,
			1,
			function()
				t.assertTrue( RulesEngine.Rule.isActive( "Rule_Condition_Value_Multi" ) )
				log( "Condition 1 and condition 2 KO" )
				luup.variable_set( "urn:micasaverde-com:serviceId:SecuritySensor1", "Armed", "0", RulesEngine.getDeviceIdByName( "Motion 1" ) )
				luup.variable_set( "urn:micasaverde-com:serviceId:SecuritySensor1", "Tripped", "0", RulesEngine.getDeviceIdByName( "Motion 1" ) )
			end,
			1,
			function()
				t.assertFalse( RulesEngine.Rule.isActive( "Rule_Condition_Value_Multi" ) )
			end
		)
	end

	function TestRulesEngine:asynctest_condition_time()
		RulesEngine.RulesFile.load( nil, nil, nil, "Rule_Condition_Time" )
		doAsyncTestSequence(
			1,
			function()
				setTime( { wday = 2, hour = 0, min = 0, sec = 1 } ) -- Monday (1) at 00:00:01 to be able to calculate sunset
			end,
			5,
			function()
				local fakeDate = os.date( "*t", luup.sunset() + 90 * 60 - 3 )
				setTime( { hour = fakeDate.hour, min = fakeDate.min, sec = fakeDate.sec } )
			end,
			2,
			function()
				log( "Time just before" )
				t.assertFalse( RulesEngine.Rule.isActive( "Rule_Condition_Time" ) )
				t.assertEquals( luup.variable_get( "urn:upnp-org:serviceId:SwitchPower1", "Status", RulesEngine.getDeviceIdByName( "BinaryLight 1" ) ), "0" )
			end,
			3,
			function()
				log( "Time just after" )
				t.assertFalse( RulesEngine.Rule.isActive( "Rule_Condition_Time" ) )
				t.assertEquals( luup.variable_get( "urn:upnp-org:serviceId:SwitchPower1", "Status", RulesEngine.getDeviceIdByName( "BinaryLight 1" ) ), "1" )
			end
		)
	end

	function TestRulesEngine:asynctest_condition_time_between_same_day()
		RulesEngine.RulesFile.load( nil, nil, nil, "Rule_Condition_Time_Between_Same_Day" )
		doAsyncTestSequence(
			1,
			function()
				setTime( { wday = 3, hour = 0, min = 0, sec = 1 } ) -- Tuesday (2) at 00:00:01 to be able to calculate sunset
			end,
			5,
			function()
				setTime( { hour = 7, min = 59, sec = 57 } )
			end,
			2,
			function()
				log( "Time just before first boundary" )
				t.assertFalse( RulesEngine.Rule.isActive( "Rule_Condition_Time_Between_Same_Day" ) )
			end,
			3,
			function()
				log( "Time just after first boundary" )
				t.assertTrue( RulesEngine.Rule.isActive( "Rule_Condition_Time_Between_Same_Day" ) )
				local fakeDate = os.date( "*t", luup.sunset() + 30 * 60 - 3 )
				setTime( { hour = fakeDate.hour, min = fakeDate.min, sec = fakeDate.sec } )
			end,
			1,
			function()
				log( "Time just before second boundary" )
				t.assertTrue( RulesEngine.Rule.isActive( "Rule_Condition_Time_Between_Same_Day" ) )
			end,
			4,
			function()
				log( "Time just after second boundary" )
				t.assertFalse( RulesEngine.Rule.isActive( "Rule_Condition_Time_Between_Same_Day" ) )
			end
		)
	end

	function TestRulesEngine:asynctest_condition_time_between_two_days()
		RulesEngine.RulesFile.load( nil, nil, nil, "Rule_Condition_Time_Between_Two_Days" )
		doAsyncTestSequence(
			1,
			function()
				setTime( { wday = 5, hour = 0, min = 0, sec = 1 } ) -- Thursday (4) at 00:00:01 to be able to calculate sunrise
			end,
			5,
			function()
				local fakeDate = os.date( "*t", luup.sunrise() - 30 * 60 - 3 )
				setTime( { hour = fakeDate.hour, min = fakeDate.min, sec = fakeDate.sec } )
			end,
			1,
			function()
				log( "Day 1 - Time just before second boundary" )
				t.assertFalse( RulesEngine.Rule.isActive( "Rule_Condition_Time_Between_Two_Days" ) )
			end,
			4,
			function()
				log( "Day 1 - Time just after second boundary" )
				t.assertFalse( RulesEngine.Rule.isActive( "Rule_Condition_Time_Between_Two_Days" ) )
				setTime( { hour = 20, min = 59, sec = 57 } )
			end,
			1,
			function()
				log( "Day 1 - Time just before first boundary" )
				t.assertFalse( RulesEngine.Rule.isActive( "Rule_Condition_Time_Between_Two_Days" ) )
			end,
			4,
			function()
				log( "Day 1 - Time just after first boundary" )
				t.assertTrue( RulesEngine.Rule.isActive( "Rule_Condition_Time_Between_Two_Days" ) )
				setTime( { wday = 6, hour = 0, min = 0, sec = 1 } ) -- Friday (5) at 00:00:01 to be able to calculate sunrise
			end,
			1,
			function()
				local fakeDate = os.date( "*t", luup.sunrise() - 30 * 60 - 3 )
				setTime( { hour = fakeDate.hour, min = fakeDate.min, sec = fakeDate.sec } )
			end,
			1,
			function()
				log("Day 2 - Time just before second boundary")
				t.assertTrue( RulesEngine.Rule.isActive( "Rule_Condition_Time_Between_Two_Days" ) )
			end,
			4,
			function()
				log( "Day 2 - Time just after second boundary" )
				t.assertFalse( RulesEngine.Rule.isActive( "Rule_Condition_Time_Between_Two_Days" ) )
				setTime( { hour = 20, min = 59, sec = 57 } )
			end,
			1,
			function()
				log( "Day 2 - Time just before first boundary" )
				t.assertFalse( RulesEngine.Rule.isActive( "Rule_Condition_Time_Between_Two_Days" ) )
			end,
			4,
			function()
				log( "Day 2 - Time just after first boundary" )
				t.assertTrue( RulesEngine.Rule.isActive( "Rule_Condition_Time_Between_Two_Days" ) )
				setTime( { wday = 7, hour = 0, min = 0, sec = 1 } ) -- Saturday (6) at 00:00:01 to be able to calculate sunrise
			end,
			1,
			function()
				local fakeDate = os.date( "*t", luup.sunrise() - 30 * 60 - 3 )
				setTime( { hour = fakeDate.hour, min = fakeDate.min, sec = fakeDate.sec } )
			end,
			1,
			function()
				log("Day 3 - Time just before second boundary")
				t.assertTrue( RulesEngine.Rule.isActive( "Rule_Condition_Time_Between_Two_Days" ) )
			end,
			4,
			function()
				log("Day 3 - Time just after second boundary")
				t.assertFalse( RulesEngine.Rule.isActive( "Rule_Condition_Time_Between_Two_Days" ) )
				setTime( { hour = 20, min = 59, sec = 57 } )
			end,
			1,
			function()
				log( "Day 3 - Time just before first boundary" )
				t.assertFalse( RulesEngine.Rule.isActive( "Rule_Condition_Time_Between_Two_Days" ) )
			end,
			4,
			function()
				log( "Day 3 - Time just after first boundary" )
				t.assertFalse( RulesEngine.Rule.isActive( "Rule_Condition_Time_Between_Two_Days" ) )
			end
		)
	end

	function TestRulesEngine:asynctest_condition_level()
		RulesEngine.RulesFile.load( nil, nil, nil, "Rule_Level" )
		doAsyncTestSequence(
			1,
			function()
				t.assertFalse( RulesEngine.Rule.isActive( "Rule_Level" ) )
				t.assertEquals( RulesEngine.Rule.getLevel( "Rule_Level" ), 0 )
				log( "Condition level 1" )
				luup.variable_set( "urn:upnp-org:serviceId:TemperatureSensor1", "CurrentTemperature", 10.1, RulesEngine.getDeviceIdByName( "Temperature 1" ) )
			end,
			2,
			function()
				log( "Rule level 1" )
				t.assertTrue( RulesEngine.Rule.isActive( "Rule_Level" ) )
				t.assertEquals( RulesEngine.Rule.getLevel( "Rule_Level" ), 1 )
				t.assertEquals( luup.variable_get( "urn:upnp-org:serviceId:Dimming1", "LoadLevelStatus", RulesEngine.getDeviceIdByName( "DimmableLight 1" ) ), "50" )
				log( "Condition level 2" )
				luup.variable_set( "urn:upnp-org:serviceId:TemperatureSensor1", "CurrentTemperature", 20.1, RulesEngine.getDeviceIdByName( "Temperature 1" ) )
			end,
			2,
			function()
				log( "Rule level 2" )
				t.assertTrue( RulesEngine.Rule.isActive( "Rule_Level" ) )
				t.assertEquals( RulesEngine.Rule.getLevel( "Rule_Level" ), 2 )
				t.assertEquals( luup.variable_get( "urn:upnp-org:serviceId:Dimming1", "LoadLevelStatus", RulesEngine.getDeviceIdByName( "DimmableLight 1" ) ), "70" )
				log( "Condition level 3" )
				luup.variable_set( "urn:micasaverde-com:serviceId:SecuritySensor1", "Armed", "1", RulesEngine.getDeviceIdByName( "Motion 1" ) )
				luup.variable_set( "urn:micasaverde-com:serviceId:SecuritySensor1", "Tripped", "1", RulesEngine.getDeviceIdByName( "Motion 1" ) )
			end,
			2,
			function()
				log( "Rule level 3" )
				t.assertTrue( RulesEngine.Rule.isActive( "Rule_Level" ) )
				t.assertEquals( RulesEngine.Rule.getLevel( "Rule_Level" ), 3 )
				t.assertEquals( luup.variable_get( "urn:upnp-org:serviceId:Dimming1", "LoadLevelStatus", RulesEngine.getDeviceIdByName( "DimmableLight 1" ) ), "100" )
				log( "Condition off" )
				luup.variable_set( "urn:upnp-org:serviceId:TemperatureSensor1", "CurrentTemperature", "0", RulesEngine.getDeviceIdByName( "Temperature 1" ) )
				luup.variable_set( "urn:micasaverde-com:serviceId:SecuritySensor1", "Armed", "0", RulesEngine.getDeviceIdByName( "Motion 1" ) )
				luup.variable_set( "urn:micasaverde-com:serviceId:SecuritySensor1", "Tripped", "0", RulesEngine.getDeviceIdByName( "Motion 1" ) )
			end,
			1,
			function()
				t.assertFalse( RulesEngine.Rule.isActive( "Rule_Level" ) )
				t.assertEquals( RulesEngine.Rule.getLevel( "Rule_Level" ), 0 )
			end
		)
	end

	function TestRulesEngine:asynctest_condition_since()
		RulesEngine.RulesFile.load( nil, nil, nil, "Rule_Condition_Since" )
		doAsyncTestSequence(
			1,
			function()
				t.assertFalse( RulesEngine.Rule.isActive( "Rule_Condition_Since" ) )
				log( "Condition 1 OK" )
				luup.variable_set( "urn:upnp-org:serviceId:SwitchPower1", "Status", 1, RulesEngine.getDeviceIdByName( "Switch 7" ) )
			end,
			1,
			function()
				log( "Condition 1 OK - Rule OFF before since interval" )
				t.assertFalse( RulesEngine.Rule.isActive( "Rule_Condition_Since" ) )
			end,
			2,
			function()
				log( "Condition 1 OK - Rule ON after since interval" )
				t.assertTrue( RulesEngine.Rule.isActive( "Rule_Condition_Since" ) )
				log( "Condition 1 KO" )
				luup.variable_set( "urn:upnp-org:serviceId:SwitchPower1", "Status", 0, RulesEngine.getDeviceIdByName( "Switch 7" ) )
			end,
			1,
			function()
				log( "Rule OFF" )
				t.assertFalse( RulesEngine.Rule.isActive( "Rule_Condition_Since" ) )
				log( "Condition 2 OK" )
				luup.variable_set( "urn:micasaverde-com:serviceId:SecuritySensor1", "Armed", "1", RulesEngine.getDeviceIdByName( "Motion 4" ) )
				luup.variable_set( "urn:micasaverde-com:serviceId:SecuritySensor1", "Tripped", "1", RulesEngine.getDeviceIdByName( "Motion 4" ) )
			end,
			1,
			function()
				log( "Condition 2 OK - Rule OFF before since interval" )
				t.assertFalse( RulesEngine.Rule.isActive( "Rule_Condition_Since" ) )
			end,
			2,
			function()
				log( "Condition 2 OK - Rule ON after since interval" )
				t.assertTrue( RulesEngine.Rule.isActive( "Rule_Condition_Since" ) )
				log( "Condition 2 KO" )
				luup.variable_set( "urn:micasaverde-com:serviceId:SecuritySensor1", "Armed", "0", RulesEngine.getDeviceIdByName( "Motion 4" ) )
				luup.variable_set( "urn:micasaverde-com:serviceId:SecuritySensor1", "Tripped", "0", RulesEngine.getDeviceIdByName( "Motion 4" ) )
			end,
			1,
			function()
				log( "Rule OFF" )
				t.assertFalse( RulesEngine.Rule.isActive( "Rule_Condition_Since" ) )
			end
		)
	end

	function TestRulesEngine:asynctest_condition_sequence()
		RulesEngine.RulesFile.load( nil, nil, nil, "Rule_Condition_Sequence" )
		doAsyncTestSequence(
			1,
			function()
				t.assertFalse( RulesEngine.Rule.isActive( "Rule_Condition_Sequence" ) )
				log( "Item 1 OK" )
				luup.variable_set( "urn:micasaverde-com:serviceId:SecuritySensor1", "Armed", "1", RulesEngine.getDeviceIdByName( "Motion 1" ) )
				luup.variable_set( "urn:micasaverde-com:serviceId:SecuritySensor1", "Tripped", "1", RulesEngine.getDeviceIdByName( "Motion 1" ) )
			end,
			1,
			function()
				log( "Rule OFF" )
				t.assertFalse( RulesEngine.Rule.isActive( "Rule_Condition_Sequence" ) )
				log( "Item 2 OK too quickly" )
				luup.variable_set( "urn:micasaverde-com:serviceId:SecuritySensor1", "Armed", "1", RulesEngine.getDeviceIdByName( "Motion 2" ) )
				luup.variable_set( "urn:micasaverde-com:serviceId:SecuritySensor1", "Tripped", "1", RulesEngine.getDeviceIdByName( "Motion 2" ) )
			end,
			2,
			function()
				log( "Rule OFF" )
				t.assertFalse( RulesEngine.Rule.isActive( "Rule_Condition_Sequence" ) )
				log( "Item 2 KO" )
				luup.variable_set( "urn:micasaverde-com:serviceId:SecuritySensor1", "Tripped", "0", RulesEngine.getDeviceIdByName( "Motion 2" ) )
			end,
			2,
			function()
				log( "Item 2 OK" )
				luup.variable_set( "urn:micasaverde-com:serviceId:SecuritySensor1", "Tripped", "1", RulesEngine.getDeviceIdByName( "Motion 2" ) )
			end,
			1,
			function()
				log( "Rule ON" )
				t.assertTrue( RulesEngine.Rule.isActive( "Rule_Condition_Sequence" ) )
				log( "Item 1 KO" )
				luup.variable_set( "urn:micasaverde-com:serviceId:SecuritySensor1", "Tripped", "0", RulesEngine.getDeviceIdByName( "Motion 1" ) )
			end,
			1,
			function()
				log( "Rule OFF" )
				t.assertFalse( RulesEngine.Rule.isActive( "Rule_Condition_Sequence" ) )
			end
		)
	end

	function TestRulesEngine:test_tools_enhanced_message()
		local message
		local context = {}

		log( "#value#" )

		context.value = 15
		message = RulesEngine.getEnhancedMessage( "valeur #value#", context )
		t.assertEquals( message, "valeur 15" )

		context.value = "32"
		message = RulesEngine.getEnhancedMessage( "valeur #value#", context )
		t.assertEquals( message, "valeur 32" )

		--log("#value_N#")

		--context.values = {
		--	"10",
		--	{"20", 30}
		--}
		--message = RulesEngine.getEnhancedMessage ("valeur #value_1#", context)
		--assertEquals(message, "valeur 10", "Value String")
		--message = RulesEngine.getEnhancedMessage ("valeur #value_2_2#", context)
		--assertEquals(message, "valeur 30", "Value Integer")

		log( "#duration# and #durationfull#" )

		context.lastStatusUpdateTime = os.time() - 1
		message = RulesEngine.getEnhancedMessage( "durée - #duration# - #durationfull#", context )
		t.assertEquals( message, "durée - PT1S - une seconde" )

		context.lastStatusUpdateTime = os.time() - 2
		message = RulesEngine.getEnhancedMessage( "durée - #duration# - #durationfull#", context )
		t.assertEquals( message, "durée - PT2S - 2 secondes" )

		context.lastStatusUpdateTime = os.time() - 60
		message = RulesEngine.getEnhancedMessage( "durée - #duration# - #durationfull#", context )
		t.assertEquals( message, "durée - PT1M - une minute" )

		context.lastStatusUpdateTime = os.time() - 132
		message = RulesEngine.getEnhancedMessage( "durée - #duration# - #durationfull#", context )
		t.assertEquals( message, "durée - PT2M12S - 2 minutes et 12 secondes" )

		context.lastStatusUpdateTime = os.time() - 3600
		message = RulesEngine.getEnhancedMessage( "durée - #duration# - #durationfull#", context )
		t.assertEquals( message, "durée - PT1H - une heure" )

		context.lastStatusUpdateTime = os.time() - 8415
		message = RulesEngine.getEnhancedMessage( "durée - #duration# - #durationfull#", context )
		t.assertEquals( message, "durée - PT2H20M15S - 2 heures et 20 minutes" )

		context.lastStatusUpdateTime = os.time() - 91225
		message = RulesEngine.getEnhancedMessage( "durée - #duration# - #durationfull#", context )
		t.assertEquals( message, "durée - P1DT1H20M25S - un jour et une heure" )

		context.lastStatusUpdateTime = os.time() - 188432
		message = RulesEngine.getEnhancedMessage( "durée - #duration# - #durationfull#", context )
		t.assertEquals( message, "durée - P2DT4H20M32S - 2 jours et 4 heures" )

	end

	function TestRulesEngine:asynctest_action_scene()
		RulesEngine.RulesFile.load( nil, nil, nil, "Rule_Action_Scene" )
		doAsyncTestSequence(
			1,
			function()
				t.assertFalse( RulesEngine.Rule.isActive( "Rule_Action_Scene" ) )
				log( "Rule Start => Run scene" )
				luup.variable_set( "urn:upnp-org:serviceId:SwitchPower1", "Status", "1", RulesEngine.getDeviceIdByName("Switch 1" ) )
			end,
			2,
			function()
				t.assertTrue( RulesEngine.Rule.isActive( "Rule_Action_Scene" ) )
				t.assertEquals( luup.variable_get( "urn:upnp-org:serviceId:SwitchPower1", "Status", RulesEngine.getDeviceIdByName( "BinaryLight 1" ) ), "1" )
				log( "Rule Stop" )
				luup.variable_set( "urn:upnp-org:serviceId:SwitchPower1", "Status", "0", RulesEngine.getDeviceIdByName( "BinaryLight 1" ) )
				luup.variable_set( "urn:upnp-org:serviceId:SwitchPower1", "Status", "0", RulesEngine.getDeviceIdByName( "Switch 1" ) )
			end,
			1,
			function()
				t.assertFalse(RulesEngine.Rule.isActive( "Rule_Action_Scene" ) )
				t.assertEquals( luup.variable_get( "urn:upnp-org:serviceId:SwitchPower1", "Status", RulesEngine.getDeviceIdByName( "BinaryLight 1" ) ), "0" )
			end
		)
	end

	function TestRulesEngine:asynctest_condition_function()
		RulesEngine.RulesFile.load( nil, nil, nil, "Rule_Condition_Function" )
		doAsyncTestSequence(
			1,
			function()
				t.assertFalse( RulesEngine.Rule.isActive( "Rule_Condition_Function" ) )
				log( "Count 1" )
				luup.variable_set( "urn:upnp-org:serviceId:SwitchPower1", "Status", "1", RulesEngine.getDeviceIdByName( "Switch 1" ) )
			end,
			1,
			function()
				t.assertFalse( RulesEngine.Rule.isActive( "Rule_Condition_Function" ) )
				log( "Count 1 - no change" )
				luup.variable_set( "urn:upnp-org:serviceId:SwitchPower1", "Status", "0", RulesEngine.getDeviceIdByName( "Switch 1" ) )
			end,
			1,
			function()
				t.assertFalse( RulesEngine.Rule.isActive( "Rule_Condition_Function" ) )
				log( "Count 2" )
				luup.variable_set( "urn:upnp-org:serviceId:SwitchPower1", "Status", "1", RulesEngine.getDeviceIdByName( "Switch 2" ) )
			end,
			1,
			function()
				t.assertFalse( RulesEngine.Rule.isActive( "Rule_Condition_Function" ) )
				log( "Count 3" )
				luup.variable_set( "urn:upnp-org:serviceId:SwitchPower1", "Status", "1", RulesEngine.getDeviceIdByName( "Switch 1" ) )
			end,
			1,
			function()
				t.assertTrue( RulesEngine.Rule.isActive( "Rule_Condition_Function" ) )
			end
		)
	end

-- Run all tests
t.LuaUnit.run( "-v" )

