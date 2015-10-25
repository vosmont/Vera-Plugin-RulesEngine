//# sourceURL=J_ALTUI_RulesEngine1.js
"use strict";
// This program is free software: you can redistribute it and/or modify
// it under the condition that it is for private or home useage and 
// this whole comment is reproduced in the source code file.
// Commercial utilisation is not authorized without the appropriate
// written agreement from amg0 / alexis . mermet @ gmail . com
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. 

var ALTUI_RulesEngine = ( function( window, undefined ) {  

	var htmlControlPanel = '\
<table style="width:100%;">\
	<tr style="height:20px;">\
		<td align="center">\
			<a href="javascript:ALTUI_RulesEngine.loadXml()">Load XML</a>\
		</td>\
		<td align="center">\
			<a href="javascript:ALTUI_RulesEngine.dumpXml()">Dump XML</a>\
		</td>\
	</tr>\
	<tr style="height:80px;">\
		<td colspan="2">\
			<textarea id="xmlRules" style="width:100%; height:100%;"></textarea>\
		</td>\
	</tr>\
</table>\
<xml id="toolbox" style="display: none"></xml>\
<div id="blocklyDiv" style="width: 100%; height: 800px;"></div>\
	';

	var xmlToolbox = '\
<category name="Rules">\
	<block type="rule">\
		<field name="isEnabled">TRUE</field>\
		<value name="name">\
			<block type="text"><field name="TEXT"></field></block>\
		</value>\
		<value name="description">\
			<block type="text_area"><field name="TEXT"></field></block>\
		</value>\
		<value name="conditions">\
			<block type="list_with_operator_condition">\
				<mutation items="2"></mutation>\
				<field name="operator">OR</field>\
			</block>\
		</value>\
	</block>\
	<category name="Properties">\
		<block type="list_property"></block>\
		<!-- à générer dynamiquement (HOOK) -->\
		<block type="alarm_panel"></block>\
	</category>\
</category>\
<category name="Conditions">\
	<block type="list_with_operator_condition"></block>\
	<category name="Types">\
		<block type="condition_value"></block>\
		<block type="condition_time"></block>\
		<block type="condition_rule"></block>\
	</category>\
	<category name="Params">\
		<block type="list_condition_param"></block>\
		<block type="condition_param_level"></block>\
		<block type="condition_param_since"></block>\
	</category>\
</category>\
<category name="Actions">\
	<block type="action_group">\
		<value name="params">\
			<block type="list_action_param" inline="true">\
				<mutation items="1"></mutation>\
			</block>\
		</value>\
	</block>\
	<category name="Types">\
		<block type="action_function"></block>\
		<block type="action_device"></block>\
		<!-- à générer dynamiquement (custom action types) -->\
		<block type="action_email"></block>\
		<block type="action_vocal"></block>\
	</category>\
	<category name="Params">\
		<block type="list_action_param"></block>\
		<block type="action_param_level"></block>\
		<block type="action_param_delay"></block>\
	</category>\
</category>\
<category name="Values">\
	<block type="text"></block>\
	<block type="text_area"></block>\
	<block type="math_number"></block>\
	<block type="lists_create_with"></block>\
</category>\
	';

	// return styles needed by this plugin module
	function _getStyle() {
		var style = '\
#blocklyArea { height: 100%; }\
		';
		return style;
	};

	function _onDeviceStatusChanged( event, device ) {
		if ( device.device_type === "urn:schemas-upnp-org:device:RulesEngine:1" ) {
			for ( var i = 0; i < device.states.length; i++ ) { 
				if ( device.states[ i ].variable === "AlarmPanel" ) {
					$( ".altui-device[data-altuiid='" + device.altuiid + "']").each( function(index, element) {
						$( element ).find( ".panel-content" ).each( function( index, element ) {
							$( element ).html( device.states[ i ].value );
						} );
					} );
					break;
				}
			}
		}
	};

	function _updateDevice( device ) {
		var location = window.location.pathname;
		$.when(
			$.ajax({
				url: location + "?id=lr_RulesEngine&command=getTimeline&output=json#",
				dataType: "text"
			})
		)
			.done(function( html ) {
				$(".altui-device[data-altuiid='" + device.altuiid + "']").each( function(index, element) {
					$(element).find(".panel-content").each( function(index, element) {
						$(element).html(html);
					});
				});
			})
			.fail(function( jqxhr, settings, exception ) {
				$("#blocklyDiv" ).text( "Triggered ajaxError handler." );
			});
	};

	function _drawDevice( device ) {
		_updateDevice(device);
		return '<div class="panel-content"></div>';
	};

	/*
	function _loadResources() {
		var d = $.Deferred();
		if (window.ALTUI_RulesEngineResourcesAreLoaded === true) {
			d.resolve();
		} else {
			var location = window.location.pathname.replace("/port_3480/data_request", "") + "/cgi-bin/cmh/download_upnp_file.sh";
			$.when(
				$.getScript(location + "?file=J_RulesEngine1_Blockly.js.lzo"),
				$.getScript(location + "?file=J_RulesEngine1_Blockly_AlarmPanel.js.lzo")
			)
				.done(function( script, textStatus ) {
					d.resolve();
				})
				.fail(function( jqxhr, settings, exception ) {
					$("#blocklyDiv" ).text( "Triggered ajaxError handler." );
					d.fail();
				});
		}
		return d.promise();
	};
	*/

	function _loadResources() {
		var d = $.Deferred();
		if (window.ALTUI_RulesEngineResourcesAreLoaded === true) {
			d.resolve();
		} else {
			var location = window.location.pathname.replace("/data_request", "");
			$.when(
				$.getScript(location + "/J_RulesEngine1_Blockly.js"),
				$.getScript(location + "/J_RulesEngine1_Blockly_AlarmPanel.js")
			)
				.done(function( script, textStatus ) {
					d.resolve();
				})
				.fail(function( jqxhr, settings, exception ) {
					$("#blocklyDiv" ).text( "Triggered ajaxError handler." );
					d.fail();
				});
		}
		return d.promise();
	};

	function _loadResources2() {
		var d = $.Deferred();
		if (window.ALTUI_RulesEngineResourcesAreLoaded === true) {
			d.resolve();
		} else {
			var location = window.location.pathname.replace("/data_request", "");
			$.when(
				$.getScript(location + "/J_RulesEngine1_Blockly.js"),
				$.getScript(location + "/J_RulesEngine1_Blockly_AlarmPanel.js")
			)
				.done(function( script, textStatus ) {
					d.resolve();
				})
				.fail(function( jqxhr, settings, exception ) {
					$("#blocklyDiv" ).text( "Triggered ajaxError handler." );
					d.fail();
				});
		}
		return d.promise();
	};

	function _loadRules() {
		var location = window.location.pathname.replace("/data_request", "");
		$.when(
			$.ajax({
				url: location + "/C_RulesEngine_Rules.xml",
				dataType: "text"
			})
		)
			.done(function( xmlText ) {
				var workspace = Blockly.getMainWorkspace();
				var xml = Blockly.Xml.textToDom(xmlText);
				Blockly.Xml.domToWorkspace(workspace, xml);
			})
			.fail(function( jqxhr, settings, exception ) {
				$("#blocklyDiv" ).text( "Triggered ajaxError handler." );
			});
	};

	function _drawControlPanel (device, domparent) {
		// Blockly toolbox
		$( "#toolbox ").html( xmlToolbox );

		// Blockly workspace
		var blocklyDiv = document.getElementById('blocklyDiv');
		Blockly.inject(blocklyDiv, {
			//media: './media/',
			toolbox: document.getElementById('toolbox'),
			grid: {
				spacing: 20,
				length: 3,
				colour: '#ccc',
				snap: true
			},
			sounds: false,
			trashcan: true
		});

		// Controller of the Rules Engine
		$( "#blocklyDiv" ).data( "controller_id", MultiBox.controllerOf( device.altuiid ).controller );
	};

  // explicitly return public methods when this object is instantiated
	return {
		//---------------------------------------------------------
		// PUBLIC  functions
		//---------------------------------------------------------
		getStyle: _getStyle,
		drawDevice: _drawDevice,
		drawControlPanel: function( device, domparent ) {
			$( domparent ).append( htmlControlPanel );
			$.when(
				_loadResources()
			).done( function() {
				_drawControlPanel( device, domparent );
				_loadRules();
			} );
		},
		onDeviceStatusChanged: _onDeviceStatusChanged,
		
		loadXml: function () {
			var workspace = Blockly.getMainWorkspace();
			var xml_text = $( "#xmlRules" ).val();
			var xml = Blockly.Xml.textToDom( xml_text );
			Blockly.Xml.domToWorkspace( workspace, xml );
		},
		dumpXml: function () {
			var workspace = Blockly.getMainWorkspace();
			var xml = Blockly.Xml.workspaceToDom( workspace );
			//var xml_text = Blockly.Xml.domToText(xml);
			var xml_text = Blockly.Xml.domToPrettyText( xml );
			$( "#xmlRules" ).val( xml_text );
		}
	};
})( window );

EventBus.registerEventHandler("on_ui_deviceStatusChanged", ALTUI_RulesEngine, "onDeviceStatusChanged");
