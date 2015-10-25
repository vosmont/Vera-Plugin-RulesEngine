//# sourceURL=J_ALTUI_VirtualAlarmPanel1.js
"use strict";
// This program is free software: you can redistribute it and/or modify
// it under the condition that it is for private or home useage and 
// this whole comment is reproduced in the source code file.
// Commercial utilisation is not authorized without the appropriate
// written agreement from amg0 / alexis . mermet @ gmail . com
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. 

var ALTUI_VirtualAlarmPanel = ( function( window, undefined ) {

	function _onDeviceStatusChanged( event, device ) {
		if (device.device_type === "urn:schemas-upnp-org:device:VirtualAlarmPanel:1") {
			for (var i = 0; i < device.states.length; i++) { 
				if (device.states[i].variable === "AlarmPanel") {
					$(".altui-device[data-altuiid='" + device.altuiid + "']").each( function(index, element) {
						$(element).find(".panel-content").each( function(index, element) {
							$(element).html(device.states[i].value);
						});
					});
					break;
				}
			}
		}
	};

	function _drawDevice( device ) {
		var htmlAlarmPanel = MultiBox.getStatus(device, 'urn:upnp-org:serviceId:VirtualAlarmPanel1', 'AlarmPanel'); 
		return '<div class="panel-content">' + htmlAlarmPanel + '</div>';
	};

  // explicitly return public methods when this object is instantiated
	return {
		//---------------------------------------------------------
		// PUBLIC  functions
		//---------------------------------------------------------
		//getStyle 	: _getStyle,
		drawDevice: _drawDevice,
		onDeviceStatusChanged: _onDeviceStatusChanged
	};
})( window );

EventBus.registerEventHandler("on_ui_deviceStatusChanged", ALTUI_VirtualAlarmPanel, "onDeviceStatusChanged");
