-- Unit tests

local _verbosity = 4

local t = require( "tests.luaunit" )
local RulesEngine = require( "L_RulesEngine1" )
local json = require( "dkjson" )

RulesEngine.setVerbosity( 4 )
t.LuaUnit:setVerbosity( _verbosity )
RulesEngine.setMinRecurrentInterval( 1 )
RulesEngine.enable()

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
	log( "Set time : " .. json.encode( fakeT ) )
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
		log("********************************************************\n-------> Begin of TestCase '" .. tostring(testName) .. "'")
	end

	function TestRulesEngine:tearDown( testName )
		log("********************************************************\n<------- End of TestCase '" .. tostring(testName) .. "'")
	end

	function TestRulesEngine:asynctest_condition_value_EQ()
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
		doAsyncTestSequence(
			function()
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
		doAsyncTestSequence(
			function()
				log("Condition 1 OK and condition 2 KO")
				luup.variable_set("urn:micasaverde-com:serviceId:SecuritySensor1", "Armed", "1", RulesEngine.getDeviceIdByName("Motion 1"))
				luup.variable_set("urn:micasaverde-com:serviceId:SecuritySensor1", "Tripped", "0", RulesEngine.getDeviceIdByName("Motion 1"))
			end,
			1,
			function()
				t.assertFalse(RulesEngine.Rule.isActive("Rule_Condition_Value_Multi"))
				log("Condition 1 OK and condition 2 OK")
				luup.variable_set("urn:micasaverde-com:serviceId:SecuritySensor1", "Tripped", 1, RulesEngine.getDeviceIdByName("Motion 1"))
			end,
			1,
			function()
				t.assertTrue(RulesEngine.Rule.isActive("Rule_Condition_Value_Multi"))
				log("Condition 1 and condition 2 KO")
				luup.variable_set("urn:micasaverde-com:serviceId:SecuritySensor1", "Armed", "0", RulesEngine.getDeviceIdByName("Motion 1"))
				luup.variable_set("urn:micasaverde-com:serviceId:SecuritySensor1", "Tripped", "0", RulesEngine.getDeviceIdByName("Motion 1"))
			end,
			1,
			function()
				t.assertFalse(RulesEngine.Rule.isActive("Rule_Condition_Value_Multi"))
			end
		)
	end

	function TestRulesEngine:asynctest_condition_time_between_same_day()
		doAsyncTestSequence(
			function()
				setTime( { wday = 3, hour = 7, min = 59, sec = 57 } ) -- Tuesday (2)
			end,
			2,
			function()
				log( "Time just before first boundary" )
				t.assertFalse( RulesEngine.Rule.isActive( "Rule_Condition_Time_Between_Same_Day" ) )
			end,
			3,
			function()
				log("Time just after first boundary")
				t.assertTrue(RulesEngine.Rule.isActive("Rule_Condition_Time_Between_Same_Day"))
				setTime( { hour = 19, min = 59, sec = 57 } ) -- Tuesday
			end,
			1,
			function()
				log("Time just before second boundary")
				t.assertTrue(RulesEngine.Rule.isActive("Rule_Condition_Time_Between_Same_Day"))
			end,
			3,
			function()
				log("Time just after second boundary")
				t.assertFalse(RulesEngine.Rule.isActive("Rule_Condition_Time_Between_Same_Day"))
			end
		)
	end

	function TestRulesEngine:asynctest_condition_time_between_two_days()
		doAsyncTestSequence(
			function()
				setTime( { wday = 5, hour = 20, min = 59, sec = 57 } ) -- Thursday (4)
			end,
			1,
			function()
				log( "Day OK - Time just before first boundary" )
				t.assertFalse( RulesEngine.Rule.isActive( "Rule_Condition_Time_Between_Two_Days" ) )
			end,
			3,
			function()
				log( "Day OK - Time just after first boundary" )
				t.assertTrue( RulesEngine.Rule.isActive( "Rule_Condition_Time_Between_Two_Days" ) )
				setTime( { wday = 6, hour = 8, min = 59, sec = 57 } ) -- Friday (5)
			end,
			1,
			function()
				log("Day + 1 - Time just before second boundary")
				t.assertTrue( RulesEngine.Rule.isActive( "Rule_Condition_Time_Between_Two_Days" ) )
			end,
			3,
			function()
				log("Day + 1 - Time just after second boundary")
				t.assertFalse( RulesEngine.Rule.isActive( "Rule_Condition_Time_Between_Two_Days" ) )
			end
		)
	end

-- run all tests
t.LuaUnit.run "-v" 
