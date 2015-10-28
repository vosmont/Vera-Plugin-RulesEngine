package.path = "./lib/?.lua;../?.lua;" .. package.path

local _verbosity = 4

local LuaUnit = require("luaunit")
local VeraMock = require("core.vera")

-- Devices initialisation
VeraMock:addDevice(1, {description="Device1"})
VeraMock:addDevice(2, {description="Device2"})
VeraMock:addDevice(4, {description="Device3"}) 

TestCoreVera = {}

	function TestCoreVera:setUp()
		if (_verbosity > 0) then
			print("\n-------> Begin of TestCase")
		end
		VeraMock:reset()
	end

	function TestCoreVera:tearDown()
		if (_verbosity > 0) then
			print("<------- End of TestCase")
		end
	end

	-- ****************************************************************************************
	-- luup.device_supports_service
	-- ****************************************************************************************

	function TestCoreVera:test_device_supports_service_ok ()
		luup.variable_set("urn:upnp-org:serviceId:ServiceSupported", "Variable", "MyNewValue", 1)
		assertEquals(luup.device_supports_service("urn:upnp-org:serviceId:ServiceSupported", 1), true, "The device supports the service")
	end

	function TestCoreVera:test_device_supports_service_ko ()
		assertEquals(luup.device_supports_service("urn:upnp-org:serviceId:ServiceNotSupported", 1), false, "The device doesn't support the service")
	end

	-- ****************************************************************************************
	-- luup.variable_watch
	-- ****************************************************************************************

	function TestCoreVera:test_variable_watch()
		expect(3)
		luup.variable_watch(
			wrapAnonymousCallback(function (lul_device, lul_service, lul_variable, lul_value_old, lul_value_new)
				assertEquals(lul_value_new, "MyNewValueDevice1", "Variable has changed for first device (first watcher)")
			end),
			"urn:upnp-org:serviceId:Service1", "Variable1", 1
		)
		luup.variable_watch(
			wrapAnonymousCallback(function (lul_device, lul_service, lul_variable, lul_value_old, lul_value_new)
				assertEquals(lul_value_new, "MyNewValueDevice1", "Variable has changed for first device (second watcher)")
			end),
			"urn:upnp-org:serviceId:Service1", "Variable1", 1
		)
		luup.variable_watch(
			wrapAnonymousCallback(function (lul_device, lul_service, lul_variable, lul_value_old, lul_value_new)
				assertEquals(lul_value_new, "MyNewValueDevice2", "Variable has changed for second device")
			end),
			"urn:upnp-org:serviceId:Service1", "Variable1", 2
		)
		luup.variable_set("urn:upnp-org:serviceId:Service1", "Variable1", "MyNewValueDevice1", 1)
		luup.variable_set("urn:upnp-org:serviceId:Service1", "Variable1", "MyNewValueDevice2", 2)
	end

	-- ****************************************************************************************
	-- luup.call_delay
	-- ****************************************************************************************

	function TestCoreVera:test_call_delay()
		expect(4)
		local startTime = os.time()
		luup.call_delay(
			wrapAnonymousCallback(function (data)
				assertEquals(data, "myData1", "First function called correctly")
				assertEquals(os.difftime(os.time() - startTime), 2, "First function is called 2 seconds later")
			end),
			2, "myData1"
		)
		luup.call_delay(
			wrapAnonymousCallback(function (data)
				assertEquals(data, "myData2", "Second function called correctly")
				assertEquals(os.difftime(os.time() - startTime), 1, "Second function is called 1 second later")
			end),
			1, "myData2"
		)
		VeraMock:run()
	end

	-- ****************************************************************************************
	-- luup.inet.wget
	-- ****************************************************************************************

	function TestCoreVera:test_inet_wget_ok()
		VeraMock:addUrl("http://localhost/myUrl", "MyResponse")
		local res, response = luup.inet.wget("http://localhost/myUrl")
		assertEquals(res, 0, "The URL returns a response")
		assertEquals(response, "MyResponse", "The response is correct")
	end

	function TestCoreVera:test_inet_wget_ko()
		local res, response = luup.inet.wget("http://localhost/unknownUrl")
		assertEquals(res, 404, "The URL is not found")
		assertEquals(response, "Not found", "The error message is correct")
	end

	function TestCoreVera:test_inet_wget_with_callback()
		VeraMock:addUrl(
			"http://localhost/myUrlWithCallback",
			function ()
				return 0, "myResponseWithCallback"
			end
		)
		local res, response = luup.inet.wget("http://localhost/myUrlWithCallback")
		assertEquals(res, 0, "The URL returns a response")
		assertEquals(response, "myResponseWithCallback", "The response is correct")
	end

	function TestCoreVera:test_inet_wget_with_callback_and_request()
		VeraMock:addUrl(
			"http://localhost/myUrlWithCallback",
			function (requestUrl)
				return 0, "myResponseWithCallback-"..requestUrl
			end
		)
		local res1, response1 = luup.inet.wget("http://localhost/myUrlWithCallback?param=value1")
		assertEquals(res1, 0, "The URL returns a response")
		assertEquals(response1, "myResponseWithCallback-param=value1", "The response is correct with first request")
		local res2, response2 = luup.inet.wget("http://localhost/myUrlWithCallback?param=value2")
		assertEquals(res2, 0, "The URL returns a response")
		assertEquals(response2, "myResponseWithCallback-param=value2", "The response is correct with second request")
	end

	function TestCoreVera:test_inet_wget_with_callback_and_error()
		VeraMock:addUrl(
			"http://localhost/myUrlWithCallbackAndError",
			function (requestUrl)
				return 404, "myResponseWithCallbackAndError-"..requestUrl
			end
		)
		local res, response = luup.inet.wget("http://localhost/myUrlWithCallbackAndError?param=value")
		assertEquals(res, 404, "The URL returns an error")
		assertEquals(response, "myResponseWithCallbackAndError-param=value", "The response is correct")
	end

	-- ****************************************************************************************
	-- luup.call_action
	-- ****************************************************************************************

	function TestCoreVera:test_call_action_ok()
		VeraMock:addAction(
			"urn:upnp-org:serviceId:Service1", "Action1",
			function (arguments, device)
				if (arguments.newValue ~= nil) then
					luup.variable_set("urn:upnp-org:serviceId:Service1", "Variable2", arguments.newValue, device)
				end
			end
		)
		local error, error_msg = luup.call_action("urn:upnp-org:serviceId:Service1", "Action1", {newValue = "MyNewValue2"}, 1)
		assertEquals(error, 0, "The action is executed")
		assertEquals(luup.variable_get("urn:upnp-org:serviceId:Service1", "Variable2", 1), "MyNewValue2", "The action result is correct")
	end

	function TestCoreVera:test_call_action_ko()
		local error, error_msg = luup.call_action("urn:upnp-org:serviceId:Service1", "Action2", {newValue = "MyNewValue2"}, 1)
		assertEquals(error, -1, "The action is not executed")
		assertEquals(error_msg, "Action not found", "The error message is correct")
	end

-- run all tests
VeraMock:setVerbosity(_verbosity)
LuaUnit:setVerbosity(_verbosity)
LuaUnit:run()
