-- Create rooms
do
	local function room(n) 
		luup.inet.wget ("127.0.0.1:3480/data_request?id=room&action=create&name=" .. n) 
	end  
	room "Room 1"
	room "Room 2" 
end

luup.log "Set startup code"
luup.attr_set ("StartupCode", [[
--luup.log "Load RulesEngine library"
--package.loaded["L_RulesEngine1"] = require "L_RulesEngine1"

function startUnitTests()
	luup.log "Start RulesEngine unit tests"
	assert(loadfile("./tests/test_RulesEngine.lua"))()
end

luup.call_delay("startUnitTests", 2)
]])

do -- ALTUI
	luup.create_device ("", "ALTUI", "ALTUI", "D_ALTUI.xml")
end

do -- RulesEngine
	local deviceId = luup.create_device ("", "RulesEngine", "RulesEngine", "D_RulesEngine1.xml")
	luup.variable_set("urn:upnp-org:serviceId:RulesEngine1", "Debug", "4", deviceId)
end

do -- Temperature sensors
	for i = 1, 5 do
		luup.create_device ("", "Temperature" .. i, "Temperature " .. i, "D_TemperatureSensor1.xml")
	end
end
do -- Motion sensors
	local deviceId
	for i = 1, 5 do
		deviceId = luup.create_device ("", "Motion" .. i, "Motion " .. i, "D_MotionSensor1.xml", nil, nil, nil, nil, nil, nil, nil, nil, "urn:micasaverde-com:serviceId:SecuritySensor1,Armed=0\nurn:micasaverde-com:serviceId:SecuritySensor1,Tripped=0")
		luup.attr_set ("category_num", 4, deviceId) -- TODO : not saved in openLuup ?
		luup.attr_set ("subcategory_num", 3, deviceId)
	end
end
do -- Switches
	local deviceId, roomId
	for i = 1, 10 do
		deviceId = luup.create_device ("", "Switch" .. i, "Switch " .. i, "D_BinaryLight1.xml", nil, nil, nil, nil, nil, nil, nil, nil, "urn:upnp-org:serviceId:SwitchPower1,Status=0")
		if (i < 6) then
			roomId = 1
		else
			roomId = 2
		end
		luup.attr_set ("room", roomId, deviceId)
	end
end

-- Force writing "user_data.json"
luup.reload()
