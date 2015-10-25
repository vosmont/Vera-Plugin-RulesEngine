/**
 * @fileoverview Virtual Alarm Panel block for Blockly.
 * @author vosmont
 */
'use strict';

Blockly.Blocks['alarm_panel'] = {
	init: function() {
		this.setHelpUrl("http://forum.micasaverde.com/index.php/topic,32180.0.html");
		this.setColour(0);

		// Panel
		var alarmPanels = [["...", 0]];
		MultiBox.getDevices(
			null,
			function(device) { return device.device_type === "urn:schemas-upnp-org:device:VirtualAlarmPanel:1"; },
			function(devices) {
				for (var i = 0; i < devices.length; i++) {
					alarmPanels.push([devices[i].name, devices[i].id + ";" + devices[i].name]);
				}
			}
		);
		this.appendDummyInput()
			.appendField('Panel')
			.appendField(
				new Blockly.FieldDropdown(alarmPanels, function (newValue) {
					this.sourceBlock_.updateAlarm_(newValue.split(";")[0]);
				}),
				'device'
			);

		// Alarm
		this.appendDummyInput()
			.appendField('alarm')
			.appendField(new Blockly.FieldDropdown([["...", ""]]), 'alarmName');

		this.appendDummyInput()
			.appendField('is acknowledgeable')
			.appendField(new Blockly.FieldCheckbox("TRUE"), "isAcknowledgeable");

		this.setInputsInline(true);
		this.setOutput(true, 'Property');
		this.setTooltip("Link an acknowledgeable alarm to this rule.");
	},

	updateAlarm_: function (newPanelId) {
		var alarmsDropdown = this.getField('alarmName');
		var alarmNames = alarmsDropdown.getOptions_();
		alarmNames.splice(0,alarmNames.length);
		alarmNames.push(["...",""]);
		alarmsDropdown.setValue("");

		var device = MultiBox.getDeviceByID(0, newPanelId);
		if (device == null) {
			return;
		}
		for (var i = 0; i < device.states.length; i++) {
			var state = device.states[i];
			if (state.variable === "Alarms") {
				var alarms = JSON.parse(state.value);
				$.each(alarms, function (j, alarm) {
					alarmNames.push([alarm.name, alarm.name]);
				});
				break;
			}
		}
	}
};
