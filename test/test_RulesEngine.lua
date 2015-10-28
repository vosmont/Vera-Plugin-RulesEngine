-- Unit tests
-- See https://github.com/vosmont/Vera-Plugin-Mock

-- https://www.npmjs.com/package/node-rules

package.path = "./luup files/?.lua;./lib/?.lua;../?.lua;" .. package.path

local _verbosity = 3

local LuaUnit = require("luaunit")
local VeraMock = require("core.vera")
local RulesEngine = require("L_RulesEngine1")

RulesEngine.setVerbosity(4)
VeraMock:setVerbosity(_verbosity)
LuaUnit:setVerbosity(_verbosity)
RulesEngine.setMinRecurrentInterval(1)


for methodName, _ in pairs(RulesEngine) do
	print("RulesEngine." .. methodName)
end

-- Log messages concerning these unit tests
local function log(msg)
	if (_verbosity > 0) then
		print("")
		print(msg)
		print("")
	end
end

-- Trace inside calls to be able to check them
local _calls = {}
function traceCall(ruleName, event)
	if (_calls[ruleName] == nil) then
		_calls[ruleName] = {}
	end
	if (_calls[ruleName][event] == nil) then
		_calls[ruleName][event] = 0
	end
	_calls[ruleName][event] = _calls[ruleName][event] + 1
	log("   " .. ruleName .. "-" .. event .. " has been called: " .. tostring(_calls[ruleName][event]))
end

-- **************************************************
-- RulesEngine TestCases
-- **************************************************

