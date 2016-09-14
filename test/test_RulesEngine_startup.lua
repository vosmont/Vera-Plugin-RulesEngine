local url = require("socket.url")

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

-- Create rooms
do
	local function room(n) 
		luup.inet.wget ("127.0.0.1:3480/data_request?id=room&action=create&name=" .. n) 
	end  
	room "Room 1"
	room "Room 2"
	room "Room 3" 
end

do -- ALTUI
	luup.create_device ("", "ALTUI", "ALTUI", "D_ALTUI.xml")
end

do -- RulesEngine
	local deviceId = luup.create_device ("", "RulesEngine", "RulesEngine", "D_RulesEngine1.xml")
	luup.variable_set("urn:upnp-org:serviceId:RulesEngine1", "Debug", "4", deviceId)
end

do -- Temperature sensors
	for i = 1, 5 do
		luup.create_device ("", "Temperature" .. i, "Temperature " .. i, "D_TemperatureSensor1.xml", nil, nil, nil, nil, nil, nil, nil, nil, "urn:upnp-org:serviceId:TemperatureSensor1,CurrentTemperature=0")
	end
end
do -- Motion sensors
	local deviceId
	for i = 1, 5 do
		deviceId = luup.create_device ("", "Motion" .. i, "Motion " .. i, "D_MockMotionSensor1.xml", nil, nil, nil, nil, nil, nil, nil, nil, "urn:micasaverde-com:serviceId:SecuritySensor1,Armed=0\nurn:micasaverde-com:serviceId:SecuritySensor1,Tripped=0")
		luup.attr_set ("category_num", 4, deviceId) -- TODO : not saved in openLuup ?
		luup.attr_set ("subcategory_num", 3, deviceId)
		if (i < 3) then
			roomId = 1
		else
			roomId = 2
		end
		luup.attr_set ("room", roomId, deviceId)
	end
end
do -- Switches
	local deviceId, roomId
	for i = 1, 10 do
		deviceId = luup.create_device ("", "", "Switch " .. i, "D_MockBinaryLight1.xml", nil, nil, nil, nil, nil, nil, nil, nil, "urn:upnp-org:serviceId:SwitchPower1,Status=0")
		if (i < 6) then
			roomId = 1
		else
			roomId = 2
		end
		luup.attr_set ("room", roomId, deviceId)
	end
end
do -- Associated devices and scenes
	local function createScene( sceneId, sceneName, deviceId, roomId )
		local json = '{"timers":[],"triggers":[],"groups":[{"actions":[{"action":"SetTarget","arguments":[{"name":"newTargetValue","value":"1"}],"device":"' .. deviceId .. '","service":"urn:upnp-org:serviceId:SwitchPower1"}],"delay":0}],"Timestamp":0,"favorite":false,"id":' .. sceneId .. ',"last_run":0,"lua":"","modeStatus":"0","name":"' .. sceneName .. '","paused":0,"room":' .. roomId .. '}'
		luup.inet.wget( "127.0.0.1:3480/data_request?id=scene&action=create&json=" .. url.escape(json) )
	end
	local deviceId
	deviceId = luup.create_device("", "", "BinaryLight 1", "D_MockBinaryLight1.xml", nil, nil, nil, nil, nil, nil, nil, nil, "urn:upnp-org:serviceId:SwitchPower1,Status=0" )
	luup.attr_set( "room", 1, deviceId )
	createScene( 1, "Scene 1", deviceId, 1 )
	for i = 2, 5 do
		deviceId = luup.create_device ("", "", "BinaryLight " .. i, "D_MockBinaryLight1.xml", nil, nil, nil, nil, nil, nil, nil, nil, "urn:upnp-org:serviceId:SwitchPower1,Status=0" )
		luup.attr_set ("room", 1, deviceId)
	end

	deviceId = luup.create_device("", "", "DimmableLight 1", "D_MockDimmableLight1.xml", nil, nil, nil, nil, nil, nil, nil, nil, "urn:upnp-org:serviceId:SwitchPower1,Status=0\nurn:upnp-org:serviceId:Dimming1,LoadLevelStatus=0" )
	luup.attr_set( "room", 2, deviceId )
	createScene( 2, "Scene 2", deviceId, 2 )
	for i = 2, 5 do
		deviceId = luup.create_device ("", "", "DimmableLight " .. i, "D_MockDimmableLight1.xml", nil, nil, nil, nil, nil, nil, nil, nil, "urn:upnp-org:serviceId:SwitchPower1,Status=0\nurn:upnp-org:serviceId:Dimming1,LoadLevelStatus=0" )
		luup.attr_set ("room", 2, deviceId)
	end
end
do -- Load tests
	--for i = 1, 900 do
	for i = 1, 10 do
		deviceId = luup.create_device ("", "", "Door " .. i, "D_MockDoorSensor1.xml", nil, nil, nil, nil, nil, nil, nil, nil, "urn:micasaverde-com:serviceId:SecuritySensor1,Armed=0\nurn:micasaverde-com:serviceId:SecuritySensor1,Tripped=0" )
		luup.attr_set ("room", 3, deviceId)
	end
end

-- Force writing "user_data.json"
luup.reload()
