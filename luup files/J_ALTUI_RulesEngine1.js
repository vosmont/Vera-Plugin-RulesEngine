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

	var _location = window.location.pathname.replace( "/data_request", "" ) + "/";
	var _resourceLoaded = {};

	var htmlControlPanel = '\
<table style="width:100%;">\
	<tr style="height:20px;">\
		<td id ="ruleFiles" colspan="2">\
		</td>\
	</tr>\
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
	<tr style="height:80px;">\
		<td colspan="2" id="RulesEngine_Message">\
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
</category>\
<category name="Properties">\
	<block type="list_property"></block>\
</category>\
<sep></sep>\
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
	</category>\
	<category name="Params">\
		<block type="list_action_param"></block>\
		<block type="action_param_level"></block>\
		<block type="action_param_delay"></block>\
	</category>\
</category>\
<sep></sep>\
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
			.fail(function( jqxhr, textStatus, errorThrown ) {
				$("#RulesEngine_Message" ).text( "Update device : " + textStatus + " - " + errorThrown );
			});
	};

	function _drawDevice( device ) {
		_updateDevice(device);
		return '<div class="panel-content"></div>';
	};

	function _loadResources( fileNames ) {
		var d = $.Deferred();
		var resourceLoaders = [];
		$.each( fileNames, function( index, fileName ) {
			if ( !_resourceLoaded[ fileName ] ) {
				resourceLoaders.push(
					$.ajax( {
						url: _location + fileName,
						dataType: "script",
						beforeSend: function( jqXHR, settings ) {
							jqXHR.fileName = fileName;
						}
					} )
				);
			}
		} );
		$.when.apply( $, resourceLoaders )
			.done( function( script, textStatus, jqxhr ) {
				_resourceLoaded[ jqxhr.fileName ] = true;
				d.resolve();
			} )
			.fail( function( jqxhr, textStatus, errorThrown  ) {
				$( "#RulesEngine_Message" ).text( "Load \"" + jqxhr.fileName + "\" : " + textStatus + " - " + errorThrown  );
				d.fail();
			} );
		return d.promise();
	};

	function _loadRules( fileName ) {
		$.when( $.ajax( { url: _location + fileName, dataType: "text" } ) )
			.done( function( xmlText ) {
				// Update the Blockly workspace
				var workspace = Blockly.getMainWorkspace();
				var xml = Blockly.Xml.textToDom(xmlText);
				Blockly.Xml.domToWorkspace(workspace, xml);
			} )
			.fail( function( jqxhr, textStatus, errorThrown ) {
				$("#RulesEngine_Message" ).text( "Load rules : " + textStatus + " - " + errorThrown );
			} );
	};

	function _drawControlPanel ( device, domparent, toolboxConfig ) {
		// Blockly toolbox
		$( "#toolbox ").html( xmlToolbox );
		// Add custom config
		$.each( toolboxConfig, function( index, config ) {
			var path = "";
			var categories = config.category.split( "," );
			$.each( categories, function( index, category ) {
				path += ( index > 0 ? " " : "" ) + "category[name=\"" + category + "\"]";
			} );
			$("#toolbox").find( path )
				.append( "<block type=\"" + config.type + "\"></block>" );
		} );

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
			var ruleFileNames = MultiBox.getStatus( device, "urn:upnp-org:serviceId:RulesEngine1", "RuleFiles" ).split( "," );
			var resourceFileNames = [ "J_RulesEngine1_Blockly.js" ];
			var toolboxConfig = MultiBox.getStatus( device, "urn:upnp-org:serviceId:RulesEngine1", "ToolboxConfig" );
			if ( ( toolboxConfig !== undefined ) && ( toolboxConfig !== "" ) ) {
				toolboxConfig = $.parseJSON( toolboxConfig );
				$.each( toolboxConfig, function( index, config ) {
					if ( $.inArray( config.resource, resourceFileNames ) === -1 ) {
						resourceFileNames.push( config.resource );
					}
				} );
			} else {
				toolboxConfig = [];
			}
			$( domparent ).append( htmlControlPanel );
			$.when(
				_loadResources( resourceFileNames )
			).done( function() {
				_drawControlPanel( device, domparent, toolboxConfig );
				if ( ruleFileNames.length > 0 ) {
					_loadRules( ruleFileNames[ 0 ] );
				}
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