TestRulesEngine = {}

	function TestRulesEngine:setUp()
		log("\n-------> Begin of TestCase ********************************************************")
		log("*** Init")
		--VeraMock:reset()
		VeraMock:resetThreads()
		VeraMock:resetValues()
		RulesEngine.reset()
		_calls = {}
		log("*** Start Test")
	end

	function TestRulesEngine:tearDown()
		log("*** Stop Test")
		RulesEngine.stop()
		log("<------- End of TestCase ************************************************************")
	end

	function TestRulesEngine:test_condition_value()
		expect(21)
		VeraMock:addDevice(1, { description = "Device1" })
		VeraMock:addDevice(2, { description = "Device2" })
		VeraMock:addDevice(3, { description = "Device3" })
		VeraMock:addDevice(4, { description = "Device4" })
		VeraMock:addDevice(5, { description = "Device5" })
		RulesEngine.loadRuleFile("./test/rule_condition_value.xml")
		assertNotNil(RulesEngine.getRule("Rule_Condition_Value"), "Rule is loaded")

		log("*** Start Engine")
		RulesEngine.start()
		assertFalse(RulesEngine.isRuleActive("Rule_Condition_Value"), "Rule is not active")

		log("*** Value ==")
		luup.variable_set("urn:upnp-org:serviceId:TemperatureSensor1", "CurrentTemperature", 9.2, 1)
		assertFalse(RulesEngine.isRuleActive("Rule_Condition_Value"), "Not equal - Rule is not active")
		luup.variable_set("urn:upnp-org:serviceId:TemperatureSensor1", "CurrentTemperature", 10.0, 1)
		assertTrue(RulesEngine.isRuleActive("Rule_Condition_Value"), "Equal - Rule is active")
		luup.variable_set("urn:upnp-org:serviceId:TemperatureSensor1", "CurrentTemperature", "11", 1)
		assertFalse(RulesEngine.isRuleActive("Rule_Condition_Value"), "Not equal - Rule is not active")

		log("*** Value <=")
		luup.variable_set("urn:upnp-org:serviceId:TemperatureSensor1", "CurrentTemperature", 9.9, 2)
		assertTrue(RulesEngine.isRuleActive("Rule_Condition_Value"), "Below - Rule is active")
		luup.variable_set("urn:upnp-org:serviceId:TemperatureSensor1", "CurrentTemperature", 10.0, 2)
		assertTrue(RulesEngine.isRuleActive("Rule_Condition_Value"), "Equal - Rule is active")
		luup.variable_set("urn:upnp-org:serviceId:TemperatureSensor1", "CurrentTemperature", "10.1", 2)
		assertFalse(RulesEngine.isRuleActive("Rule_Condition_Value"), "Above - Rule is not active")

		log("*** Value >=")
		luup.variable_set("urn:upnp-org:serviceId:TemperatureSensor1", "CurrentTemperature", "20.11", 2)
		assertTrue(RulesEngine.isRuleActive("Rule_Condition_Value"), "Above - Rule is active")
		luup.variable_set("urn:upnp-org:serviceId:TemperatureSensor1", "CurrentTemperature", 20.1, 2)
		assertTrue(RulesEngine.isRuleActive("Rule_Condition_Value"), "Equal - Rule is active")
		luup.variable_set("urn:upnp-org:serviceId:TemperatureSensor1", "CurrentTemperature", "20.09", 2)
		assertFalse(RulesEngine.isRuleActive("Rule_Condition_Value"), "Below - Rule is not active")

		log("*** Value <>")
		luup.variable_set("urn:upnp-org:serviceId:TemperatureSensor1", "CurrentTemperature", "20.01", 3)
		assertTrue(RulesEngine.isRuleActive("Rule_Condition_Value"), "Not equal - Rule is active")
		luup.variable_set("urn:upnp-org:serviceId:TemperatureSensor1", "CurrentTemperature", 20.0, 3)
		assertFalse(RulesEngine.isRuleActive("Rule_Condition_Value"), "Equal - Rule is not active")
		luup.variable_set("urn:upnp-org:serviceId:TemperatureSensor1", "CurrentTemperature", "19.99", 3)
		assertTrue(RulesEngine.isRuleActive("Rule_Condition_Value"), "Not equal - Rule is active")
		luup.variable_set("urn:upnp-org:serviceId:TemperatureSensor1", "CurrentTemperature", "20.00", 3)
		assertFalse(RulesEngine.isRuleActive("Rule_Condition_Value"), "Equal - Rule is not active")

		log("*** Value like")
		luup.variable_set("urn:upnp-org:serviceId:TemperatureSensor1", "CurrentTemperature", "1test2", 4)
		assertFalse(RulesEngine.isRuleActive("Rule_Condition_Value"), "Not equal - Rule is not active")
		luup.variable_set("urn:upnp-org:serviceId:TemperatureSensor1", "CurrentTemperature", "test_123", 4)
		assertTrue(RulesEngine.isRuleActive("Rule_Condition_Value"), "Equal - Rule is active")
		luup.variable_set("urn:upnp-org:serviceId:TemperatureSensor1", "CurrentTemperature", "test456", 4)
		assertFalse(RulesEngine.isRuleActive("Rule_Condition_Value"), "Not equal - Rule is not active")

		log("*** Value not like")
		luup.variable_set("urn:upnp-org:serviceId:TemperatureSensor1", "CurrentTemperature", "test_2", 5)
		assertFalse(RulesEngine.isRuleActive("Rule_Condition_Value"), "Not equal - Rule is not active")
		luup.variable_set("urn:upnp-org:serviceId:TemperatureSensor1", "CurrentTemperature", "something", 5)
		assertTrue(RulesEngine.isRuleActive("Rule_Condition_Value"), "Equal - Rule is active")
		luup.variable_set("urn:upnp-org:serviceId:TemperatureSensor1", "CurrentTemperature", "824test_456", 5)
		assertFalse(RulesEngine.isRuleActive("Rule_Condition_Value"), "Not equal - Rule is not active")

		VeraMock:run()
	end

	function TestRulesEngine:test_condition_rule()
		RulesEngine.loadRuleFile("./test/rule_condition_rule.xml")
		assertNotNil(RulesEngine.getRule("Rule_Condition_Rule"), "Rule is loaded")

		log("*** Start Engine")
		RulesEngine.start()
		assertFalse(RulesEngine.isRuleActive("Rule_Condition_Rule"), "Rule is inactive")

		log("*** Rule 1 active and Rule 2 inactive")
		RulesEngine.setRuleStatus("Rule1", "1")
		assertTrue(RulesEngine.isRuleActive("Rule_Condition_Rule"), "Rule is active")

		log("*** Rule 1 and Rule 2 active")
		RulesEngine.setRuleStatus("Rule2", "1")
		assertTrue(RulesEngine.isRuleActive("Rule_Condition_Rule"), "Rule is active")

		log("*** Rule 1 inactive and Rule 2 active")
		RulesEngine.setRuleStatus("Rule1", "0")
		assertTrue(RulesEngine.isRuleActive("Rule_Condition_Rule"), "Rule is active")

		log("*** Rule 1 and Rule 2 inactive")
		RulesEngine.setRuleStatus("Rule2", "0")
		assertFalse(RulesEngine.isRuleActive("Rule_Condition_Rule"), "Rule is not active")

		VeraMock:run()
		assertFalse(RulesEngine.isRuleActive("Rule_Condition_Rule"), "Rule is not active")
	end

	function TestRulesEngine:test_condition_time()
		VeraMock:addDevice(1, { description = "Device1" })
		RulesEngine.loadRuleFile("./test/rule_condition_time.xml")
		assertNotNil(RulesEngine.getRule("Rule_Condition_Time"), "Rule is loaded")

		log("*** Start Engine")
		VeraMock:setDate("08:00:00")
		RulesEngine.start()
		assertFalse(RulesEngine.isRuleActive("Rule_Condition_Time"), "Rule is not active")

		log("*** Condition #1 - time and daysOfWeek")
		VeraMock:setDayOfWeek("1")
		VeraMock:setDate("08:30:00")
		VeraMock:triggerTimer(2, "08:30:00", "1")
		assertFalse(RulesEngine.isRuleActive("Rule_Condition_Time"), "Rule is not active")
		assertEquals(_calls["Rule_Condition_Time"], {
			event_start = 1,
			event_end = 1
		}, "The number of event call is correct")

		log("*** Condition #1 - time and daysOfWeek - with delay")
		VeraMock:setDayOfWeek("1")
		VeraMock:setDate("08:30:01")
		VeraMock:triggerTimer(2, "08:30:00", "1")
		assertFalse(RulesEngine.isRuleActive("Rule_Condition_Time"), "Rule is not active")
		assertEquals(_calls["Rule_Condition_Time"], {
			event_start = 1,
			event_end = 1
		}, "The number of event call is correct")

		log("*** Condition #2 - time and daysOfMonth")
		VeraMock:setDayOfMonth("1")
		VeraMock:setDate("09:30:00")
		VeraMock:triggerTimer(3, "09:30:00", "15")
		assertFalse(RulesEngine.isRuleActive("Rule_Condition_Time"), "Rule is not active")
		assertEquals(_calls["Rule_Condition_Time"], {
			event_start = 2,
			event_end = 2
		}, "The number of event call is correct")

		log("*** Condition #2 - time and daysOfMonth - with delay")
		VeraMock:setDayOfMonth("1")
		VeraMock:setDate("09:30:01")
		VeraMock:triggerTimer(3, "09:30:00", "15")
		assertFalse(RulesEngine.isRuleActive("Rule_Condition_Time"), "Rule is not active")
		assertEquals(_calls["Rule_Condition_Time"], {
			event_start = 2,
			event_end = 2
		}, "The number of event call is correct")

		log("*** Condition #3 - between and daysOfWeek")
		VeraMock:setDayOfWeek("2")
		VeraMock:setDate("10:00:00")
		VeraMock:triggerTimer(2, "10:00:00", "2")
		assertTrue(RulesEngine.isRuleActive("Rule_Condition_Time"), "Rule is active")
		assertEquals(_calls["Rule_Condition_Time"], {
			event_start = 3,
			event_end = 2
		}, "The number of event call is correct")
		VeraMock:setDate("22:00:00")
		VeraMock:triggerTimer(2, "22:00:00", "2")
		assertFalse(RulesEngine.isRuleActive("Rule_Condition_Time"), "Rule is not active")
		assertEquals(_calls["Rule_Condition_Time"], {
			event_start = 3,
			event_end = 3
		}, "The number of event call is correct")
		
		
		VeraMock:run()
	end

	function TestRulesEngine:test_condition_with_since()
		VeraMock:addDevice(1, { description = "Device1" })
		expect(8)

		log("*** Condition KO")
		luup.variable_set("urn:upnp-org:serviceId:SwitchPower1", "Status", "0", 1)

		log("*** Start Engine")
		RulesEngine.start()

		log("*** Add rule")
		RulesEngine.loadRuleFile("./test/rule_condition_with_since.xml")
		assertNotNil(RulesEngine.getRule("Rule_Condition_With_Since"), "Rule is loaded")
		assertFalse(RulesEngine.isRuleActive("Rule_Condition_With_Since"), "Rule is not active")
		assertNil(_calls["Rule_Condition_With_Since"], "No event call")

		log("*** Condition OK")
		luup.variable_set("urn:upnp-org:serviceId:SwitchPower1", "Status", "1", 1)
		luup.call_delay(
			wrapAnonymousCallback(function ()
				log("*** After waiting 1 second")
				assertFalse(RulesEngine.isRuleActive("Rule_Condition_With_Since"), "Rule is not active")
			end),
			1, ""
		)

		luup.call_delay(
			wrapAnonymousCallback(function ()
				log("*** After waiting 3.1 seconds (after since)")
				assertTrue(RulesEngine.isRuleActive("Rule_Condition_With_Since"), "Rule is active")
				assertEquals(_calls["Rule_Condition_With_Since"], {
					event_start = 1
				}, "The number of event call is correct")
				log("*** Condition KO")
				luup.variable_set("urn:upnp-org:serviceId:SwitchPower1", "Status", "0", 1)
			end),
			3.1, ""
		)

		VeraMock:run()
		assertFalse(RulesEngine.isRuleActive("Rule_Condition_With_Since"), "Rule is not active.")
		assertEquals(_calls["Rule_Condition_With_Since"], {
			event_start = 1,
			event_end = 1
		}, "The number of event call is correct")

		VeraMock:run()
	end

	function TestRulesEngine:test_rule_with_conditions_ko_before_start()
		VeraMock:addDevice(1, { description = "Device1" })
		VeraMock:addDevice(2, { description = "Device2" })
		RulesEngine.loadRuleFile("./test/rule_with_conditions.xml")
		assertNotNil(RulesEngine.getRule("Rule_With_Condition"), "Rule is loaded")

		log("*** Condition 1 KO and condition 2 KO")
		luup.variable_set("urn:micasaverde-com:serviceId:SecuritySensor1", "Armed", "0", 1)
		luup.variable_set("urn:micasaverde-com:serviceId:SecuritySensor1", "Tripped", "0", 1)
		luup.variable_set("urn:micasaverde-com:serviceId:SecuritySensor1", "Tripped", "1", 2)

		log("*** Start Engine")
		RulesEngine.start()
		assertFalse(RulesEngine.isRuleActive("Rule_With_Condition"), "Rule is not active")

		log("*** Condition 1 KO")
		luup.variable_set("urn:micasaverde-com:serviceId:SecuritySensor1", "Tripped", "1", 1)
		assertFalse(RulesEngine.isRuleActive("Rule_With_Condition"), "Rule is not active")

		VeraMock:run()
	end

	function TestRulesEngine:test_rule_with_conditions_ok_before_start()
		VeraMock:addDevice(1, { description = "Device1" })
		VeraMock:addDevice(2, { description = "Device2" })
		RulesEngine.loadRuleFile("./test/rule_with_conditions.xml")
		assertNotNil(RulesEngine.getRule("Rule_With_Condition"), "Rule is loaded")

		log("*** Condition 1 KO and condition 2 OK")
		luup.variable_set("urn:micasaverde-com:serviceId:SecuritySensor1", "Armed", "1", 1)
		luup.variable_set("urn:micasaverde-com:serviceId:SecuritySensor1", "Armed", "1", 2)
		luup.variable_set("urn:micasaverde-com:serviceId:SecuritySensor1", "Tripped", "1", 2)

		log("*** Start Engine")
		RulesEngine.start()
		assertTrue(RulesEngine.isRuleActive("Rule_With_Condition"), "Rule is active")

		log("*** Condition 2 KO")
		luup.variable_set("urn:micasaverde-com:serviceId:SecuritySensor1", "Armed", "0", 2)
		assertFalse(RulesEngine.isRuleActive("Rule_With_Condition"), "Rule is not active")

		VeraMock:run()
	end

	function TestRulesEngine:test_rule_with_conditions_ok_after_start()
		VeraMock:addDevice(1, { description = "Device1" })
		VeraMock:addDevice(2, { description = "Device2" })
		RulesEngine.loadRuleFile("./test/rule_with_conditions.xml")
		assertNotNil(RulesEngine.getRule("Rule_With_Condition"), "Rule is loaded")

		log("*** Condition 1 KO and condition 2 KO")
		luup.variable_set("urn:micasaverde-com:serviceId:SecuritySensor1", "Armed", "1", 1)
		luup.variable_set("urn:micasaverde-com:serviceId:SecuritySensor1", "Armed", "1", 2)

		log("*** Start Engine")
		RulesEngine.start()
		assertFalse(RulesEngine.isRuleActive("Rule_With_Condition"), "Rule is not active")

		log("*** Condition 2 OK")
		luup.variable_set("urn:micasaverde-com:serviceId:SecuritySensor1", "Tripped", "1", 2)
		assertTrue(RulesEngine.isRuleActive("Rule_With_Condition"), "Rule is active")

		log("*** Condition 2 KO")
		luup.variable_set("urn:micasaverde-com:serviceId:SecuritySensor1", "Tripped", "0", 2)
		assertFalse(RulesEngine.isRuleActive("Rule_With_Condition"), "Rule is not active")

		VeraMock:run()
	end

	function TestRulesEngine:test_rule_with_reminder_and_active_before_start()
		expect(6)
		VeraMock:addDevice(1, { description = "Device1" })

		log("*** Condition 1 OK")
		luup.variable_set("urn:micasaverde-com:serviceId:SecuritySensor1", "Armed", "1", 1)
		luup.variable_set("urn:micasaverde-com:serviceId:SecuritySensor1", "Tripped", "1", 1)

		log("*** Start Engine")
		RulesEngine.start()

		log("*** Change time (now - 30s)")
		VeraMock:setTime(os.time() - 30)

		log("*** Add rule")
		RulesEngine.loadRuleFile("./test/rule_with_reminder.xml")
		assertNotNil(RulesEngine.getRule("Rule_With_Reminder"), "Rule is loaded")
		assertTrue(RulesEngine.isRuleActive("Rule_With_Reminder"), "Rule is active")
		assertNil(_calls["Rule_With_Reminder"], "No event call")

		luup.call_delay(
			wrapAnonymousCallback(function ()
				log("*** After waiting 5 seconds")
				assertTrue(RulesEngine.isRuleActive("Rule_With_Reminder"), "Rule is active")
				log("*** Condition 1 KO (after reminder actions)")
				luup.variable_set("urn:micasaverde-com:serviceId:SecuritySensor1", "Tripped", "0", 1)
			end),
			5, ""
		)

		VeraMock:run()
		assertFalse(RulesEngine.isRuleActive("Rule_With_Reminder"), "Rule is not active.")
		assertEquals(_calls["Rule_With_Reminder"], {
			event_reminder = 2,
			event_end = 1
		}, "The number of event call is correct")

		VeraMock:run()
	end

	function TestRulesEngine:test_rule_with_reminder_and_active_after_start()
		expect(7)
		VeraMock:addDevice(1, { description = "Device1" })
		RulesEngine.loadRuleFile("./test/rule_with_reminder.xml")
		assertNotNil(RulesEngine.getRule("Rule_With_Reminder"), "Rule is loaded")

		log("*** Condition is respected")
		luup.variable_set("urn:micasaverde-com:serviceId:SecuritySensor1", "Armed", "1", 1)

		log("*** Start Engine")
		RulesEngine.start()
		assertFalse(RulesEngine.isRuleActive("Rule_With_Reminder"), "Rule is not active")

		log("*** Trigger is triggered")
		luup.variable_set("urn:micasaverde-com:serviceId:SecuritySensor1", "Tripped", "1", 1)
		assertTrue(RulesEngine.isRuleActive("Rule_With_Reminder"), "Rule is active")
		assertEquals(_calls["Rule_With_Reminder"], {
			event_start = 1
		}, "The number of event call is correct")

		luup.call_delay(
			wrapAnonymousCallback(function ()
				log("*** After waiting 5 seconds")
				assertTrue(RulesEngine.isRuleActive("Rule_With_Reminder"), "Rule is active")
				log("*** Trigger is no more triggered (after reminder actions)")
				luup.variable_set("urn:micasaverde-com:serviceId:SecuritySensor1", "Tripped", "0", 1)
			end),
			5, ""
		)

		VeraMock:run()
		assertFalse(RulesEngine.isRuleActive("Rule_With_Reminder"), "Rule is not active.")
		assertEquals(_calls["Rule_With_Reminder"], {
			event_start = 1,
			event_reminder = 2,
			event_end = 1
		}, "The number of event call is correct")

		VeraMock:run()
	end

	function TestRulesEngine:test_rule_with_levels()
		expect(17)
		VeraMock:addDevice(1, { description = "Device1" })
		VeraMock:addDevice(2, { description = "Device2" })
		VeraMock:addDevice(3, { description = "Device3" })
		RulesEngine.loadRuleFile("./test/rule_with_levels.xml")
		assertNotNil(RulesEngine.getRule("Rule_With_Levels"), "Rule is loaded")
		assertEquals(RulesEngine.getRuleLevel("Rule_With_Levels"), 0, "Rule level is 0")

		log("*** Start Engine")
		RulesEngine.start()

		log("*** Level 1 active and level 2 inactive")
		luup.variable_set("urn:upnp-org:serviceId:SwitchPower1", "Status", "1", 1)
		luup.variable_set("urn:upnp-org:serviceId:SwitchPower1", "Status", "0", 2)
		luup.variable_set("urn:upnp-org:serviceId:SwitchPower1", "Status", "0", 3)
		assertTrue(RulesEngine.isRuleActive("Rule_With_Levels"), "Rule is active")
		assertEquals(RulesEngine.getRuleLevel("Rule_With_Levels"), 1, "Rule level is 1")
		assertEquals(_calls["Rule_With_Levels"], {
			event_start = 1,
			event_start_level_1 = 1
		}, "The number of event call is correct")

		luup.call_delay(
			wrapAnonymousCallback(function ()
				log("*** After waiting 1.1 second")
				assertEquals(_calls["Rule_With_Levels"], {
					event_start = 1,
					event_start_level_1 = 1,
					event_reminder = 1,
					event_reminder_level_1 = 1
				}, "The number of event call is correct")
				log("*** Level 1 still active and level 2 active")
				luup.variable_set("urn:upnp-org:serviceId:SwitchPower1", "Status", "1", 2)
				assertTrue(RulesEngine.isRuleActive("Rule_With_Levels"), "Rule is active")
				assertEquals(RulesEngine.getRuleLevel("Rule_With_Levels"), 2, "Rule level is 2")
			end),
			1.1, ""
		)

		luup.call_delay(
			wrapAnonymousCallback(function ()
				log("*** After waiting 2.2 seconds")
				assertEquals(_calls["Rule_With_Levels"], {
					event_start = 1,
					event_start_level_1 = 1,
					event_start_level_2 = 1,
					event_reminder = 2,
					event_reminder_level_1 = 1,
					event_reminder_level_2 = 1,
					event_end_level_1 = 1
				}, "The number of event call is correct")
				log("*** Level 1 still active and level 2 inactive")
				luup.variable_set("urn:upnp-org:serviceId:SwitchPower1", "Status", "0", 2)
				assertTrue(RulesEngine.isRuleActive("Rule_With_Levels"), "Rule is active")
				assertEquals(RulesEngine.getRuleLevel("Rule_With_Levels"), 1, "Rule level is 1")
			end),
			2.2, ""
		)

		luup.call_delay(
			wrapAnonymousCallback(function ()
				log("*** After waiting 3.3 seconds")
				assertEquals(_calls["Rule_With_Levels"], {
					event_start = 1,
					event_start_level_1 = 2,
					event_start_level_2 = 1,
					event_reminder = 3,
					event_reminder_level_1 = 2,
					event_reminder_level_2 = 1,
					event_end_level_1 = 1,
					event_end_level_2 = 1
				}, "The number of event call is correct")
				log("*** Level 1 inactive, level 2 inactive and level 0 active")
				luup.variable_set("urn:upnp-org:serviceId:SwitchPower1", "Status", "1", 3)
				luup.variable_set("urn:upnp-org:serviceId:SwitchPower1", "Status", "0", 1)
				assertTrue(RulesEngine.isRuleActive("Rule_With_Levels"), "Rule is active")
				assertEquals(RulesEngine.getRuleLevel("Rule_With_Levels"), 0, "Rule level is 0")
			end),
			3.3, ""
		)

		luup.call_delay(
			wrapAnonymousCallback(function ()
				log("*** After waiting 4.4 seconds")
				assertEquals(_calls["Rule_With_Levels"], {
					event_start = 1,
					event_start_level_1 = 2,
					event_start_level_2 = 1,
					event_reminder = 4,
					event_reminder_level_1 = 2,
					event_reminder_level_2 = 1,
					event_end_level_1 = 2,
					event_end_level_2 = 1
				}, "The number of event call is correct")
				log("*** Level 0 inactive")
				luup.variable_set("urn:upnp-org:serviceId:SwitchPower1", "Status", "0", 3)
				assertFalse(RulesEngine.isRuleActive("Rule_With_Levels"), "Rule is not active")
			end),
			4.4, ""
		)

		VeraMock:run()
		assertEquals(_calls["Rule_With_Levels"], {
			event_start = 1,
			event_start_level_1 = 2,
			event_start_level_2 = 1,
			event_reminder = 4,
			event_reminder_level_1 = 2,
			event_reminder_level_2 = 1,
			event_end_level_1 = 2,
			event_end_level_2 = 1,
			event_end = 1
		}, "The number of event call is correct")
	end

	function TestRulesEngine:test_rule_with_properties()
		VeraMock:addDevice(1, { description = "Device1" })
		RulesEngine.loadRuleFile("./test/rule_with_properties.xml")
		assertNotNil(RulesEngine.getRule("Rule_With_Properties"), "Rule is loaded")

		local rule = RulesEngine.getRule("Rule_With_Properties")
		assertEquals(rule.properties, {
			property1 = { param = "My param 1" },
			property2 = { param = "My param 2" },
			property3 = { param = "My param 3" },
			property4 = { param = "My param 4" }
		}, "The properties are correct")
	end

	function TestRulesEngine:test_action_action()
		VeraMock:addDevice(1, { description = "Device1" })
		VeraMock:addDevice(2, { description = "Device2" })
		VeraMock:addDevice(3, { description = "Device3" })
		RulesEngine.addRule({
			name = "Rule_Action",
			conditions = {
				{type="value", device="Device1", service="urn:upnp-org:serviceId:SwitchPower1", variable="Status", value="1"}
			},
			actions = {
				{
					event = "start",
					type = "action",
					devices={"Device2", "Device3"}, service="urn:upnp-org:serviceId:SwitchPower1", action="SetTarget", arguments={NewTarget="1"}
				}, {
					event = "end",
					type = "action",
					device="Device2", service="urn:upnp-org:serviceId:SwitchPower1", action="SetTarget", arguments={NewTarget="0"}
				}
			}
		})

		expect(6)

		log("*** Start")
		RulesEngine.start()

		log("*** Rule is active")
		luup.variable_set("urn:upnp-org:serviceId:SwitchPower1", "Status", "0", 2)
		luup.variable_set("urn:upnp-org:serviceId:SwitchPower1", "Status", "0", 3)
		luup.variable_set("urn:upnp-org:serviceId:SwitchPower1", "Status", "1", 1)
		assertTrue(RulesEngine.isRuleActive("Rule_Action"), "Rule is active")
		assertEquals(luup.variable_get("urn:upnp-org:serviceId:SwitchPower1", "Status", 2), "1", "Device2 is ON")
		assertEquals(luup.variable_get("urn:upnp-org:serviceId:SwitchPower1", "Status", 3), "1", "Device3 is ON")

		log("*** Rule is not active")
		luup.variable_set("urn:upnp-org:serviceId:SwitchPower1", "Status", "0", 1)
		assertFalse(RulesEngine.isRuleActive("Rule_Action"), "Rule is not active")
		assertEquals(luup.variable_get("urn:upnp-org:serviceId:SwitchPower1", "Status", 2), "0", "Device2 is OFF")
		assertEquals(luup.variable_get("urn:upnp-org:serviceId:SwitchPower1", "Status", 3), "1", "Device3 is ON")

		VeraMock:run()
	end

	function TestRulesEngine:test_action_custom()
		
	end

	function TestRulesEngine:test_action_with_delay()
		expect(13)
		VeraMock:addDevice(1, { description = "Device1" })
		RulesEngine.loadRuleFile("./test/rule_action_with_delay.xml")
		assertNotNil(RulesEngine.getRule("Rule_Action_With_Delay"), "Rule is loaded")

		log("*** Start Engine")
		RulesEngine.start()

		log("*** Rule active")
		luup.variable_set("urn:upnp-org:serviceId:SwitchPower1", "Status", "1", 1)
		assertTrue(RulesEngine.isRuleActive("Rule_Action_With_Delay"), "Rule is active")
		assertNil(_calls["Rule_Action_With_Delay"], "No event call")

		luup.call_delay(
			wrapAnonymousCallback(function ()
				log("*** After waiting 0.5 second (start before delay)")
				assertNil(_calls["Rule_Action_With_Delay"], "No event call")
			end),
			0.5, ""
		)

		luup.call_delay(
			wrapAnonymousCallback(function ()
				log("*** After waiting 1.1 second (start after delay)")
				assertEquals(_calls["Rule_Action_With_Delay"], {
					event_start = 1
				}, "The number of event call is correct")
			end),
			1.1, ""
		)

		luup.call_delay(
			wrapAnonymousCallback(function ()
				log("*** After waiting 2.1 seconds (reminder with delay)")
				assertEquals(_calls["Rule_Action_With_Delay"], {
					event_start = 1,
					event_reminder = 1
				}, "The number of event call is correct")
			end),
			2.1, ""
		)

		luup.call_delay(
			wrapAnonymousCallback(function ()
				log("*** After waiting 4.1 seconds (reminder recurent after delay)")
				assertEquals(_calls["Rule_Action_With_Delay"], {
					event_start = 1,
					event_reminder = 3
				}, "The number of event call is correct")
				log("*** Rule inactive")
				luup.variable_set("urn:upnp-org:serviceId:SwitchPower1", "Status", "0", 1)
				assertFalse(RulesEngine.isRuleActive("Rule_Action_With_Delay"), "Rule is not active")
				assertEquals(_calls["Rule_Action_With_Delay"], {
					event_start = 1,
					event_reminder = 3
				}, "The number of event call is correct")
			end),
			4.1, ""
		)

		luup.call_delay(
			wrapAnonymousCallback(function ()
				log("*** After waiting 4.5 seconds (end before delay)")
				assertEquals(_calls["Rule_Action_With_Delay"], {
					event_start = 1,
					event_reminder = 3
				}, "The number of event call is correct")
			end),
			4.5, ""
		)

		luup.call_delay(
			wrapAnonymousCallback(function ()
				log("*** After waiting 5.3 seconds (end after delay)")
				assertEquals(_calls["Rule_Action_With_Delay"], {
					event_start = 1,
					event_reminder = 3,
					event_end = 1
				}, "The number of event call is correct")
			end),
			5.3, ""
		)

		VeraMock:run()
		assertFalse(RulesEngine.isRuleActive("Rule_Action_With_Delay"), "Rule is not active")
		assertEquals(_calls["Rule_Action_With_Delay"], {
			event_start = 1,
			event_reminder = 3,
			event_end = 1
		}, "The number of event call is correct")
	end

	function TestRulesEngine:test_action_with_delay_cancel()
		expect(14)
		VeraMock:addDevice(1, { description = "Device1" })
		RulesEngine.loadRuleFile("./test/rule_action_with_delay.xml")
		assertNotNil(RulesEngine.getRule("Rule_Action_With_Delay"), "Rule is loaded")

		log("*** Start Engine")
		RulesEngine.start()

		log("*** Rule active")
		luup.variable_set("urn:upnp-org:serviceId:SwitchPower1", "Status", "1", 1)
		assertTrue(RulesEngine.isRuleActive("Rule_Action_With_Delay"), "Rule is active")
		assertNil(_calls["Rule_Action_With_Delay"], "No event call")

		luup.call_delay(
			wrapAnonymousCallback(function ()
				log("*** After waiting 0.5 second (begin before delay)")
				assertNil(_calls["Rule_Action_With_Delay"], "No event call")
				log("*** Rule inactive before start action")
				luup.variable_set("urn:upnp-org:serviceId:SwitchPower1", "Status", "0", 1)
				assertFalse(RulesEngine.isRuleActive("Rule_Action_With_Delay"), "Rule is not active")
				assertNil(_calls["Rule_Action_With_Delay"], "No event call")
			end),
			0.5, ""
		)

		luup.call_delay(
			wrapAnonymousCallback(function ()
				log("*** After waiting 1.1 second")
				assertNil(_calls["Rule_Action_With_Delay"], "No event call")
				log("*** Rule active again before end action")
				luup.variable_set("urn:upnp-org:serviceId:SwitchPower1", "Status", "1", 1)
				assertTrue(RulesEngine.isRuleActive("Rule_Action_With_Delay"), "Rule is active")
				assertNil(_calls["Rule_Action_With_Delay"], "No event call")
			end),
			1.1, ""
		)

		luup.call_delay(
			wrapAnonymousCallback(function ()
				log("*** After waiting 2.2 seconds")
				assertEquals(_calls["Rule_Action_With_Delay"], {
					event_start = 1
				}, "The number of event call is correct")
				log("*** Rule inactive again after start action")
				luup.variable_set("urn:upnp-org:serviceId:SwitchPower1", "Status", "0", 1)
				assertFalse(RulesEngine.isRuleActive("Rule_Action_With_Delay"), "Rule is not active")
				assertEquals(_calls["Rule_Action_With_Delay"], {
					event_start = 1
				}, "The number of event call is correct")
			end),
			2.2, ""
		)

		VeraMock:run()
		assertFalse(RulesEngine.isRuleActive("Rule_Action_With_Delay"), "Rule is not active")
		assertEquals(_calls["Rule_Action_With_Delay"], {
			event_start = 1,
			event_end = 1
		}, "The number of event call is correct")
	end

	function TestRulesEngine:test_rule_duration()
		expect(9)
		VeraMock:addDevice(1, { description = "Device1" })

		RulesEngine.addActionType(
			"action_vocal",
			function (action, context)
				local message = RulesEngine.getEnhancedMessage(action.message, context)
				RulesEngine.log("Vocal message : \"" .. message .. "\"", "ActionType.Vocal", 1)
			end
		)

		RulesEngine.loadRuleFile("./test/rule_duration.xml")
		assertNotNil(RulesEngine.getRule("Rule_Duration"), "Rule is loaded")
		local rule = RulesEngine.getRule("Rule_Duration")

		log("*** Start")
		RulesEngine.start()
		assertFalse(RulesEngine.isRuleActive("Rule_Duration"), "Rule is not active")

		log("*** Temperature is below min threshold")
		local expectedStatusUpdateTime = os.time()
		local expectedLevelUpdateTime = os.time()
		local expectedUpdateTime = os.time()
		luup.variable_set("urn:upnp-org:serviceId:TemperatureSensor1", "CurrentTemperature", "9", 1)
		assertTrue(RulesEngine.isRuleActive("Rule_Duration"), "Rule is active")
		assertEquals(rule._context, {
			name = "Rule_Duration",
			level = 1,
			lastStatusUpdateTime = expectedStatusUpdateTime,
			lastLevelUpdateTime = expectedLevelUpdateTime,
			lastUpdateTime = expectedUpdateTime,
			value = '9'
		}, "Rule context is correct")

		luup.call_delay(
			wrapAnonymousCallback(function ()
				log("*** After waiting 1 seconde")
				log("*** Temperature is still below min threshold")
				expectedUpdateTime = os.time()
				luup.variable_set("urn:upnp-org:serviceId:TemperatureSensor1", "CurrentTemperature", 5, 1)
				assertTrue(RulesEngine.isRuleActive("Rule_Duration"), "Rule is active")
			end),
			1, ""
		)

		luup.call_delay(
			wrapAnonymousCallback(function ()
				log("*** After waiting 2 seconds")
				log("*** Temperature is still below min threshold")
				assertEquals(rule._context, {
					name = "Rule_Duration",
					level = 1,
					lastStatusUpdateTime = expectedStatusUpdateTime,
					lastLevelUpdateTime = expectedLevelUpdateTime,
					lastUpdateTime = expectedUpdateTime,
					value = '5'
				}, "Rule context is correct")
			end),
			2, ""
		)

		luup.call_delay(
			wrapAnonymousCallback(function ()
				log("*** After waiting 3 seconds")
				log("*** Temperature is over max threshold")
				expectedLevelUpdateTime = os.time()
				expectedUpdateTime = os.time()
				luup.variable_set("urn:upnp-org:serviceId:TemperatureSensor1", "CurrentTemperature", "21", 1)
			end),
			3, ""
		)

		luup.call_delay(
			wrapAnonymousCallback(function ()
				log("*** After waiting 4 seconds")
				log("*** Temperature is still over max threshold")
				assertEquals(rule._context, {
					name = "Rule_Duration",
					level = 2,
					lastStatusUpdateTime = expectedStatusUpdateTime,
					lastLevelUpdateTime = expectedLevelUpdateTime,
					lastUpdateTime = expectedUpdateTime,
					value = '21'
				}, "Rule context is correct")
			end),
			4, ""
		)

		luup.call_delay(
			wrapAnonymousCallback(function ()
				log("*** After waiting 5 seconds")
				log("*** Temperature is between min and max thresholds")
				expectedStatusUpdateTime = os.time()
				expectedLevelUpdateTime = os.time()
				expectedUpdateTime = os.time()
				luup.variable_set("urn:upnp-org:serviceId:TemperatureSensor1", "CurrentTemperature", "15", 1)
				assertFalse(RulesEngine.isRuleActive("Rule_Duration"), "Rule is not active")
			end),
			5, ""
		)

		VeraMock:run()
		assertEquals(rule._context, {
			name = "Rule_Duration",
			level = 0,
			lastStatusUpdateTime = expectedStatusUpdateTime,
			lastLevelUpdateTime = expectedLevelUpdateTime,
			lastUpdateTime = expectedUpdateTime,
			value = '15'
		}, "Rule context is correct")
	end

	function TestRulesEngine:test_rule_disabled()
		expect(16)
		VeraMock:addDevice(1, { description = "Device1" })
		RulesEngine.loadRuleFile("./test/rule_disable.xml")
		assertNotNil(RulesEngine.getRule("Rule_To_Disable"), "Rule to disable is loaded")
		assertNotNil(RulesEngine.getRule("Rule_Disabled"), "Rule disabled is loaded")

		log("*** Start Engine")
		RulesEngine.start()
		log("*** Rule 1 enabled on start")
		assertTrue(RulesEngine.isRuleEnabled("Rule_To_Disable"), "Rule 1 is enabled")
		assertFalse(RulesEngine.isRuleActive("Rule_To_Disable"), "Rule 1 is not active")
		log("*** Rule 2 disabled on start")
		assertFalse(RulesEngine.isRuleEnabled("Rule_Disabled"), "Rule 2 is not enabled")
		assertFalse(RulesEngine.isRuleActive("Rule_Disabled"), "Rule 2 is not active")

		log("*** Condition OK")
		--RulesEngine.disableRule("Rule_Disabled")
		--RulesEngine.disableRule("Rule_Disabled")
		luup.variable_set("urn:upnp-org:serviceId:SwitchPower1", "Status", "1", 1)
		log("*** Rule 1 is active")
		assertTrue(RulesEngine.isRuleActive("Rule_To_Disable"), "Rule 2 is active")
		assertEquals(_calls["Rule_To_Disable"], {
			event_start = 1
		}, "Rule 1 :The number of event call is correct")
		log("*** Rule 2 is not active")
		assertFalse(RulesEngine.isRuleActive("Rule_Disabled"), "Rule disabled : Rule is not active")
		assertNil(_calls["Rule_Disabled"], "Rule 2 : The number of event call is correct")

		luup.call_delay(
			wrapAnonymousCallback(function ()
				log("*** After waiting 1 second")
				log("*** Rule 1 is disabled and could be active")
				RulesEngine.disableRule("Rule_To_Disable")
				assertFalse(RulesEngine.isRuleEnabled("Rule_Disabled"), "Rule 1 is not enabled")
				assertFalse(RulesEngine.isRuleActive("Rule_Disabled"), "Rule 1 is not active")
				assertEquals(_calls["Rule_To_Disable"], {
					event_start = 1,
					event_reminder = 1
				}, "Rule 1 : The number of event call is correct")
				log("*** Rule 2 is enabled and become active")
				RulesEngine.enableRule("Rule_Disabled")
				RulesEngine.enableRule("Rule_Disabled")
				assertTrue(RulesEngine.isRuleEnabled("Rule_Disabled"), "Rule 2 is enabled")
				assertTrue(RulesEngine.isRuleActive("Rule_Disabled"), "Rule 2 is now active")
				assertEquals(_calls["Rule_Disabled"], {
					event_start = 1
				}, "Rule 2 : The number of event call is correct")
			end),
			1, ""
		)

		luup.call_delay(
			wrapAnonymousCallback(function ()
				log("*** After waiting 2 seconds")
				log("*** Rule 1 is disabled and could be active")
				RulesEngine.disableRule("Rule_To_Disable")
				assertFalse(RulesEngine.isRuleEnabled("Rule_Disabled"), "Rule 1 is not enabled")
				assertFalse(RulesEngine.isRuleActive("Rule_Disabled"), "Rule 1 is not active")
				assertEquals(_calls["Rule_To_Disable"], {
					event_start = 1,
					event_reminder = 1
				}, "Rule 1 : The number of event call is correct")
				log("*** Rule 2 is enabled and become active")
				assertEquals(_calls["Rule_Disabled"], {
					event_start = 1,
					event_reminder = 1
				}, "Rule 2 : The number of event call is correct")
			end),
			2, ""
		)

		luup.call_delay(
			wrapAnonymousCallback(function ()
				log("*** After waiting 3 seconds")
				log("*** Condition KO")
				luup.variable_set("urn:upnp-org:serviceId:SwitchPower1", "Status", "0", 1)
				log("*** Rule 1 is disabled and could be inactive")
				assertEquals(_calls["Rule_To_Disable"], {
					event_start = 1,
					event_reminder = 1
				}, "Rule 1 : The number of event call is correct")
				log("*** Rule 2 is enabled and become inactive")
				assertEquals(_calls["Rule_Disabled"], {
					event_start = 1,
					event_reminder = 2,
					event_end = 1
				}, "Rule 2 : The number of event call is correct")
			end),
			3, ""
		)

		--[[
		luup.call_delay(
			wrapAnonymousCallback(function ()
				log("*** After waiting 4 seconds")
				log("*** Rule is disabled and could be active")
				RulesEngine.disableRule("Rule_Disabled")
				RulesEngine.disableRule("Rule_Disabled")
				assertFalse(RulesEngine.isRuleEnabled("Rule_Disabled"), "Rule is not enabled")
				assertTrue(RulesEngine.isRuleActive("Rule_Disabled"), "Rule is still active")
				assertEquals(_calls["Rule_Disabled"], {
					eventStart = 1,
					eventReminder = 1
				}, "The number of event call is correct")
			end),
			4, ""
		)

		luup.call_delay(
			wrapAnonymousCallback(function ()
				log("*** After waiting 6 seconds")
				log("*** Rule is disabled and could be inactive")
				RulesEngine.disableRule("Rule_Disabled")
				assertFalse(RulesEngine.isRuleEnabled("Rule_Disabled"), "Rule is not enabled")
				luup.variable_set("urn:upnp-org:serviceId:SwitchPower1", "Status", "0", 1)
				assertTrue(RulesEngine.isRuleActive("Rule_Disabled"), "Rule is still active")
				assertEquals(_calls["Rule_Disabled"], {
					eventStart = 1,
					eventReminder = 1
				}, "The number of event call is correct")
			end),
			6, ""
		)

		luup.call_delay(
			wrapAnonymousCallback(function ()
				log("*** After waiting 8 seconds")
				log("*** Rule is enabled and could be inactive")
				RulesEngine.enableRule("Rule_Disabled")
				RulesEngine.enableRule("Rule_Disabled")
				assertTrue(RulesEngine.isRuleEnabled("Rule_Disabled"), "Rule is enabled")
				assertFalse(RulesEngine.isRuleActive("Rule_Disabled"), "Rule is now not active")
				assertEquals(_calls["Rule_Disabled"], {
					eventStart = 1,
					eventReminder = 1,
					eventEnd = 1
				}, "The number of event call is correct")
			end),
			8, ""
		)
		--]]

		VeraMock:run()
	end

	function TestRulesEngine:test_enhanced_message()
		local message
		local context = {}

		log("*** #value#")

		context.value = 15
		message = RulesEngine.getEnhancedMessage ("valeur #value#", context)
		assertEquals(message, "valeur 15", "Value Integer")

		context.value = "32"
		message = RulesEngine.getEnhancedMessage ("valeur #value#", context)
		assertEquals(message, "valeur 32", "Value String")

		--[[
		log("*** #value_N#")

		context.values = {
			"10",
			{"20", 30}
		}
		message = RulesEngine.getEnhancedMessage ("valeur #value_1#", context)
		assertEquals(message, "valeur 10", "Value String")
		message = RulesEngine.getEnhancedMessage ("valeur #value_2_2#", context)
		assertEquals(message, "valeur 30", "Value Integer")
		--]]

		log("*** #duration# and #durationfull#")

		context.lastStatusUpdateTime = os.time() - 1
		message = RulesEngine.getEnhancedMessage ("durée - #duration# - #durationfull#", context)
		assertEquals(message, "durée - PT1S - une seconde", "Duration 1 second")

		context.lastStatusUpdateTime = os.time() - 2
		message = RulesEngine.getEnhancedMessage ("durée - #duration# - #durationfull#", context)
		assertEquals(message, "durée - PT2S - 2 secondes", "Duration of 2 seconds")

		context.lastStatusUpdateTime = os.time() - 60
		message = RulesEngine.getEnhancedMessage ("durée - #duration# - #durationfull#", context)
		assertEquals(message, "durée - PT1M - une minute", "Duration of 1 minute")

		context.lastStatusUpdateTime = os.time() - 132
		message = RulesEngine.getEnhancedMessage ("durée - #duration# - #durationfull#", context)
		assertEquals(message, "durée - PT2M12S - 2 minutes et 12 secondes", "Duration of 2 minutes and 12 seconds")

		context.lastStatusUpdateTime = os.time() - 3600
		message = RulesEngine.getEnhancedMessage ("durée - #duration# - #durationfull#", context)
		assertEquals(message, "durée - PT1H - une heure", "Duration of 1 hour")

		context.lastStatusUpdateTime = os.time() - 8415
		message = RulesEngine.getEnhancedMessage ("durée - #duration# - #durationfull#", context)
		assertEquals(message, "durée - PT2H20M15S - 2 heures et 20 minutes", "Duration of 2 hours et 20 minutes with seconds")

		context.lastStatusUpdateTime = os.time() - 91225
		message = RulesEngine.getEnhancedMessage ("durée - #duration# - #durationfull#", context)
		assertEquals(message, "durée - P1DT1H20M25S - un jour et une heure", "Duration of 1 day and 1 hour with minutes and seconds")

		context.lastStatusUpdateTime = os.time() - 188432
		message = RulesEngine.getEnhancedMessage ("durée - #duration# - #durationfull#", context)
		assertEquals(message, "durée - P2DT4H20M32S - 2 jours et 4 heures", "Duration of 2 days and 4 hours with minutes and seconds")

	end

