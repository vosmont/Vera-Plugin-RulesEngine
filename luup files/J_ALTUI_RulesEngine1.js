//# sourceURL=J_ALTUI_RulesEngine1.js
"use strict";

/**
 * This file is part of the plugin RulesEngine.
 * https://github.com/vosmont/Vera-Plugin-RulesEngine
 * Copyright (c) 2016 Vincent OSMONT
 * This code is released under the MIT License, see LICENSE.
 */

var ALTUI_RulesEngine = ( function( window, undefined ) {  

	var _location = window.location.pathname.replace( "/data_request", "" ) + "/";
	var _resourceLoaded = {};
	var _settings = {};
	var _registerIsDone = false;
	var _rulesInfos = {};
	var _altuiid, _version, _debugMode;
	var _lastUpdate = 0;

	var htmlControlPanel = '\
<div id="rulesengine-blockly-panel">\
	<xml id="rulesengine-blockly-toolbox" style="display: none"></xml>\
	<div id="rulesengine-blockly-workspace"></div>\
</div>';

	var xmlToolbox = '\
<category name="Rules" colour="140">\
	<block type="rule">\
		<value name="name">\
			<block type="text"><field name="TEXT"></field></block>\
		</value>\
		<value name="description">\
			<block type="text_area"><field name="TEXT"></field></block>\
		</value>\
		<value name="properties">\
			<block type="property_room"></block>\
		</value>\
		<value name="conditions">\
			<block type="list_with_operator_condition">\
				<mutation items="2"></mutation>\
				<field name="operator">OR</field>\
			</block>\
		</value>\
	</block>\
</category>\
<category name="Properties" colour="160">\
	<block type="list_property"></block>\
	<block type="property_auto_untrip"></block>\
	<block type="property_is_acknowledgeable"></block>\
	<block type="property_room"></block>\
</category>\
<sep></sep>\
<category name="Device" colour="320">\
	<block type="list_device"></block>\
	<block type="device"><mutation inputs="id,room"></mutation><field name="roomId"></field></block>\
</category>\
<sep></sep>\
<category name="Conditions" colour="40">\
	<category name="List">\
		<block type="list_with_operators_condition"></block>\
		<block type="list_with_operator_condition"></block>\
	</category>\
	<category name="Sequence">\
		<block type="condition_sequence"></block>\
		<block type="condition_sequence_separator"></block>\
		<block type="condition_sequence_item"></block>\
	</category>\
	<category name="Type">\
		<block type="condition_value"><mutation condition_type="event"></mutation></block>\
		<block type="condition_value"></block>\
		<!--\
		<category name="Templates">\
			<block type="condition_value"><mutation condition_type="sensor_armed"></mutation></block>\
			<block type="condition_value"><mutation condition_type="sensor_tripped"></mutation></block>\
			<block type="condition_value"><mutation condition_type="sensor_temperature"></mutation></block>\
			<block type="condition_value"><mutation condition_type="sensor_brightness"></mutation></block>\
			<block type="condition_value"><mutation condition_type="switch"></mutation></block>\
		</category>\
		-->\
		<block type="condition_time"></block>\
		<block type="condition_rule"></block>\
	</category>\
	<category name="Param">\
		<block type="list_condition_param"></block>\
		<block type="condition_param_level"></block>\
		<block type="condition_param_since"></block>\
	</category>\
</category>\
<category name="Actions" colour="240">\
	<category name="For rule">\
		<block type="action_group"></block>\
	</category>\
	<category name="For condition">\
		<block type="condition_action_group"></block>\
	</category>\
	<category name="Type">\
		<block type="action_wait"></block>\
		<block type="action_function"></block>\
		<block type="action_device"></block>\
		<category name="Templates">\
			<block type="action_device"><mutation action_type="switch"></mutation></block>\
			<block type="action_device"><mutation action_type="dim"></mutation></block>\
		</category>\
		<block type="action_scene"></block>\
	</category>\
	<category name="Param">\
		<block type="list_action_param"></block>\
		<block type="action_param_level"></block>\
		<block type="action_param_delay"></block>\
		<block type="action_param_critical"></block>\
	</category>\
</category>\
<sep></sep>\
<category name="Values">\
	<block type="text"></block>\
	<block type="text_area"></block>\
	<block type="math_number"></block>\
</category>\
';

	// return styles needed by this plugin module
	function _getStyle() {
		var style = '\
div.altui-rule-icon { width: 60px; height: 60px; }\
div.altui-rule-disabled { cursor: auto; background: url("http://vosmont.github.io/icons/virtual_alarm_panel_disabled.png")}\
div.altui-rule-ko { cursor: auto; background: url("http://vosmont.github.io/icons/virtual_alarm_panel_ko.png")}\
div.altui-rule-inactive { cursor: auto; background: url("http://vosmont.github.io/icons/virtual_alarm_panel_off.png")}\
div.altui-rule-active { cursor: pointer; background: url("http://vosmont.github.io/icons/virtual_alarm_panel_on.png")}\
div.altui-rule-acknowledged { cursor: pointer; background: url("http://vosmont.github.io/icons/virtual_alarm_panel_on_acknoledge.png")}\
.altui-rule-toolbar { margin:5px 15px;  }\
.altui-rule-arm { padding-right: 3px; cursor: pointer; } \
.altui-rule-ack { padding-right: 3px; cursor: pointer; } \
.altui-rule-warning { color:orange; } \
.altui-rule-errors { cursor:pointer; } \
.altui-rule-title-name { margin-left:5px; }\
.altui-rule-body table { width:100%; }\
.altui-rule-body .altui-rule-summary { vertical-align:top; text-align:right; }\
.altui-rule-body .altui-rule-infos { margin-left:5px; }\
.altui-rule-body .altui-rule-errors { color:red; font-size:0.8em; }\
.altui-rule-xml .panel-body { padding: 0px; }\
.altui-rule-xml-content { width: 100%; height: 200px; }\
#rulesengine-blockly-panel {  }\
#rulesengine-blockly-workspace { width: 100%; height: 2000px; }\
div.blocklyWidgetDiv { z-index: 1050; }\
#blocklyArea { height: 100%; }\
#rulesengine-lua-editor { height: 200px; } \
		';
		return style;
	}

	function _convertTimestampToLocaleString( timestamp ) {
		if ( typeof( timestamp ) === "undefined" ) {
			return "";
		}
		var t = new Date( parseInt( timestamp, 10 ) * 1000 );
		var localeString = t.toLocaleString();
		return localeString;
	}

	function _onDeviceStatusChanged( event, device ) {
		if ( !device ) {
			return;
		}
		if ( device.device_type === "urn:schemas-upnp-org:device:RulesEngine:1" ) {
			// Seems to be called at each change in the system, not just our device
			for ( var i = 0; i < device.states.length; i++ ) {
//console.log("onDeviceStatusChanged", device.states[ i ].variable, device.states[ i ].value);
				if ( device.states[ i ].variable === "LastUpdate" ) {
					if ( _lastUpdate !== device.states[ i ].value ) {
						_lastUpdate = device.states[ i ].value;
						if ( $( "#rulesengine-blockly-workspace" ).length > 0 ) {
							// Update the rule currently displayed (readonly mode)
							var ruleId = $( "#rulesengine-blockly-workspace" ).data( "rule_id" );
							if ( $( "#rulesengine-blockly-workspace" ).data( "read_only" ) ) {
								$.when( _getRulesInfosAsync( device, { "ruleId": ruleId } ) )
									.done( function( rulesInfos ) {
										_updateViewPageRule( rulesInfos, ruleId );
									} );
							}
						} else {
							// Update the page of the rules
							$.when( _getRulesInfosAsync( device ) )
								.done( function( rulesInfos ) {
									_updatePageRules( device, rulesInfos );
								} );
						}
					}
				} else if ( device.states[ i ].variable === "RulePanel" ) {
					//_updatePanel( device, device.states[ i ].value );
				}
			}
		}
	}

	function _init( device ) {
		_version = MultiBox.getStatus( device, "urn:upnp-org:serviceId:RulesEngine1", "PluginVersion" );
		_debugMode = MultiBox.getStatus( device, "urn:upnp-org:serviceId:RulesEngine1", "Debug" );
	}

	// *************************************************************************************************
	// Load informations from Backend
	// *************************************************************************************************

	function _getTimelineAsync( device, params ) {
		// seul un device répond via le handler : que se passe-t-il si plusieurs device se sont enregistrés ?
		var d = $.Deferred();
		var params = params || {};
		var url = window.location.pathname + "?id=lr_RulesEngine&command=getTimeline"
				+ ( params.fileName !== undefined ? "&ruleFileName=" + params.fileName : "" )
				+ ( params.ruleIdx !== undefined ? "&ruleIdx=" + params.ruleIdx : "" )
				+ ( params.ruleId !== undefined ? "&ruleId=" + params.ruleId : "" )
				+ "&output_format=json#";
		$.when(
			$.ajax( {
				url: url,
				dataType: "json"
			} )
		)
			.done( function( timeLine ) {
				if ( $.isPlainObject( timeLine ) ) {
					d.resolve( timeLine );
				} else {
					PageMessage.message( "No timeline", "warning" );
					d.reject();
				}
			} )
			.fail( function( jqxhr, textStatus, errorThrown ) {
				PageMessage.message( "Get timeline error : " + errorThrown, "warning" );
				d.reject();
			} );
		return d.promise();
	}

	function _getRulesInfosAsync( device, params ) {
		var d = $.Deferred();
		var params = params || {};
		var url = window.location.pathname + "?id=lr_RulesEngine&command=getRulesInfos"
				+ ( params.fileName ? "&ruleFileName=" + params.fileName : "" )
				+ ( params.ruleIdx ? "&ruleIdx=" + params.ruleIdx : "" )
				+ ( params.ruleId ? "&ruleId=" + params.ruleId : "" )
				+ "&output_format=json#";
		$.when(
			$.ajax( {
				url: url,
				dataType: "json"
			} )
		)
			.done( function( rulesInfos ) {
				if ( $.isArray( rulesInfos ) ) {
					_rulesInfos = rulesInfos;
					d.resolve( rulesInfos );
				} else {
					PageMessage.message( "No rulesInfos", "warning" );
					d.reject();
				}
			} )
			.fail( function( jqxhr, textStatus, errorThrown ) {
				PageMessage.message( "Get rulesInfos error : " + errorThrown, "warning" );
				d.reject();
			} );
		return d.promise();
	}

	function _getRulesAsync( device ) {
		var d = $.Deferred();
		$.when(
			$.ajax( {
				url: window.location.pathname + "?id=lr_RulesEngine&command=ISS&path=/devices#",
				dataType: "json"
			} )
		)
			.done( function( response ) {
				if ( $.isPlainObject( response ) && $.isArray( response.devices ) ) {
					d.resolve( response.devices );
				} else {
					PageMessage.message( "No rules", "warning" );
					d.reject();
				}
			} )
			.fail( function( jqxhr, textStatus, errorThrown ) {
				PageMessage.message( "Get rules error : " + errorThrown, "warning" );
				d.reject();
			} );
		return d.promise();
	}

	function _getRules() {
		var rules = [];
		$.each( _rulesInfos, function( i, ruleInfos ) {
			rules.push( { "id": ruleInfos.id, "name": ruleInfos.name } );
		} );
		return rules;
	}

	function _getRooms() {
		var result = [];
		var deviceController = MultiBox.controllerOf( _altuiid ).controller;
		MultiBox.getRooms( null, function( room, idx ) {
			return ( MultiBox.controllerOf( room.altuiid ).controller == deviceController );
		}, function( rooms ) {
			if ( rooms ) {
				$.each( rooms, function( idx, room ) {
					result.push( { "id": room.id, "name": room.name } );
				} );
			}
		} );
		return result;
	}

	function _getScenes() {
		var scenes = [];
		$.each( jsonp.ud.scenes, function( i, scene ) {
			var room = ( scene.room ? api.getRoomObject( scene.room ) : null );
			scenes.push( {
				"id": scene.id,
				"roomName": ( room ? room.name : "_No room" ),
				"name": scene.name
			} );
		} );
		return scenes;
	}

	function _updateDevice( device, timeline ) {
		var nodePath = ".altui-device[data-altuiid='" + device.altuiid + "'] .panel-content .info";
		if ( $.isArray( timeline.scheduled ) && timeline.scheduled.length > 0 ) {
			var nextSchedule = timeline.scheduled[ 0 ];
			$( nodePath ).html( "<div>Next schedule: " + _convertTimestampToLocaleString( nextSchedule.timestamp ) + "</div>" );
		} else {
			$( nodePath ).html( "<div>No scheduled task</div>" );
		}
	}

	function _updatePanel( device, htmlPanel ) {
		$( ".altui-device[data-altuiid='" + device.altuiid + "'] .panel-content .altui-rule-panel" )
			.html( htmlPanel );
			
			
		$( ".altui-device[data-altuiid='" + device.altuiid + "'] div.altui-device-body" )
			.css( "height", "auto");
	}

	function _loadResourcesAsync( fileNames ) {
		var d = $.Deferred();
		// Prepare loaders
		var loaders = [];
		$.each( fileNames, function( index, fileName ) {
			if ( !_resourceLoaded[ fileName ] ) {
				loaders.push(
					$.ajax( {
						url: (fileName.indexOf( "http" ) === 0 ? fileName: _location + fileName),
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
			.done( function( xml, textStatus, jqxhr ) {
				if (loaders.length === 1) {
					_resourceLoaded[ jqxhr.fileName ] = true;
				} else if (loaders.length > 1) {
					// arguments : [ [ xml, textStatus, jqxhr ], ... ]
					for (var i = 0; i < arguments.length; i++) {
						jqxhr = arguments[ i ][ 2 ];
						_resourceLoaded[ jqxhr.fileName ] = true;
					}
				}
				d.resolve();
			} )
			.fail( function( jqxhr, textStatus, errorThrown  ) {
				PageMessage.message( "Load \"" + jqxhr.fileName + "\" : " + textStatus + " - " + errorThrown, "danger");
				d.reject();
			} );
		return d.promise();
	}

	// *************************************************************************************************
	// XML rule file management
	// *************************************************************************************************

	function _encodeCarriageReturns( xmlRules ) {
		$( xmlRules ).find( "field" )
			.each( function( i, field ) {
				var text = $( this ).text().trim().replace( /[\n\r]/g, "\\\\n");
				//console.log($( this ).text(), text);
				$( this ).text( text );
			} );
	}
	function _decodeCarriageReturns( xmlRules ) {
		$( xmlRules ).find( "field" )
			.each( function( i, field ) {
				var text = $( this ).text().trim().replace( /\\\\n/g, "\n");
				//console.log($( this ).text(), text);
				$( this ).text( text );
			} );
	}
	function _cleanXML( node ) {
		for(var n = 0; n < node.childNodes.length; n ++) {
			var child = node.childNodes[n];
			if (
				child.nodeType === 8 
				|| 
				(child.nodeType === 3 && !/\S/.test(child.nodeValue))
			) {
				node.removeChild(child);
				n --;
			} else if(child.nodeType === 1) {
				_cleanXML(child);
			}
		}
	}

	function _loadRulesAsync( device, fileName ) {
		var d = $.Deferred();
		$.ajax( {
			url: _location + fileName,
			dataType: "xml"
		} )
		.done( function( xml, textStatus, jqxhr ) {
			var xmlRules = $( xml ).find( "block[type=\"rule\"]" );
			_decodeCarriageReturns( xmlRules );
			d.resolve( xmlRules );
		} )
		.fail( function( jqxhr, textStatus, errorThrown  ) {
			PageMessage.message( "Load \"" + fileName + "\" : " + textStatus + " - " + errorThrown, "danger");
			d.reject();
		} );
		return d.promise();
	}

	function _getCgiUrl() {
		var protocol = document.location.protocol;
		var host = document.location.hostname;
		var httpPort = document.location.port;
		var pathName = window.location.pathname;
		var cgiUrl = protocol + "//" + host;
		if (httpPort !== "") {
			cgiUrl = cgiUrl + ":" + httpPort;
		}

		if ( pathName.indexOf( "/port_3480" ) !== -1 ) {
			// Relay mode
			pathName = pathName.replace( "/port_3480", "" );
		}
		cgiUrl = cgiUrl + pathName.replace( "/data_request", "" ) + "/cgi-bin/cmh";
		return cgiUrl;
	}

	function _saveRulesFileAsync( fileName, xmlRules ) {
		var d = $.Deferred();

		var xmlRoot = $.parseXML( '<xml xmlns="http://www.w3.org/1999/xhtml"></xml>' );
		var $xml = $( xmlRoot ).children(0);
		_encodeCarriageReturns( xmlRules );
		xmlRules.each( function( idx, xmlRule ) {
			$xml.append( xmlRule );
		} );
		// Clean the XML file (domToPrettyText adds some text between nodes)
		_cleanXML( xmlRoot );
		var content = Blockly.Xml.domToPrettyText( xmlRoot );
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
				d.reject();
			}
		} )
		.fail( function( jqxhr, textStatus, errorThrown ) {
			PageMessage.message( "Save \"" + fileName + "\" : " + textStatus + " - " + (errorThrown || "unknown"), "danger");
			_exportXml( xmlRoot ); 
			PageMessage.message( "Modified XML file has been exported. You have to upload it on the Vera by hand.", "warning");
			d.reject();
		} );

		return d.promise();
	}

	function _checkXmlRulesIds( xmlRules, rulesInfos ) {
		if ( xmlRules.length !== rulesInfos.length ) {
			PageMessage.message( "Desynchronization : expected " + rulesInfos.length + " rule(s) and found " + xmlRules.length + " in the xml file", "warning");
		}
		// Sort the rulesInfos by idx
		rulesInfos.sort( function( a,b ) { return a.idx - b.idx; } );
		xmlRules.each( function( idx, xmlRule ) {
			if ( idx >= rulesInfos.length ) {
				return;
			}
			var ruleInfos = rulesInfos[ idx ];
			if ((ruleInfos.idx - 1) !== idx) {
				PageMessage.message( "Desynchronization: rule at position " + idx + " in the xml file does not correspond to the former known rule #" + ruleInfos.id + ". You should not save.", "warning");
			}
			var xmlRuleId = parseInt( $( xmlRule ).children( "field[name=\"id\"]:first" ).text(), 10);
			var xmlRuleName = $( xmlRule ).children( "value[name=\"name\"]:first" ).text().trim();
			if ( xmlRuleId != null ) {
				if ( xmlRuleId !== ruleInfos.id ) {
					PageMessage.message( "Desynchronization: id #" + xmlRuleId + " of the rule at position " + idx + " in the xml file is not the expected id #" + ruleInfos.id + ". You should not save.", "warning");
				}
				if ( xmlRuleName !== ruleInfos.name ) {
					PageMessage.message( "Desynchronization: name '" + xmlRuleName + "' of the rule at position " + idx + " in the xml file is not the expected name '" + ruleInfos.name + "'. You should not save.", "warning");
				}
			} else {
				// DEPRECATED : the id of the rule is know written by the back
				/*
				// The rule has not an id; add it (calculated by the LUA part of the plugin)
				if ( xmlRuleName !== ruleInfos.name ) {
					PageMessage.message( "Desynchronization: name '" + xmlRuleName + "' of the rule at position " + idx + " in the xml file is not the expected name '" + ruleInfos.name + "'. You should not save.", "warning");
				} else {
					$( xmlRule ).children( "field[name=\"id\"]" ).remove();
					$( xmlRule ).append( '<field name="id">' + ruleInfos.id + '</field>' );
				}
				*/
				PageMessage.message( "Desynchronization: rule at position " + idx + " in the xml file has no id. You should not save.", "warning");
			}
		} );
	}

	// *************************************************************************************************
	// Blockly UI
	// *************************************************************************************************

	function _loadBlocklyResourcesAsync( device ) {
		// Get the names of the resource files
		var fileNames = [
			"J_RulesEngine1_Blockly.js"
		];
		var toolboxConfig = MultiBox.getStatus( device, "urn:upnp-org:serviceId:RulesEngine1", "ToolboxConfig" );
		if ( ( toolboxConfig !== undefined ) && ( toolboxConfig !== "" ) ) {
			toolboxConfig = $.parseJSON( toolboxConfig );
			$.each( toolboxConfig, function( index, config ) {
				if ( $.inArray( config.resource, fileNames ) === -1 ) {
					fileNames.push( config.resource );
				}
			} );
		}
		return _loadResourcesAsync( fileNames );
	}

	function _scrollBlocklyToolbox() {
		var blocklyPanel = $( "#rulesengine-blockly-panel" );
		if ( blocklyPanel.length === 0 ) {
			$( window ).off( "scroll", _scrollBlocklyToolbox );
			return;
		}
		var navbarHeight = $(".navbar-fixed-top").height();
		var blocklyPanelTop = blocklyPanel.offset().top;
		if ( blocklyPanelTop - ( $(window).scrollTop() + navbarHeight ) <= 0 ) {
			$( ".blocklyToolboxDiv" ).css( { "position": "fixed", "top": "50px" } );
		} else {
			$( ".blocklyToolboxDiv" ).css( { "position": "", "top": blocklyPanelTop + "px !important" } );
		}
	}

	function _drawBlocklyPanel( device, readOnly ) {
		var toolboxConfig = MultiBox.getStatus( device, "urn:upnp-org:serviceId:RulesEngine1", "ToolboxConfig" );
		if ( ( toolboxConfig !== undefined ) && ( toolboxConfig !== "" ) ) {
			try {
				toolboxConfig = $.parseJSON( toolboxConfig );
			} catch( err ) {
				PageMessage.message( "ToolboxConfig parse error : " + err, "danger");
			}
		} else {
			toolboxConfig = [];
		}
		// Blockly toolbox
		$( "#rulesengine-blockly-toolbox ").html( xmlToolbox );
		// Add custom config
		$.each( toolboxConfig, function( index, config ) {
			var path = "";
			var categories = config.category.split( "," );
			$.each( categories, function( index, category ) {
				path += ( index > 0 ? " " : "" ) + "category[name=\"" + category + "\"]";
			} );
			$( "#rulesengine-blockly-toolbox" ).find( path )
				.append( "<block type=\"" + config.type + "\"></block>" );
		} );

		// Blockly workspace
		var blocklyWorkspace = document.getElementById( "rulesengine-blockly-workspace" );
		Blockly.inject( blocklyWorkspace, {
			//media: './media/',
			toolbox: ( readOnly === true ? null : document.getElementById( "rulesengine-blockly-toolbox" ) ),
			grid: {
				spacing: 20,
				length: 3,
				colour: '#ccc',
				snap: true
			},
			readOnly: ( readOnly === true ),
			sounds: false,
			trashcan: true,
			zoom: {
				controls: true
			}
		});

		// Controller of the Rules Engine (the engine can just control devices that are on the same controller)
		$( "#rulesengine-blockly-workspace" )
			.data( "controller_id", MultiBox.controllerOf( device.altuiid ).controller )
			.data( "read_only", readOnly );

		if ( readOnly !== true ) {
			//$( window ).on( "scroll", _scrollBlocklyToolbox );
			//$( window ).on( "resize", function() { console.info("resize") } );
		}
	}

	function _watchBlocklyChanges( device ) {
		var workspace = Blockly.getMainWorkspace();
		var _isFirstCall = true;
		$( workspace.getCanvas() ).on( "blocklyWorkspaceChange", function( event ) {
			if (!_isFirstCall) {
				$( ".altui-rule-confirm" ).removeClass( "btn-default" ).removeClass( "disabled" ).addClass( "btn-danger" );
				$( workspace.getCanvas() ).off( "blocklyWorkspaceChange" );
			}
			_isFirstCall = false;
		} );
	}

	function _showLuaEditor( code, callback ) {
		var dialog =  DialogManager.registerDialog(
			"luaCodeEditorModal",
			defaultDialogModalTemplate.format( 
				"luaCodeEditorModal",
				_T( "Lua Editor" ),
				"",				// body
				"modal-lg"		// size
			)
		);
		dialog.modal();

		$.when( _loadResourcesAsync( [ "https://cdnjs.cloudflare.com/ajax/libs/ace/1.2.2/ace.js" ] ) )
			.done( function() {
				var html = '<div id="rulesengine-lua-editor">' + code + '</div>'; // TODO : escape
				$( dialog ).find( ".row-fluid" ).append( html );
				// ACE - https://ace.c9.io/
				var editor = ace.edit( "rulesengine-lua-editor" );
				//editor.setTheme( "ace/theme/monokai" );
				editor.setTheme( "ace/theme/" + ( MyLocalStorage.getSettings("EditorTheme") || "monokai" ) );
				editor.setFontSize( MyLocalStorage.getSettings("EditorFontSize") || 12 );
				editor.getSession().setMode( "ace/mode/lua" );
				// resize
				$( "div#rulesengine-lua-editor" ).resizable({
					stop: function( event, ui ) {
						editor.resize();
					}
				});
				DialogManager.dlgAddDialogButton( dialog, true, _T( "Save Changes" ), "altui-luacode-save", { "data-dismiss": "modal" } );
				dialog
					.on( "click touchend", ".altui-luacode-save", function() {
						var code = editor.getValue();
						if ( $.isFunction( callback ) ) {
							callback( code );
						}
					} );
			} );

		//editor.resize();
	}

	function _moveFirstBlocklyBlockToTopLeftCorner() {
		var workspace = Blockly.getMainWorkspace();
		var topBlocks = workspace.getTopBlocks( true );
		if ( !topBlocks || ( topBlocks.length === 0 ) ) {
			return;
		}
		var coords = topBlocks[ 0 ].getRelativeToSurfaceXY();
		topBlocks[ 0 ].moveBy( 10 - coords.x, 10 - coords.y );
	}

	var _indexBlocklyConditionBlocks = {}
	function _clearIndexBlocklyConditionBlocks() {
		_indexBlocklyConditionBlocks = {};
	}
	function _updateIndexBlocklyConditionBlocks() {
		_indexBlocklyConditionBlocks = {};
		var workspace = Blockly.getMainWorkspace();
		var topBlocks = workspace.getTopBlocks( true );
		if ( !topBlocks || ( topBlocks.length === 0 ) ) {
			return;
		}

		function _putConditionInIndex( condition, parentId, idx ) {
			if ( !condition ) {
				return;
			}
			var id = parentId.toString() + "." + idx.toString();
			_indexBlocklyConditionBlocks[ id ] = condition;
			var input;
			switch( condition.type ) {
				case "list_with_operators_condition":
				case "list_with_operator_condition":
					var i = 0;
					while ( input = condition.getInput( "ADD" + i ) ) {
						var connection = input && input.connection;
						var subCondition = connection && connection.targetBlock();
						_putConditionInIndex( subCondition, id, ( i + 1 ) );
						i++;
					}
					break;
				case "condition_value":
					var device = condition.getInput( "condition" );
					break;
				case "condition_sequence":
					var subCondition = condition.getInputTargetBlock( "items" );
					var idx = 1;
					while ( subCondition ) {
						_putConditionInIndex( subCondition, id, idx );
						subCondition = subCondition.nextConnection && subCondition.nextConnection.targetBlock();
						idx++;
					}
					break;
				case "condition_sequence_item":
					var input = condition.getInput( "condition" );
					var connection = input && input.connection;
					var subCondition = connection && connection.targetBlock();
					_putConditionInIndex( subCondition, id, 1 );
					break;
				default:
			}
		}

		var ruleBlock = topBlocks[ 0 ];
		var ruleId = ruleBlock.getFieldValue( "id" );
		_indexBlocklyConditionBlocks[ ruleId.toString() ] = ruleBlock;
		var input = ruleBlock.getInput( "condition" );
		var connection = input && input.connection;
		var condition = connection && connection.targetBlock();
		_putConditionInIndex( condition, ruleId, 1 );
	}

	function _getBlocklyConditionBlock( conditionId ) {
		return _indexBlocklyConditionBlocks[ conditionId.toString() ];
	}

	// *************************************************************************************************
	// Main panel of rules
	// *************************************************************************************************

	function _updatePageRules( device, rulesInfos ) {
		if ( $( ".altui-rules" ).length === 0 ) {
			return;
		}
		var status = MultiBox.getStatus( device, "urn:upnp-org:serviceId:SwitchPower1", "Status" );
		$.each( rulesInfos, function( i, ruleInfos ) {
			//var $rule = $( '.altui-mainpanel .altui-rule[data-ruleid="' + ruleInfos.id + '"][data-ruleidx="' + ruleInfos.idx + '"]' );
			var $rule = $( '.altui-mainpanel .altui-rule[data-rulefileName="' + ruleInfos.fileName + '"][data-ruleid="' + ruleInfos.id + '"][data-ruleidx="' + ruleInfos.idx + '"]' );
			// Icon status
			var $icon = $rule.find( ".altui-rule-icon" );
			$icon
				.toggleClass( "altui-rule-disabled", ( ruleInfos.status === -2 ) )
				.toggleClass( "altui-rule-ko", ( ruleInfos.status === -1 ) )
				.toggleClass( "altui-rule-inactive", ( ruleInfos.status === 0 ) )
				.toggleClass( "altui-rule-active", ( ( ruleInfos.status === 1 ) && !ruleInfos.isAcknowledged ) )
				.toggleClass( "altui-rule-acknowledged", ( ( ruleInfos.status === 1 ) && ruleInfos.isAcknowledged ) );
			// Enable / disable
			$rule.find( ".altui-rule-arm" )
				.toggleClass( "activated", ( ( ruleInfos.status !== -1 ) && ruleInfos.isArmed ) )
				.toggleClass( "paused",   ( ( ruleInfos.status !== -1 ) && !ruleInfos.isArmed ) )
				.toggleClass( "altui-rule-warning", ( ruleInfos.status === -1 ) )
				.attr( "title", ( ruleInfos.status === -1 ? "Rule KO" : ( ruleInfos.isArmed ? _T( "Disarm rule" ) : _T( "Arm rule" ) ) ) );
			// Set acknowledgement
			$rule.find( ".altui-rule-ack" )
				.toggleClass( "activated", ( ( ruleInfos.status !== -1 ) && ruleInfos.isAcknowledged ) )
				//.toggleClass( "paused",   ( ( ruleInfos.status !== -1 ) && !ruleInfos.isAcknowledged ) )
				.attr( "title", ( ruleInfos.status === -1 ? "Rule KO" : ( ruleInfos.isAcknowledged ? _T( "Disacknowledge rule" ) : _T( "Acknowledge rule" ) ) ) );
			// Infos
			var statusText = {
				"1": "ON",
				"0": "OFF",
				"-1": "KO",
				"-2": "Disabled"
			};
			var html = "";
			if ( ruleInfos.hasError ) {
				html += '<span class="glyphicon glyphicon-alert altui-rule-errors" aria-hidden="true" title="' + _T( "See rule's errors") + '"></span> ';
			}
			html += ( status == "0" ? "engine stopped" : statusText[ ruleInfos.status.toString() ] || "UNKNOWN" ) 
				+ ( ruleInfos.lastStatusUpdate > 0 ? _T( " since " ) + _convertTimestampToLocaleString( ruleInfos.lastStatusUpdate ) : "");
			$rule.find( ".altui-rule-infos" ).html( html );
		} );
	}

	function _getRuleParamsFromObject( object ) {
		var $rule = $( object ).parents( ".altui-rule" );
		return {
			altuiid : $rule.data( "altuiid" ),
			fileName: $rule.data( "rulefilename" ),
			ruleIdx : parseInt( $rule.data( "ruleidx" ), 10 ),
			ruleId  : $rule.data( "ruleid" ),
			ruleName: $rule.find( ".altui-rule-title-name" ).text()
		};
	}

	function _showRuleErrors() {
		var params = _getRuleParamsFromObject( this );
		var device = MultiBox.getDeviceByAltuiID( params.altuiid );
		var dialog = DialogManager.registerDialog(
			"ruleErrorsModal",
			defaultDialogModalTemplate.format(
				"ruleErrorsModal",
				_T( "Rule" ) + " #" + params.ruleId + "(" + params.ruleName + ")",
				"",
				"modal-lg"
			)
		);
		$.ajax( {
			url: window.location.pathname + "?id=lr_RulesEngine&command=getErrors&type=RuleError&ruleId=" + params.ruleId + "&output_format=json#",
			dataType: "json"
		} )
		.done( function( errors ) {
			if ( $.isArray( errors ) && ( errors.length > 0 ) ) {
				var html = '<div class="panel panel-default">'
					+			'<small><table class="table">'
					+				'<thead>'
					+					('<tr><th>{0}</th><th>{1}</th></tr>'.format( _T( "Date" ), _T( "Error" ) ) )
					+				'</thead>'
					+				'<tbody>';
				$.each( errors, function( i, error ) {
					html +=				'<tr><td>{0}</td><td>{1}</td></tr>'.format( _convertTimestampToLocaleString( error.timestamp ), error.event );
				});
				html +=				'</tbody>'
					+			'</table></small>'
					+		'</div>';
				dialog.find( ".row-fluid" ).append(html);
				dialog.modal();
			}
		} );
	}

	function _showRuleTimeline() {
		var params = _getRuleParamsFromObject( this );
		var device = MultiBox.getDeviceByAltuiID( params.altuiid );
		var dialog = DialogManager.registerDialog(
			"ruleTimelineModal",
			defaultDialogModalTemplate.format(
				"ruleTimelineModal",
				_T( "Rule" ) + " #" + params.ruleId + "(" + params.ruleName + ")",
				"",
				"modal-lg"
			)
		);
		$.when( _getTimelineAsync( device, params ) )
			.done( function( timeline ) {

				var html = '<div class="panel panel-default">'
					+			'<small><table class="table">'
					+				'<thead>'
					+					('<tr><th>{0}</th><th>{1}</th><th>{2}</th></tr>'.format( _T( "Date" ), _T( "Type" ), _T( "Event" ) ) )
					+				'</thead>'
					+				'<tbody>';
				$.each( timeline.history, function( i, e ) {
					html +=				'<tr><td>{0}</td><td>{1}</td><td>{2}</td></tr>'.format( _convertTimestampToLocaleString( e.timestamp ), e.eventType, e.event);
				});
				html +=				'</tbody>'
					+			'</table></small>'
					+		'</div>';

				dialog.find( ".row-fluid" ).append(html);
				dialog.modal();
			} );
	}

	function _isRuleMatching( ruleInfos, filters ) {
		var isMatching = true;
		if ( filters == null ) {
			return true;
		}
		if ( filters.room ) {
			switch( filters.room ) {
				case "-1":
					break;
				case "-2":
					if ( !ruleInfos.isFavorite ) {
						isMatching = false;
					}
					break;
				default:
					if ( $.isArray( filters.room ) ) {
						if ( filters.room.length === 0 ) {
							break;
						}
						if ( ruleInfos.roomId == 0 ) {
							if ( filters.room.indexOf( "0" ) === -1 ) {
								isMatching = false;
							}
						} else if ( filters.room.indexOf( "0-" + ruleInfos.roomId ) === -1 ) {
							isMatching = false;
						}
					}
			}
		}
		return isMatching;
	}

	function _drawRules( device, filters ) {
		$.when( _getRulesInfosAsync( device ) )
			.done( function( rulesInfos ) {
				// Sort by rule name
				rulesInfos.sort( function( a, b ) {
					if ( a.name < b.name ) {
						return -1;
					} else if ( a.name > b.name ) {
						return 1;
					}
					return 0;
				} );
				$(".altui-mainpanel .altui-rules").empty();
				$.each( rulesInfos, function( idx, ruleInfos) {
					if ( !_isRuleMatching( ruleInfos, filters ) ) {
						return;
					}
					var infoVersion = ( !ruleInfos.version ? "EDIT THIS RULE" : ( ruleInfos.version !== _version ? " (v" + ruleInfos.version + ")": "") );
					$(".altui-mainpanel .altui-rules").append(
							'<div class="col-sm-6 col-md-4 col-lg-3">'
						+		'<div class="panel panel-default altui-rule" data-altuiid="' + device.altuiid + '"'
						+				' data-ruleid="' + ruleInfos.id + '"'
						+				' data-ruleidx="' + ruleInfos.idx + '"'
						+				' data-rulefilename="' + ruleInfos.fileName + '"'
						+				' data-ruleacknowledgeable="' + ruleInfos.isAcknowledgeable + '"'
						+				' data-ruleacknowledged="0"'
						+			'>'
						+			'<div class="panel-heading altui-device-heading">'
						+				'<button type="button" class="altui-rule-remove pull-right btn btn-default btn-xs" title="' + _T( "Remove" ) + '">'
						+					'<span class="glyphicon glyphicon-trash text-danger"></span>'
						+				'</button>'
						+				'<div class="pull-right text-muted"><small>#' + ruleInfos.id + '</small></div>'
						+				'<div class="panel-title altui-device-title" data-toggle="tooltip" data-placement="left">'
						+					'<span class="altui-rule-arm glyphicon glyphicon-off" aria-hidden="true"></span>'
						+					'<small class="altui-rule-title-name">' + ruleInfos.name + '</small>'
						+				'</div>'
						+			'</div>'
						+			'<div class="panel-body altui-rule-body" title="' + _T( "View rule" ) + '">'
						
						+				'<table height="70px">'
						+					'<tr>'
						+						'<td width="25px">'
						+							'<div class="altui-device-icon altui-rule-icon pull-left img-rounded"></div>'
						+						'</td>'
						+						'<td width="25px">'
						+							'<button type="button" class="altui-rule-edit pull-left btn btn-xs btn-default" style="width: 25px;" title="' + _T( "Edit" ) + '">'
						+								'<span class="glyphicon glyphicon-pencil" aria-hidden="true"></span>'
						+							'</button>'
						+							'<button type="button" class="altui-rule-timeline pull-left btn btn-xs btn-default" style="width: 25px;" title="' + _T( "Timeline" ) + '">'
						+								'<span class="glyphicon glyphicon-calendar" aria-hidden="true"></span>'
						+							'</button>'

						+							( ruleInfos.isAcknowledgeable ?
													'<button type="button" class="altui-rule-ack pull-left btn btn-xs btn-default" style="width: 25px;">'
						+								'<span class="glyphicon glyphicon glyphicon-ok" aria-hidden="true"></span>'
						+							'</button>' : '' )

						+						'</td>'
						+						'<td class="altui-rule-summary">'
						+							'<div>'
						+								'<small class="altui-rule-infos text-muted"></small>'
						+								'<small class="">' + infoVersion + '</small>'
						+							'</div>'
						+							'<div>'

						+								( ruleInfos.lastStatusUpdateTime > 0 ?
														'<small class="">' + _convertTimestampToLocaleString( ruleInfos.lastStatusUpdateTime ) + '</small>' : '' )
						
						+							'</div>'
						+						'</td>'
						+					'</tr>'
						+				'</table>'
						+			'</div>'
						+		'</div>'
						+	'</div>'
					);
				} );
				_updatePageRules( device, rulesInfos );
			} );
	}

	function _pageRules( altuiid ) {
		if ( altuiid ) {
			_altuiid = altuiid;
		} else {
			altuiid = _altuiid;
		}
		var device = MultiBox.getDeviceByAltuiID( altuiid );
		_init( device );

		var roomAltuiid2Name = {};
		var filters = {
			room: MyLocalStorage.getSettings( "RuleRoomFilter" ) || -1
		};

		function _syncRoomNameFilter() {
			if ( $.isArray( filters.room ) ) {
				filters.roomName = [];
				$.each( filters.room, function( i, roomAltuiid ) {
					if ( roomAltuiid === "0" ) {
						filters.roomName.push( "0" );
					} else {
						filters.roomName.push( roomAltuiid2Name[ roomAltuiid ] );
					}
				} );
			} else {
				filters.roomName = filters.room;
			}
		}

		function _onClickRoomButton( htmlid, altuiid ) {
			var room = altuiid ? altuiid : htmlid;
			if ( ( room == "-2" ) || ( room == "-1" ) ) {
				filters.room = room;
			} else {
				if ( $.isArray( filters.room ) ) {
					var idx = filters.room.indexOf( room );
					if ( idx > -1 ) {
						filters.room.splice( idx, 1 );
						if ( filters.room.length === 0 ) {
							filters.room = "-1";
						}
					} else {
						// TODO : is better to multiselect the rooms ?
						//filters.room.push( room );
						filters.room = [ room ];
					}
				} else {
					filters.room = [ room ];
				}
			}
			_syncRoomNameFilter();
			UIManager.setLeftnavRoomsActive( filters.roomName );
			MyLocalStorage.setSettings( "RuleRoomFilter", filters.room );
			_drawRules( device, filters );
		};

		// Page preparation
		UIManager.clearPage( _T( "Control Panel" ), "Rules - {0} <small>#{1}</small>".format( device.name , altuiid ) );
		//UIManager.clearPage( _T( "Rules" ), "Rules - {0} <small>#{1}</small>".format( device.name , altuiid ) );
		$( "#altui-pagetitle" )
			.css( "display", "inline" )
			.after( "<div class='altui-device-toolbar'></div>" );

		// On the left, get the rooms
		$(".altui-leftnav").empty();
		UIManager.leftnavRooms(
			_onClickRoomButton,
			function( rooms ) {
				$.each( rooms, function( i, room ) {
					roomAltuiid2Name[ room.altuiid ] = room.name;
				});
				_syncRoomNameFilter();
				UIManager.setLeftnavRoomsActive( filters.roomName );
			}
		);

		// TODO : select the default xml file where to create new rules
		var fileNames = MultiBox.getStatus( device, "urn:upnp-org:serviceId:RulesEngine1", "RuleFiles" ).split( "," );
		var fileName = ( fileNames.length > 0 ) ? fileNames[ 0 ] : "C_RulesEngine_Rules.xml";

		// Draw the panel
		var html = '<div class="altui-rule-toolbar">'
			+			'<button class="btn btn-default altui-rule-create">'
			+				'<span class="glyphicon glyphicon-plus" aria-hidden="true" data-toggle="tooltip" data-placement="bottom" title="Add"></span>'
			+				_T( "Create" )
			+			'</button>'
			+	'</div>';
		// Manage the UI events
		$(".altui-mainpanel")
			.append( html )
			.on( "click", ".altui-rule-create", function() {
				_pageRuleEdit( altuiid, fileName );
			} )
			.on( "click", ".altui-rule-icon", function() {
				var params = _getRuleParamsFromObject( this );
				_pageRuleEdit( params.altuiid, params.fileName, params.ruleIdx, params.ruleId, true );
			} )
			.on( "click", ".altui-rule-edit", function( event ) {
				event.stopPropagation();
				var params = _getRuleParamsFromObject( this );
				_pageRuleEdit( params.altuiid, params.fileName, params.ruleIdx, params.ruleId );
			} )
			.on( "click", ".altui-rule-remove", function() {
				var params = _getRuleParamsFromObject( this );
				_removeRule( params.altuiid, params.fileName, params.ruleIdx, params.ruleId );
			} )
			.on( "click", ".altui-rule-arm", function() {
				var params = _getRuleParamsFromObject( this );
				if ( $( this ).hasClass( "activated" ) ) {
					MultiBox.runActionByAltuiID( params.altuiid, "urn:upnp-org:serviceId:RulesEngine1", "SetRuleArming", { ruleId: params.ruleId, arming: "0" } );
				} else if ( $( this ).hasClass( "paused" ) ) {
					MultiBox.runActionByAltuiID( params.altuiid, "urn:upnp-org:serviceId:RulesEngine1", "SetRuleArming", { ruleId: params.ruleId, arming: "1" } );
				}
			} )
			.on( "click", ".altui-rule-ack", function() {
				var params = _getRuleParamsFromObject( this );
				if ( $( this ).hasClass( "activated" ) ) {
					//$( this ).addClass("big-spinner");
					MultiBox.runActionByAltuiID( params.altuiid, "urn:upnp-org:serviceId:RulesEngine1", "SetRuleAcknowledgement", { ruleId: params.ruleId, acknowledgement: "0" } );
				} else {
					//$( this ).addClass("big-spinner");
					MultiBox.runActionByAltuiID( params.altuiid, "urn:upnp-org:serviceId:RulesEngine1", "SetRuleAcknowledgement", { ruleId: params.ruleId, acknowledgement: "1" } );
				}
			} )
			.on( "click", ".altui-rule-errors", _showRuleErrors )
			.on( "click", ".altui-rule-timeline", _showRuleTimeline );

		// Draw the rules
		$(".altui-mainpanel").append( '<div class="altui-rules"></div>' );
		if ( $( "div.altui-leftnav:visible" ).length === 1 ) {
			_drawRules( device, filters );
		} else {
			_drawRules( device );
		}
	}

	// *************************************************************************************************
	// List of rules
	// *************************************************************************************************

	function _drawRuleList( altuiid ) {
		var device = MultiBox.getDeviceByAltuiID( altuiid );
		$.when( _getRulesInfosAsync( device ) )
			.done( function( rulesInfos ) {
				var model = {
					domcontainer : $( "#rulesengine-rule-list" ),
					data : rulesInfos,
					default_viscols: [ 'id','name' ],
					cols: [ 
						{ name:'id', type:'numeric', identifier:true, width:50 },
						{ name:'fileName', type:'string', identifier:false, width:150 },
						{ name:'idx', type:'numeric', identifier:false, width:50 },
						{ name:'name', type:'string', identifier:false, width:150 }
					],
					formatters: {
						"enhancer": function(column, row) {
							return _enhanceValue(row[column.id]);
						},
					},
					commands: {
						'rulesengine-command-edit': {
							glyph:editGlyph,
							onclick: function( grid, e, row, ident ) {
								//_pageRuleEdit( altuiid, fileName, idx, id, readOnly );
								//_pageRuleEdit( altuiid, ident );
							}
						},
						'rulesengine-command-delete': {
							glyph:deleteGlyph,
							onclick: function( grid, e, row, ident ) {
								//_removeRule( altuiid, fileName, idx, id );
								/*
								var device = MultiBox.getDeviceByAltuiID(ident);
								DialogManager.confirmDialog(_T("Are you sure you want to delete device ({0})").format(ident+":"+device.name),function(result) {
									if (result==true) {
										MultiBox.deleteDevice(device);
										grid.bootgrid( "remove", [ident] );
									}
								});
								*/
							}
						},
					},
				};

				UIManager.genericTableDraw( "Rules", "dev", model );
			} );
	}

	// *************************************************************************************************
	// Timeline
	// *************************************************************************************************

	function _updateTimeline( timeline ) {
		if ( $(".altui-mainpanel .timeline").length === 0 ) {
			return;
		}
		$(".altui-mainpanel .timeline").empty();
		$(".altui-mainpanel .timeline").append( '<div> History: </div>' );
		$.each( timeline.history, function( idx, item ) {
			if ( item.eventType === "ERROR" ) {
				item.eventType = '<font color="red">' + item.eventType + '</font>';
			}
			$(".altui-mainpanel .timeline").append( '<div>' + _convertTimestampToLocaleString( item.timestamp ) + ( item.ruleId ? ' - Rule #' + item.ruleId : '' ) + ' - ' + item.eventType + ' - ' + item.event + '</div>' );
		} );
		$(".altui-mainpanel .timeline").append( '<div> Schedule: </div>' );
		$.each( timeline.scheduled, function( idx, item ) {
			$(".altui-mainpanel .timeline").append( '<div>' + _convertTimestampToLocaleString( item.timestamp ) + ' - ' + item.eventType + ' - ' + item.event + '</div>' );
		} );
	}

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
	}

	// *************************************************************************************************
	// Rule management
	// *************************************************************************************************

	function _removeRule( altuiid, fileName, idx, id ) {
		if ( idx == undefined ) {
			return false;
		}
		if ( !confirm( "Are you sure that you want to remove the rule #" + id + " ?" ) ) {
			return false;
		}
		var device = MultiBox.getDeviceByAltuiID( altuiid );
		$.when( _loadRulesAsync( device, fileName ) )
			.done( function( xmlRules ) {
				xmlRules.splice((idx - 1), 1); // Should check that id is the same
				$.when( _saveRulesFileAsync( fileName, xmlRules ) )
					.done( function() {
						// The file of rules has been uploaded without the designed rule
						// Now, inform the back that the rule does no more exist
						MultiBox.runActionByAltuiID( altuiid, "urn:upnp-org:serviceId:RulesEngine1", "RemoveRule", { fileName: fileName, ruleIdx: idx, ruleId: id } );
						window.setTimeout( _pageRules, 1000, altuiid ); // wait a little before displaying the rules
						PageMessage.message( "File \"" + fileName + "\" has been saved", "success");
					} );
			} );
		return true;
	}

	// TODO : récupérer xmlRules dans cette fonction avec _loadRulesAsync ?
	// par contre ça fait deux chargements de règles (un à l'affichage, un à la sauvegarde)
	// (permet de récupérer d'éventuels changement fait dans une autre session sur les autres règles)
	function _saveBlocklyChanges( altuiid, fileName, xmlRules, idx ) {
		/*
		function _getHashCode( str ) {
			var hash = 0;
			if ( str.length === 0 ) {
				return hash;
			}
			for ( var i = 0; i < str.length; i++ ) {
				var char = str.charCodeAt( i );
				hash = ( ( hash << 5 ) - hash ) + char;
				hash = hash & hash; // Convert to 32bit integer
			}
			return hash;
		}*/
		function _getHashCode( str ) {
			var hash = 0;
			var char;
			for ( var i = 0; i < str.length; i++ ) {
				char = str.charCodeAt( i );
				hash += char;
			}
			return hash;
		}

		// Get new or modified rules from Blockly panel
		var workspace = Blockly.getMainWorkspace();
		var $xmlBlockly = $( Blockly.Xml.workspaceToDom( workspace ) );
		var modifiedRuleIdxes = [];
		$xmlBlockly.find( "block[type=\"rule\"]" )
			.each( function( i, xmlNewRule ) {
				xmlNewRule.setAttribute( "hashcode", _getHashCode( xmlNewRule.innerHTML ) );
				xmlNewRule.setAttribute( "version", _version );
				if ( ( idx !== undefined ) && ( i === 0 ) ) {
					// the modified rule
					modifiedRuleIdxes.push( idx );
					xmlRules[ idx - 1 ] = xmlNewRule;
				} else {
					// a new rule
					xmlRules.push( xmlNewRule );
					modifiedRuleIdxes.push( xmlRules.length );
				}
			} );

		$.when( _saveRulesFileAsync( fileName, xmlRules ) )
			.done( function() {
				MultiBox.runActionByAltuiID(
					altuiid, "urn:upnp-org:serviceId:RulesEngine1", "LoadRules",
					{ fileName: fileName, ruleIdx: modifiedRuleIdxes.join( "," ) }
				);
				_pageRules( altuiid );
				PageMessage.message( "File \"" + fileName + "\" has been saved", "success");
			} );
	}

	// *************************************************************************************************
	// Viewing or editing a rule
	// *************************************************************************************************

	// Load all the action of devices (ALTUI just load them on demand)
	var _indexDeviceActionByDevice = {};
	var _indexDevicesActions = {};
	function _loadDevicesActions() {
		var d = $.Deferred();
		_indexDeviceActionByDevice = {};
		_indexDevicesActions = {};
		MultiBox.getDevices(
			null,
			null,
			function( devices ) {
				var nbRetrieved = 0;
				$.each( devices, function( i, device ) {
					if ( device && ( device.id !== 0 ) ) {
						var controller = MultiBox.controllerOf( device.altuiid ).controller;
						var devicetypesDB = MultiBox.getDeviceTypesDB( controller );
						var dt = devicetypesDB[ device.device_type ];
						if ( dt && dt.Services && ( dt.Services.length > 0 ) ) {
							MultiBox.getDeviceActions( device, function ( services ) {
								for ( var i = 0; i < services.length; i++ ) {
									var actionService = services[ i ].ServiceId;
									for ( var j = 0; j < services[ i ].Actions.length; j++ ) {
										var action = services[ i ].Actions[ j ];
										_indexDevicesActions[ actionService + ";" + action.name ] = action;
										
										if ( !_indexDeviceActionByDevice[ device.altuiid ] ) {
											_indexDeviceActionByDevice[ device.altuiid ] = { "services": {}, "actions": {} };
										}
										if ( !_indexDeviceActionByDevice[ device.altuiid ].services[ actionService ] ) {
											_indexDeviceActionByDevice[ device.altuiid ].services[ actionService ] = {};
										}
										_indexDeviceActionByDevice[ device.altuiid ].services[ actionService ][ action.name ] = true;
										if ( !_indexDeviceActionByDevice[ device.altuiid ].actions[ action.name ] ) {
											_indexDeviceActionByDevice[ device.altuiid ].actions[ action.name ] = {};
										}
										_indexDeviceActionByDevice[ device.altuiid ].actions[ action.name ][ actionService ] = true;
									}
								}
								nbRetrieved++;
								if ( nbRetrieved === devices.length ) {
									d.resolve();
								}
							} );
						} else {
							nbRetrieved++;
							if ( nbRetrieved === devices.length ) {
								d.resolve();
							}
						}
					}  else {
						nbRetrieved++;
						if ( nbRetrieved === devices.length ) {
							d.resolve();
						}
					}
				} );
			}
		);
		return d.promise();
	}
	function _hasDeviceActionService( device, actionService, actionName ) {
		var indexDeviceActions = _indexDeviceActionByDevice[ device.altuiid ];
		if ( !indexDeviceActions ) {
			return;
		}
		if ( actionService ) {
			if ( indexDeviceActions.services[ actionService ] ) {
				if ( actionName ) {
					if ( indexDeviceActions.services[ actionService ][ actionName ] ) {
						return true;
					}
				} else {
					return true;
				}
			}
		} else if ( actionName ) {
			if ( indexDeviceActions.actions[ actionName ] ) {
				return true;
			}
		}
		return false;
	}
	function _getDeviceActionNames( device, actionService ) {
		var indexDeviceActions = _indexDeviceActionByDevice[ device.altuiid ];
		if ( !indexDeviceActions ) {
			return;
		}
		var actionNames = [];
		if ( actionService ) {
			if ( indexDeviceActions.services[ actionService ] ) {
				$.each( indexDeviceActions.services[ actionService ], function( actionName, dummy ) {
					actionNames.push( actionName );
				} );
			}
		} else {
			$.each( indexDeviceActions.actions, function( actionName, dummy ) {
				actionNames.push( actionName );
			} );
			
		}
		return actionNames;
	}
	function _getDeviceActionServiceNames( device, actionName ) {
		var indexDeviceActions = _indexDeviceActionByDevice[ device.altuiid ];
		if ( !indexDeviceActions ) {
			return;
		}
		var actionServiceNames = [];
		if ( actionName ) {
			if ( indexDeviceActions.actions[ actionName ] ) {
				$.each( indexDeviceActions.actions[ actionName ], function( serviceName, dummy ) {
					actionServiceNames.push( serviceName );
				} );
			}
		} else {
			$.each( indexDeviceActions.services, function( serviceName, dummy ) {
				actionServiceNames.push( serviceName );
			} );
			
		}
		return actionServiceNames;
	}
	function _getDeviceAction( actionService, actionName ) {
		if ( !actionService || !actionName ) {
			return;
		}
		return _indexDevicesActions[ actionService + ";" + actionName ];
	}

	function _pageRuleEdit( altuiid, fileName, idx, id, readOnly ) {
		var device = MultiBox.getDeviceByAltuiID( altuiid );

		// Page preparation
		//UIManager.clearPage( _T( "Control Panel" ), ( readOnly ? _T( "View rule" ) : _T( "Edit rule" ) ) + " - {0} <small>#{1}</small>".format( device.name , altuiid ), UIManager.oneColumnLayout );
		UIManager.clearPage( _T( "Rule" ), ( readOnly ? _T( "View rule" ) : _T( "Edit rule" ) ) + " - {0} <small>#{1}</small>".format( device.name , altuiid ), UIManager.oneColumnLayout );
		$(window).scrollTop(0);

		// Rules in the XML file
		var _currentXmlRules = [];

		// Draw the panel
		var html = '<div class="altui-rule-toolbar">'
			+		'<div class="btn-group" role="group" aria-label="...">'
			+			'<button class="btn btn-default altui-rule-cancel" title="' + _T( "Cancel" ) + '">'
			+				'<span class="glyphicon glyphicon-remove" aria-hidden="true"></span>'
			+			'</button>'
			+			( readOnly ? '' :
						'<button class="btn btn-default disabled altui-rule-confirm" title="' + _T( "Save Changes" ) + '">'
			+				'<span class="glyphicon glyphicon-cloud-upload" aria-hidden="true"></span>'
			+			'</button>'
						)
			+		'</div>'
			+		'<div class="btn-group pull-right" role="group" aria-label="...">'
			+			'<button class="btn btn-default altui-rule-import" title="' + _T( "Import XML" ) + '">'
			+				'<span class="glyphicon glyphicon-log-in" aria-hidden="true"></span>'
			+			'</button>'
			+			'<button class="btn btn-default altui-rule-export" title="' + _T( "Export XML" ) + '">'
			+				'<span class="glyphicon glyphicon-log-out" aria-hidden="true"></span>'
			+			'</button>'
			+		'</div>'
			+	'</div>'
			+	'<div id="altui-rule-import" class="panel panel-default altui-rule-xml collapse">'
			+		'<div class="panel-body">'
			+			'<textarea id="altui-rule-xml-import" class="altui-rule-xml-content"></textarea>'
			+		'</div>'
			+		'<div class="panel-footer">'
			+			'<button class="btn-xs btn btn-default pull-right altui-toggle-panel" title="' + _T( "Close" ) + '">'
			+				'<span class="glyphicon glyphicon-chevron-up" aria-hidden="true"></span>'
			+			'</button>'
			+			'<button class="btn-xs btn btn-default pull-right altui-rule-import-ok" title="' + _T( "Import" ) + '">'
			+				'<span class="glyphicon glyphicon-ok" aria-hidden="true"></span>'
			+			'</button>'
			+			'XML import'
			+		'</div>'
			+	'</div>'
			+	'<div id="altui-rule-export" class="panel panel-default altui-rule-xml collapse">'
			+		'<div class="panel-body">'
			+			'<textarea id="altui-rule-xml-export" class="altui-rule-xml-content"></textarea>'
			+		'</div>'
			+		'<div class="panel-footer">'
			+			'<button class="btn-xs btn btn-default pull-right altui-toggle-panel" title="' + _T( "Close" ) + '">'
			+				'<span class="glyphicon glyphicon-chevron-up" aria-hidden="true"></span>'
			+			'</button>'
			+			'XML export'
			+		'</div>'
			+	'</div>'
			+	'<div class="col-xs-12">' + htmlControlPanel + '</div>';
		// Manage the UI events
		$(".altui-mainpanel")
			.append(  html )
			.on( "click", ".altui-rule-cancel", function() {
				if ( readOnly
					|| $( ".altui-mainpanel .altui-rule-confirm" ).hasClass( "disabled" ) 
					|| confirm( "The rule has been modified, are you sure to cancel ?" )
				) {
					_pageRules( altuiid );
				}
			} )
			.on( "click", ".altui-rule-confirm", function() {
				if ( !$( this ).hasClass( "disabled" ) ) {
					_saveBlocklyChanges( altuiid, fileName, _currentXmlRules, idx );
				}
			} )
			.on( "click", ".altui-toggle-panel", function() {
				$( this ).parents( ".panel:first" ).toggleClass( "collapse" );
			} )
			.on( "click", ".altui-rule-import", function() {
				$( "#altui-rule-export" ).toggleClass( "collapse", true );
				$( "#altui-rule-import" ).toggleClass( "collapse", false );
				Blockly.fireUiEvent(window, 'resize');
			} )
			.on( "click", ".altui-rule-import-ok", function() {
				_importXml();
			} )
			.on( "click", ".altui-rule-export", function() {
				$( "#altui-rule-import" ).toggleClass( "collapse", true );
				_exportXml();
				$( "#altui-rule-export" ).toggleClass( "collapse", false );
				Blockly.fireUiEvent(window, 'resize');
			} );
		// Draw the rule editor after having loaded all the xml rules 
		// and eventually show the rule to edit
		$.when( 
			_loadDevicesActions(),
			_loadBlocklyResourcesAsync( device )
		)
			.done( function() {
				_drawBlocklyPanel( device, readOnly );
				if ( readOnly !== true ) {
					_watchBlocklyChanges( device );
				}
				$.when(
					_loadRulesAsync( device, fileName ),
					_getRulesInfosAsync( device, { fileName: fileName } )
				)
					.done( function( xmlRules, rulesInfos ) {
						if ( id ) {
							var ruleInfos = $.grep( rulesInfos, function( infos ) {
								return infos.id === id;
							} )[ 0 ];
							$( "#rulesengine-blockly-workspace" )
								.data( "rule_id", id )
								.data( "rule_version", ruleInfos.version )
						}
						$( "#rulesengine-blockly-workspace" )
							.data( "plugin_version", _version );

						_currentXmlRules = xmlRules; // à enlever ?
						_checkXmlRulesIds( xmlRules, rulesInfos );
						if ( idx != null ) {
							var workspace = Blockly.getMainWorkspace();
							try {
								_clearIndexBlocklyConditionBlocks();
								Blockly.Xml.domToWorkspace(workspace, { childNodes: [ xmlRules[ idx - 1 ] ] } );
								_moveFirstBlocklyBlockToTopLeftCorner();
								if ( readOnly ) {
									_updateIndexBlocklyConditionBlocks();
									_updateViewPageRule( rulesInfos, id );
								}
							} catch( e ) {
								// There's a critical error
								// TODO : not be able to save and show XML code
								PageMessage.message( "Blocky error : " + e, "danger");
								console.error( e );
							}
						}
					} );
			} );
	}

	function _changeSvgBlock( block, infos ) {
		if ( !block ) {
			return;
		}
		if ( infos.status === 1 ) {
			block.setTooltip( "ON since " + _convertTimestampToLocaleString( infos.lastStatusUpdateTime ) );
			block.svgPath_.style.stroke = "#FF0000";
			block.svgPath_.style["stroke-width"] = "4";
			//block.svgPath_.style["stroke-dasharray"] = "5,5";
		} else {
			block.setTooltip( "OFF since " + _convertTimestampToLocaleString( infos.lastStatusUpdateTime ) );
			block.svgPath_.style.stroke = "";
			block.svgPath_.style["stroke-width"] = "";
		}
	}

	function _updateViewPageRule( rulesInfos, ruleId ) {
		var ruleInfos = $.grep( rulesInfos, function( infos ) {
			return infos.id === ruleId;
		} )[ 0 ];
		if ( !ruleInfos ) {
			return;
		}
		_changeSvgBlock( _getBlocklyConditionBlock( ruleInfos.id ), ruleInfos );
		$.each( ruleInfos.conditions, function( conditionId, conditionInfos) {
			_changeSvgBlock( _getBlocklyConditionBlock( conditionId ), conditionInfos );
		} );
	}

	function _importXml() {
		var workspace = Blockly.getMainWorkspace();
		var xml_text = $( "#altui-rule-xml-import" ).val();
		if ( xml_text.trim() === "" ) {
			return;
		}
		var xml = Blockly.Xml.textToDom( xml_text );
		_decodeCarriageReturns( xml );
		Blockly.Xml.domToWorkspace( workspace, xml );
		var nbBlockWithId = 0;
		$.each( workspace.topBlocks_, function( i, topBlock ) {
			if (
				( topBlock.type === "rule" )
				&& ( topBlock.getFieldValue( "id" ) !== "" )
			) {
				nbBlockWithId++;
			}
		} );
		if ( ( nbBlockWithId > 0 ) && confirm( "After the import, there are rule with id. Unless you exactly know what you are doing, would you like to erase these ids ?" ) ) {
			$.each( workspace.topBlocks_, function( i, topBlock ) {
				if (
					( topBlock.type === "rule" )
					&& ( topBlock.getFieldValue( "id" ) !== "" )
				) {
					topBlock.setFieldValue( "", "id" )
				}
			} );
		}
	}
	function _exportXml( xml ) {
		var workspace = Blockly.getMainWorkspace();
		var xml = (xml != undefined ? xml : Blockly.Xml.workspaceToDom( workspace ));
		_encodeCarriageReturns( xml );
		var xml_text = Blockly.Xml.domToPrettyText( xml );
		$( "#altui-rule-xml-export" ).val( xml_text );
		$( "#altui-rule-export" ).toggleClass( "collapse", false );
		Blockly.fireUiEvent(window, 'resize');
	}

	// *************************************************************************************************
	// Main
	// *************************************************************************************************

	// explicitly return public methods when this object is instantiated
	var myModule = {
		getStyle: _getStyle,
		drawDevice: function( device ) {
			_altuiid = device.altuiid;

			var status = parseInt( MultiBox.getStatus( device, "urn:upnp-org:serviceId:SwitchPower1", "Status" ), 10 );
			_init( device );

			return '<div class="panel-content">'
				+		ALTUI_PluginDisplays.createOnOffButton( status, "altui-rulesengine-" + _altuiid, _T( "OFF,ON" ), "pull-right" )
				+		'<div class="btn-group" role="group" aria-label="...">'
				+			'<button class="btn btn-default pull-left" onclick="javascript:ALTUI_RulesEngine.pageRules(\'' + _altuiid + '\');">'
				+				'<span class="glyphicon glyphicon-th" title="' + _T( "Rules" ) + '"></span>'
				+			'</button>'
				+			'<button class="btn btn-default pull-left" onclick="javascript:ALTUI_RulesEngine.pageTimeline(\'' + _altuiid + '\');">'
				+				'<span class="glyphicon glyphicon-calendar" title="' + _T( "Timeline" ) + '"></span>'
				+			'</button>'
				+			'&nbsp;v' + _version
				+		'</div>'
				+		'<div class="info">'
				+			( _debugMode != "" ? '<small>Debug ON</small>' : '' )
				+		'</div>'
				+	'</div>'
				+	'<script type="text/javascript">'
				+		'$("div#altui-rulesengine-{0}").on("click touchend", function() { ALTUI_PluginDisplays.toggleOnOffButton("{0}", "div#altui-rulesengine-{0}"); } );'.format( _altuiid )
				+	'</script>';
		},
		drawControlPanel: function( device, domparent ) {
			$( domparent ).html( '<div id="rulesengine-rule-list">TODO</div>' );
			/*
			$( domparent ).html( '<div id="rulesengine-rule-list"></div>' );
			_drawRuleList( device.altuiid );
			*/
		},

		onDeviceStatusChanged: _onDeviceStatusChanged,
		pageRules: _pageRules,
		pageTimeline: _pageTimeline,
		showLuaEditor: _showLuaEditor,
		hasDeviceActionService: _hasDeviceActionService,
		getDeviceActionServiceNames: _getDeviceActionServiceNames,
		getDeviceActionNames: _getDeviceActionNames,
		getDeviceAction: _getDeviceAction,
		getRooms: _getRooms,
		getRules: _getRules,
		getScenes: _getScenes
	};

	// Register
	if ( !_registerIsDone ) {
		EventBus.registerEventHandler("on_ui_deviceStatusChanged", myModule, "onDeviceStatusChanged");
		_registerIsDone = true;
	}

	return myModule;
})( window );
