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
	var _settings = {};
	var _registerIsDone = false;

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
.altui-rule-toolbar { margin:5px 15px;  }\
.altui-rule-body .infos { margin-left:5px; }\
#blocklyArea { height: 100%; }\
		';
		return style;
	};

	function _convertTimestampToLocaleString( timestamp ) {
		if ( typeof( timestamp ) === "undefined" ) {
			return "";
		}
		var t = new Date( parseInt( timestamp, 10 ) * 1000 );
		var localeString = t.toLocaleString();
		return localeString;
	};

	function _onDeviceStatusChanged( event, device ) {
		if ( device.device_type === "urn:schemas-upnp-org:device:RulesEngine:1" ) {
			// Seems to be called at each change in the system, not just our device
			for ( var i = 0; i < device.states.length; i++ ) {
				if ( device.states[ i ].variable === "LastUpdate" ) {
					if ( _settings[ device.altuiid ].lastUpdate !== device.states[ i ].value ) {
						_settings[ device.altuiid ].lastUpdate = device.states[ i ].value;
						$.when( _getTimelineAsync( device ) )
							.done( function( timeline ) {
								_settings[ device.altuiid ].timeline = timeline;
								_updateDevice( device, timeline );
								_updateTimeline( timeline );
							} );
					}
					break;
				} else if ( device.states[ i ].variable === "Rules" ) {
//console.log(device.states[ i ].value);
					_updateRules( device, device.states[ i ].value );
				}
			}
		}
	};

	function _getTimelineAsync( device ) {
		// seul un device réponds via le handler : que se passe-t-il si plusieurs device se sont enregistrés ?
		var d = $.Deferred();
		$.when(
			$.ajax( {
				url: window.location.pathname + "?id=lr_RulesEngine&command=getTimeline&output_format=json#",
				dataType: "json"
			} )
		)
			.done( function( timeLine ) {
				if ( $.isPlainObject( timeLine ) ) {
					d.resolve( timeLine );
				} else {
					PageMessage.message( "No timeline", "warning" );
					d.fail();
				}
			} )
			.fail( function( jqxhr, textStatus, errorThrown ) {
				PageMessage.message( "Get timeline error : " + errorThrown, "warning" );
				d.fail();
			} );
		return d.promise();
	};

	function _updateDevice( device, timeline ) {
		var nodePath = ".altui-device[data-altuiid='" + device.altuiid + "'] .panel-content .info";
		if ( $.isArray( timeline.scheduled ) && timeline.scheduled.length > 0 ) {
			var nextSchedule = timeline.scheduled[ 0 ];
			$(nodePath).html( "<div>Next schedule: " + _convertTimestampToLocaleString( nextSchedule.timestamp ) + "</div>" );
		} else {
			$(nodePath).html( "<div>No scheduled task</div>" );
		}
	};

	function _updateRules( device, jsonRulesInfos ) {
		var rulesInfos = $.parseJSON( jsonRulesInfos || MultiBox.getStatus( device, "urn:upnp-org:serviceId:RulesEngine1", "Rules" ) );
		$.each( rulesInfos, function( id, infos ) {
			var status = {
				"1": "ON",
				"0": "OFF"
			};
			var html = ( status[ infos.status ] || "KO" ) 
				+ ( infos.lastStatusUpdate > 0 ? _T( " since " ) + _convertTimestampToLocaleString( infos.lastStatusUpdate ) : "")
				+ ( infos.error != null ? " " + infos.error : "" );
			$( '.altui-mainpanel .altui-rule[data-ruleid="' + id + '"] .infos' ).html( html );
		} );
	};

	function _loadResourcesAsync( fileNames ) {
		var d = $.Deferred();
		// Prepare loaders
		var loaders = [];
		$.each( fileNames, function( index, fileName ) {
			if ( !_resourceLoaded[ fileName ] ) {
				loaders.push(
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
		// Execute loaders
		$.when.apply( $, loaders )
			.done( function() {
				for (var i = 0; i < arguments.length; i++) {
					_resourceLoaded[ arguments[ i ][ 2 ].fileName ] = true;
				}
				d.resolve();
			} )
			.fail( function( jqxhr, textStatus, errorThrown  ) {
				PageMessage.message( "Load \"" + jqxhr.fileName + "\" : " + textStatus + " - " + errorThrown, "danger");
				d.fail();
			} );
		return d.promise();
	};

	function _loadRulesAsync( device ) {
		_settings[ device.altuiid ].rules = [];
		var d = $.Deferred();
		var fileNames = MultiBox.getStatus( device, "urn:upnp-org:serviceId:RulesEngine1", "RuleFiles" ).split( "," );
		// Prepare loaders
		var loaders = [];
		$.each( fileNames, function( index, fileName ) {
			loaders.push(
				$.ajax( {
					url: _location + fileName,
					dataType: "xml",
					beforeSend: function( jqXHR, settings ) {
						jqXHR.fileName = fileName;
					}
				} )
			);
		} );
		if ( loaders.length > 0 ) {
			// Execute loaders
			$.when.apply( $, loaders )
				.done( function() {
					var args = ( loaders.length === 1 ) ? [ arguments ] : arguments;
					for ( var i = 0; i < args.length; i++ ) {
						// args: [ xml, textStatus, jqxhr ]
						var $xml = $( args[ i ][ 0 ] );
//console.log("xml",  args[ i ][ 0 ]);
//console.log("xml", $xml.find("block[type=\"rule\"]"));
						var items = [];
						$xml.find( "block[type=\"rule\"]" )
							.each( function( idx, xmlRule ) {
								items.push( {
									//id: $(xmlRule).children( "data" ).text().trim(),
									id: ( i + 1 ) + "-" + ( idx + 1 ),
									name: $(xmlRule).children( "value[name=\"name\"]" ).text().trim(),
									xml: xmlRule
								} );
							} );
						_settings[ device.altuiid ].rules.push( {
							fileName: args[ i ][ 2 ].fileName,
							items: items
						} );
					}
//console.log("_settings", _settings);
					d.resolve( _settings[ device.altuiid ].rules );
				} )
				.fail( function( jqxhr, textStatus, errorThrown  ) {
					PageMessage.message( "Load \"" + jqxhr.fileName + "\" : " + textStatus + " - " + errorThrown, "danger");
					d.fail();
				} );
		} else {
			d.resolve( [] );
		}
		return d.promise();
	};

	function _getGroupRules( device, fileName ) {
		for ( var i = 0; i < _settings[ device.altuiid ].rules.length; i++ ) {
			var groupRules = _settings[ device.altuiid ].rules[ i ];
			if ( groupRules.fileName === fileName ) {
				return groupRules;
			}
		}
		return;
	};

	function _getXmlRules( device, fileName, ruleName ) {
		var xmlRules = [];
		var groupRules = _getGroupRules( device, fileName );
		if ( groupRules != null ) {
			for ( var i = 0; i < groupRules.items.length; i++ ) {
				if ( ( ruleName == null ) || ( groupRules.items[ i ].name === ruleName ) ) {
					xmlRules.push( groupRules.items[ i ].xml );
				}
			}
		}
		return xmlRules;
	};

	function _getCgiUrl() {
		var protocol = document.location.protocol;
		var host = document.location.hostname;
		var httpPort = document.location.port;
		var pathName = window.location.pathname;
		var cgiUrl = protocol + "//" + host;

		if ( pathName.indexOf( "/port_3480" ) !== -1 ) {
			// Relay mode
			pathName = pathName.replace( "/port_3480", "" )
			if ( httpPort != "" ) {
				cgiUrl = cgiUrl + ":" + httpPort;
			}
		} else {
			//cgiUrl = cgiUrl + ( ( httpPort != 80 && httpPort != "" ) ? ":" + httpPort : "" );
		}
		cgiUrl = cgiUrl + pathName.replace( "/data_request", "" ) + "/cgi-bin/cmh";
		return cgiUrl;
	};

	function _saveRulesFileAsync( device, fileName ) {
		var d = $.Deferred();

		var xmlRules = _getXmlRules( device, fileName );
//console.log("xmlRules", xmlRules );
		var xml = $.parseXML( '<xml xmlns="http://www.w3.org/1999/xhtml"></xml>' );
		var $xml = $( xml ).children(0);
		$.each( xmlRules, function( idx, xmlRule ) {
//console.log("xmlRule",xmlRule);
//console.log($( xmlRule ).children(0));
			//$xml.append( $( xmlRule ).children(0) );
			$xml.append( xmlRule );
		} );
//console.log(xml);
		var content = Blockly.Xml.domToPrettyText( xml );
//console.log(content);
		var blob = new Blob( [ content ], { type: "text/xml"} );

		var fd = new FormData();
		fd.append( "upnp_file_1", blob );
		fd.append( "upnp_file_1_name", fileName );

		$.ajax( {
			method: "POST",
			url: _getCgiUrl() + "/upload_upnp_file.sh",
			data: fd,
			crossDomain: true,
			headers: {'X-Requested-With': 'XMLHttpRequest'},
			xhrFields: {
				withCredentials: true
			},
			contentType: false,
			processData: false
		} )
		.done( function( html ) {
			if ( html.indexOf( "OK|" + fileName ) !== -1 ) {
				d.resolve();
			} else {
				PageMessage.message( "Save \"" + fileName + "\" : " + html, "danger");
				d.fail();
			}
		} )
		.fail( function( jqxhr, textStatus, errorThrown ) {
			PageMessage.message( "Save \"" + fileName + "\" : " + textStatus + " - " + errorThrown, "danger");
			d.fail();
		} );

		return d.promise();
	}

	function _drawBlocklyPanel ( device, toolboxConfig ) {
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

	function _drawBlocklyRules ( device, fileName, ruleName ) {
		var workspace = Blockly.getMainWorkspace();
		var xmlRules = _getXmlRules( device, fileName, ruleName );
		Blockly.Xml.domToWorkspace(workspace, { childNodes: xmlRules } );
	};

	function _watchBlocklyChanges( device ) {
		var workspace = Blockly.getMainWorkspace();
		var _timestamp = (new Date()).getTime();
		$( workspace.getCanvas() ).on( "blocklyWorkspaceChange", function( event ) {
			if ( event.timeStamp  > _timestamp + 100 ) {
				$(".altui-rule-confirmbutton").removeClass("btn-default").removeClass("disabled").addClass("btn-danger");
				$( workspace.getCanvas() ).off( "blocklyWorkspaceChange" );
				_settings[ device.altuiid ].isModified = true;
			}
		} );
	}

	function _pageRules( altuiid ) {
		var device = MultiBox.getDeviceByAltuiID( altuiid );
		UIManager.clearPage( _T( "Control Panel" ), "Rules - {0} <small>#{1}</small>".format( device.name , altuiid ), UIManager.oneColumnLayout );

		// Draw the panel
		var html = '<div class="altui-rule-toolbar">'
			+			'<button class="btn btn-default altui-rule-create">'
			+				'<span class="glyphicon glyphicon-plus" aria-hidden="true" data-toggle="tooltip" data-placement="bottom" title="Add"></span>'
			+				_T( "Create" )
			+			'</button>'
			+	'</div>';
		$(".altui-mainpanel")
			.append(  html )
			.on( "click", ".altui-rule-create", function() {
				// TODO : select the file
				var fileNames = MultiBox.getStatus( device, "urn:upnp-org:serviceId:RulesEngine1", "RuleFiles" ).split( "," );
				var fileName = ( fileNames.length > 0 ) ? fileNames[ 0 ] : "C_RulesEngine_Rules.xml";
				ALTUI_RulesEngine.pageRuleEdit( altuiid, fileName );
			} );

		// Draw the rules
		$(".altui-mainpanel").append( '<div class="rules"></div>' );
		$.when( _loadRulesAsync( device ) )
				.done( function( rules ) {
					$.each( rules, function( idx, groupRules) {
						$.each( groupRules.items, function( idx, item) {
							$(".altui-mainpanel .rules").append(
									'<div class="col-sm-6 col-md-4 col-lg-3">'
								+		'<div class="panel panel-default altui-rule" data-altuiid="' + device.altuiid + '" data-ruleid="' + item.id + '" id="' + device.altuiid + '">'
								+			'<div class="panel-heading altui-device-heading">'
								+				'<div class="pull-right text-muted"><small>#' + item.id + '</small></div>'
								+				'<div class="panel-title altui-device-title" data-toggle="tooltip" data-placement="left">'
								/*+					'<div class="btn-group pull-right">'
								+						'<button class="btn btn-default btn-xs dropdown-toggle altui-device-command" type="button" data-toggle="dropdown" aria-expanded="false"><span class="caret"></span></button>'
								+						'<ul class="dropdown-menu" role="menu">'
								+							'<li><a id="0-3" class="altui-device-variables" href="#" role="menuitem">Variables</a></li>'
								+							'<li><a id="0-3" class="altui-device-actions" href="#" role="menuitem">Actions</a></li><li><a id="0-3" class="altui-device-controlpanelitem" href="#" role="menuitem">Control Panel</a></li></ul>'
								+					'</div>'*/
								//+					'<span class="glyphicon glyphicon-star-empty altui-favorite text-muted" aria-hidden="true" data-toggle="tooltip" data-placement="bottom" title="Favori"></span>'
								+					'<small class="altui-rule-title-name">' + item.name + '</small>'
								+				'</div>'
								+			'</div>'
								+			'<div class="panel-body altui-rule-body">'
								+				'<button class="btn btn-default altui-rule-editbutton" onclick="javascript:ALTUI_RulesEngine.pageRuleEdit(\'' + device.altuiid + '\', \'' + groupRules.fileName + '\', \'' + item.name + '\');">' + _T( "Edit" ) + '</button>'
								+				'<span class="infos"></span>'
								+			'</div>'
								+		'</div>'
								+	'</div>'
							);
						} );
					} );
					_updateRules( device );
				} );
	};

	function _updateTimeline( timeline ) {
		if ( $(".altui-mainpanel .timeline").length === 0 ) {
			return;
		}
		$(".altui-mainpanel .timeline").empty();
		$(".altui-mainpanel .timeline").append( '<div> History: </div>' );
		$.each( timeline.history, function( idx, item ) {
			$(".altui-mainpanel .timeline").append( '<div>' + _convertTimestampToLocaleString( item.timestamp ) + ' - ' + item.eventType + ' - ' + item.event + '</div>' );
		} );
		$(".altui-mainpanel .timeline").append( '<div> Schedule: </div>' );
		$.each( timeline.scheduled, function( idx, item ) {
			$(".altui-mainpanel .timeline").append( '<div>' + _convertTimestampToLocaleString( item.timestamp ) + ' - ' + item.eventType + ' - ' + item.event + '</div>' );
		} );
	};

	function _pageTimeline( altuiid ) {
		var device = MultiBox.getDeviceByAltuiID( altuiid );
		UIManager.clearPage( _T( "Control Panel" ), "Timeline - {0} <small>#{1}</small>".format( device.name , altuiid ), UIManager.oneColumnLayout );
		show_loading();
		$(".altui-mainpanel").append( '<div class="timeline"></div>' );
		$.when( _getTimelineAsync( device ) )
			.done( function( timeline ) {
				_updateTimeline( timeline );
				hide_loading();
			} )
			.fail( function( errorThrown ) {
				hide_loading();
			} );
	};

	function _validateBlocklyChanges( altuiid, fileName, formerRuleName ) {
		var device = MultiBox.getDeviceByAltuiID( altuiid );
		
		var workspace = Blockly.getMainWorkspace();
		var $xml = $( Blockly.Xml.workspaceToDom( workspace ) );
		var modifiedItems = [];
		$xml.find( "block[type=\"rule\"]" )
			.each( function( idx, xmlRule ) {
				modifiedItems.push( {
					name: $(xmlRule).children( "value[name=\"name\"]" ).text().trim(),
					xml: xmlRule
				} );
			} );
//console.log("modifiedItems", modifiedItems);
		
		var groupRules = _getGroupRules( device, fileName );
		if ( groupRules == null ) {
			groupRules = {
				fileName: fileName,
				items: []
			};
			_settings[ device.altuiid ].rules.push( groupRules );
		}

		$.each( modifiedItems, function( idx, modifiedItem ) {
			if ( ( idx === 0 ) && ( formerRuleName != null ) ) {
				// Modify existing rule
				for ( var j = 0; j < groupRules.items.length; j++ ) {
					if ( groupRules.items[ j ].name === formerRuleName ) {
						groupRules.items[ j ].name = modifiedItem.name;
						groupRules.items[ j ].xml  = modifiedItem.xml;
						break;
					}
				};
			} else {
				// Add the new rule
				groupRules.items.push( modifiedItem );
			}
		} );

		$.when( _saveRulesFileAsync( device, fileName ) )
		.done( function() {
			PageMessage.message( "File '" + fileName + "' has been saved", "info");
			ALTUI_RulesEngine.pageRules( altuiid );
		} )
		.fail( function() {
			PageMessage.message( "Rule XML has been dumped", "warning");
			ALTUI_RulesEngine.dumpXml();
		} );
	};

	function _pageRuleEdit( altuiid, fileName, ruleName ) {
		var device = MultiBox.getDeviceByAltuiID( altuiid );
		UIManager.clearPage( _T( "Control Panel" ), "Edit rule - {0} <small>#{1}</small>".format( device.name , altuiid ), UIManager.oneColumnLayout );

		// Draw the panel
		var html = '<div class="altui-scene-toolbar">'
			+			'<button class="btn btn-default altui-rule-cancelbutton">' + _T( "Cancel" ) + '</button>'
			+			'<button class="btn btn-default disabled altui-rule-confirmbutton">' + _T( "Ok" ) + '</button>'
			+	'</div>'
			+	'<div class="col-xs-12">' + htmlControlPanel + '</div>';
		$(".altui-mainpanel")
			.append(  html )
			.on( "click", ".altui-rule-cancelbutton", function() {
				ALTUI_RulesEngine.pageRules( altuiid );
			} )
			.on( "click", ".altui-rule-confirmbutton", function() {
				if ( !$( this ).hasClass( "disabled" ) ) {
					ALTUI_RulesEngine.validateBlocklyChanges( altuiid, fileName, ruleName );
					//ALTUI_RulesEngine.pageRules( altuiid );
				}
			} );

		// Get the names of the resource files
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
		$.when( _loadResourcesAsync( resourceFileNames ) )
			.done( function() {
				_settings[ altuiid ].isModified = false;
				_drawBlocklyPanel( device, toolboxConfig );
				if ( ( ruleName != null ) && ( ruleName !== "" ) ) {
					_drawBlocklyRules( device, fileName, ruleName );
				}
				_watchBlocklyChanges( device );
			} );
	};

	// explicitly return public methods when this object is instantiated
	return {
		//---------------------------------------------------------
		// PUBLIC  functions
		//---------------------------------------------------------

		getStyle: _getStyle,

		drawDevice: function( device ) {
			if ( _settings[ device.altuiid ] == null ) {
				_settings[ device.altuiid ] = {
					isModified: false
				};
			}
			if ( !_registerIsDone ) {
				EventBus.registerEventHandler("on_ui_deviceStatusChanged", ALTUI_RulesEngine, "onDeviceStatusChanged");
				_registerIsDone = true;
			}

			$.when( _getTimelineAsync( device ) )
			.done( function( timeline ) {
				_updateDevice( device, timeline );
			} );

			return '<div class="panel-content">'
				+		'<div>'
				+			'<button class="btn btn-default altui-rule-rulesbutton" onclick="javascript:ALTUI_RulesEngine.pageRules(\'' + device.altuiid + '\');">' + _T( "Rules" ) + '</button>'
				+			'<button class="btn btn-default altui-rule-timelinebutton" onclick="javascript:ALTUI_RulesEngine.pageTimeline(\'' + device.altuiid + '\');">' + _T( "Timeline" ) + '</button>'
				+		'</div>'
				+		'<div class="info"></div>'
				+	'</div>';
		},

		drawControlPanel: function( device, domparent ) {
			//_pageRules( device.altuiid );
		},

		onDeviceStatusChanged: _onDeviceStatusChanged,

		pageRules: _pageRules,
		pageRuleEdit: _pageRuleEdit,
		validateBlocklyChanges: _validateBlocklyChanges,
		pageTimeline: _pageTimeline,

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