-- run all tests
print("")
--LuaUnit:run()
--[[
-- Tests OK
LuaUnit:run("TestRulesEngine:test_condition_value")
LuaUnit:run("TestRulesEngine:test_condition_rule")
--LuaUnit:run("TestRulesEngine:test_condition_time") -- KO
LuaUnit:run("TestRulesEngine:test_condition_with_since")
LuaUnit:run("TestRulesEngine:test_rule_with_conditions_ko_before_start")
LuaUnit:run("TestRulesEngine:test_rule_with_conditions_ok_before_start")
LuaUnit:run("TestRulesEngine:test_rule_with_conditions_ok_after_start")
LuaUnit:run("TestRulesEngine:test_rule_with_reminder_and_active_before_start")
LuaUnit:run("TestRulesEngine:test_rule_with_reminder_and_active_after_start")
LuaUnit:run("TestRulesEngine:test_rule_with_levels")
LuaUnit:run("TestRulesEngine:test_action_with_delay")
LuaUnit:run("TestRulesEngine:test_action_with_delay_cancel")
LuaUnit:run("TestRulesEngine:test_rule_duration")
LuaUnit:run("TestRulesEngine:test_enhanced_message")
--]]
LuaUnit:run("TestRulesEngine:test_rule_with_properties")
--[[
-- Tests KO

-- todo : activation sur enabled
LuaUnit:run("TestRulesEngine:test_rule_disabled")

LuaUnit:run("TestRulesEngine:test_action_action")
LuaUnit:run("TestRulesEngine:test_action_custom")

--]]