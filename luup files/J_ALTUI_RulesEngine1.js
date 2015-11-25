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
<xml id="toolbox" style="display: none"></xml>\
<div id="blocklyDiv" style="width: 100%; height: 800px;"></div>\
	';

	var xmlToolbox = '\
<category name="Rules">\
	<block type="rule">\
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
	<block type="property_auto_untrip"></block>\
	<block type="property_is_acknowledgeable"></block>\
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
div.altui-rule-icon { width: 60px; height: 60px; }\
div.altui-rule-ko { cursor: auto; background: url("http://vosmont.github.io/icons/virtual_alarm_panel_ko.png")}\
div.altui-rule-inactive { cursor: auto; background: url("http://vosmont.github.io/icons/virtual_alarm_panel_off.png")}\
div.altui-rule-active { cursor: pointer; background: url("http://vosmont.github.io/icons/virtual_alarm_panel_on.png")}\
div.altui-rule-acknowledged { cursor: pointer; background: url("http://vosmont.github.io/icons/virtual_alarm_panel_on_acknoledge.png")}\
.altui-rule-toolbar { margin:5px 15px;  }\
.altui-rule-arm { padding-right: 3px; cursor: pointer; } \
.altui-rule-ack { padding-right: 3px; cursor: pointer; } \
.altui-rule-warning { color: orange; } \
.altui-rule-errors { cursor: pointer; } \
.altui-rule-title-name { margin-left: 5px; }\
.altui-rule-body .altui-rule-infos { margin-left:5px; }\
.altui-rule-body .altui-rule-errors { color:red; font-size:0.8em; }\
.altui-rule-xml .panel-body { padding: 0px; }\
.altui-rule-xml-content { width: 100%; height: 200px; }\
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
//console.log("onDeviceStatusChanged", device.states[ i ].variable, device.states[ i ].value);
				if ( device.states[ i ].variable === "LastUpdate" ) {
					if ( _settings[ device.altuiid ].lastUpdate !== device.states[ i ].value ) {
						_settings[ device.altuiid ].lastUpdate = device.states[ i ].value;
						/*
						$.when( _getTimelineAsync( device ) )
							.done( function( timeline ) {
								_settings[ device.altuiid ].timeline = timeline;
								_updateDevice( device, timeline );
								_updateTimeline( timeline );
							} );
						*/
					}
				} else if ( device.states[ i ].variable === "RulesInfos" ) {
					_updateRules( device, device.states[ i ].value );
				} else if ( device.states[ i ].variable === "RulePanel" ) {
					_updatePanel( device, device.states[ i ].value )
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
					d.reject();
				}
			} )
			.fail( function( jqxhr, textStatus, errorThrown ) {
				PageMessage.message( "Get timeline error : " + errorThrown, "warning" );
				d.reject();
			} );
		return d.promise();
	};

	function _getRulesInfosAsync( device, ruleId ) {
		var d = $.Deferred();
		$.when(
			$.ajax( {
				url: window.location.pathname + "?id=lr_RulesEngine&command=getRulesInfos" + ( ruleId != undefined ? "&ruleId=" + ruleId : "" ) + "&output_format=json#",
				dataType: "json"
			} )
		)
			.done( function( rulesInfos ) {
				if ( $.isArray( rulesInfos ) ) {
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
	};

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
	};

	function _updateDevice( device, timeline ) {
		var nodePath = ".altui-device[data-altuiid='" + device.altuiid + "'] .panel-content .info";
		if ( $.isArray( timeline.scheduled ) && timeline.scheduled.length > 0 ) {
			var nextSchedule = timeline.scheduled[ 0 ];
			$( nodePath ).html( "<div>Next schedule: " + _convertTimestampToLocaleString( nextSchedule.timestamp ) + "</div>" );
		} else {
			$( nodePath ).html( "<div>No scheduled task</div>" );
		}
	};

	function _updatePanel( device, htmlPanel ) {
		$( ".altui-device[data-altuiid='" + device.altuiid + "'] .panel-content .altui-rule-panel" )
			.html( htmlPanel );
			
			
		$( ".altui-device[data-altuiid='" + device.altuiid + "'] div.altui-device-body" )
			.css( "height", "auto");
	};

	function _updateRules( device, jsonRulesInfos ) {
		if ( $( ".altui-rules" ).length === 0 ) {
			return;
		}
		var rulesInfos = $.parseJSON( jsonRulesInfos || MultiBox.getStatus( device, "urn:upnp-org:serviceId:RulesEngine1", "RulesInfos" ) );
console.log("rulesInfos", rulesInfos);
		$.each( rulesInfos, function( i, ruleInfos ) {
			var $rule = $( '.altui-mainpanel .altui-rule[data-ruleid="' + ruleInfos.id + '"][data-ruleidx="' + ruleInfos.idx + '"]' );
			// Icon status
			var $icon = $rule.find( ".altui-rule-icon" );
			$icon
				.toggleClass( "altui-rule-ko", ( ruleInfos.status === "-1" ) )
				.toggleClass( "altui-rule-inactive", ( ruleInfos.status === "0" ) )
				.toggleClass( "altui-rule-active", ( ( ruleInfos.status === "1" ) && !ruleInfos.isAcknowledged ) )
				.toggleClass( "altui-rule-acknowledged", ( ( ruleInfos.status === "1" ) && ruleInfos.isAcknowledged ) );
			// Enable / disable
			$rule.find( ".altui-rule-arm" )
				.toggleClass( "activated", ( ( ruleInfos.status !== "-1" ) && ruleInfos.isArmed ) )
				.toggleClass( "paused",   ( ( ruleInfos.status !== "-1" ) && !ruleInfos.isArmed ) )
				.toggleClass( "altui-rule-warning", ( ruleInfos.status === "-1" ) )
				.attr( "title", ( ruleInfos.status === "-1" ? "Rule KO" : ( ruleInfos.isArmed ? _T( "Disarm rule" ) : _T( "Arm rule" ) ) ) );
			// Infos
			var status = {
				"1": "ON",
				"0": "OFF",
				"-1": "KO"
			};
			var html = "";
			if ( $.isArray( ruleInfos.errors ) && ( ruleInfos.errors.length > 0 ) ) {
				html += '<span class="glyphicon glyphicon-alert altui-rule-errors" aria-hidden="true" title="' + _T( "See rule's errors") + '"></span> ';
			}
			html += ( status[ ruleInfos.status ] || "UNKNOWN" ) 
				+ ( ruleInfos.lastStatusUpdate > 0 ? _T( " since " ) + _convertTimestampToLocaleString( ruleInfos.lastStatusUpdate ) : "");
			$rule.find( ".altui-rule-infos" ).html( html );
			
		} );
	};

	function _loadBlocklyResourcesAsync( device ) {
		var d = $.Deferred();
		// Get the names of the resource files
		var fileNames = [ "J_RulesEngine1_Blockly.js" ];
		var toolboxConfig = MultiBox.getStatus( device, "urn:upnp-org:serviceId:RulesEngine1", "ToolboxConfig" );
		if ( ( toolboxConfig !== undefined ) && ( toolboxConfig !== "" ) ) {
			toolboxConfig = $.parseJSON( toolboxConfig );
			$.each( toolboxConfig, function( index, config ) {
				if ( $.inArray( config.resource, fileNames ) === -1 ) {
					fileNames.push( config.resource );
				}
			} );
		}
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
			.done( function( xml, textStatus, jqxhr ) {
				if (loaders.length === 1) {
					_resourceLoaded[ jqxhr.fileName ] = true;
				} else if (loaders.length > 1) {
					// arguments : [ [ xml, textStatus, jqxhr ], ... ]
					for (var i = 0; i < arguments.length; i++) {
						var jqxhr = arguments[ i ][ 2 ];
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
	};

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
		_settings[ device.altuiid ].rules = [];
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
		//var content = Blockly.Xml.domToText( xmlRoot );
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
			_exportXml( xmlRoot ) 
			PageMessage.message( "Modified XML file has been exported. You have to upload it on the Vera by hand.", "warning");
			d.reject();
		} );

		return d.promise();
	}

	function _checkXmlRulesIds( xmlRules, rules ) {
		if ( xmlRules.length !== rules.length ) {
			PageMessage.message( "Desynchronization : expected " + rules.length + " rule(s) and found " + xmlRules.length + " in the xml file", "warning");
		}
		xmlRules.each( function( idx, xmlRule ) {
			if ( idx >= rules.length ) {
				return
			}
			var rule = rules[ idx ];
			if ((rule.idx - 1) !== idx) {
				PageMessage.message( "Desynchronization: rule at position " + idx + " in the xml file does not correspond to the former known rule #" + rule.id + ". You should not save.", "warning");
			}
			var xmlRuleId = $( xmlRule ).children( "field[name=\"id\"]" ).text();
			var xmlRuleName = $( xmlRule ).children( "value[name=\"name\"]" ).text().trim();
			if ( xmlRuleId != "" ) {
				if ( xmlRuleId !== rule.id ) {
					PageMessage.message( "Desynchronization: id #" + xmlRuleId + " of the rule at position " + idx + " in the xml file is not the expected id #" + rule.id + ". You should not save.", "warning");
				}
				if ( xmlRuleName !== rule.name ) {
					PageMessage.message( "Desynchronization: name '" + xmlRuleName + "' of the rule at position " + idx + " in the xml file is not the expected name '" + rule.name + "'. You should not save.", "warning");
				}
			} else {
				// The rule has not an id; add it (calculated by the LUA part of the plugin)
				if ( xmlRuleName !== rule.name ) {
					PageMessage.message( "Desynchronization: name '" + xmlRuleName + "' of the rule at position " + idx + " in the xml file is not the expected name '" + rule.name + "'. You should not save.", "warning");
				} else {
					$( xmlRule ).children( "field[name=\"id\"]" ).remove();
					$( xmlRule ).append( '<field name="id">' + rule.id + '</field>' );
				}
			}
		} );
	};

	function _drawBlocklyPanel( device ) {
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

	function _getParamValue( rule, key ) {
		for ( var i = 0; i < rule.params.length; i++ ) {
			if ( rule.params[ i ].key === key ) {
				return rule.params[ i ].value;
			}
		}
		return "";
	}

	function _pageRules( altuiid ) {
		var device = MultiBox.getDeviceByAltuiID( altuiid );
		UIManager.clearPage( _T( "Control Panel" ), "Rules - {0} <small>#{1}</small>".format( device.name , altuiid ), UIManager.oneColumnLayout );

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
		$(".altui-mainpanel")
			.append( html )
			.on( "click", ".altui-rule-create", function() {
				_pageRuleEdit( altuiid, fileName );
			} )
			.on( "click", ".altui-rule-edit", function() {
				var $rule = $( this ).parents( ".altui-rule" );
				var fileName = $rule.data( "rulefilename" );
				var idx = parseInt( $rule.data( "ruleidx" ), 10 );
				_pageRuleEdit( altuiid, fileName, idx );
			} )
			.on( "click", ".altui-rule-remove", function() {
				var $rule = $( this ).parents( ".altui-rule" );
				var fileName = $rule.data( "rulefilename" );
				var idx = parseInt( $rule.data( "ruleidx" ), 10 );
				if (confirm("Are you sure that you want to remove the rule ?")) {
					 _removeRule( altuiid, fileName, idx )
				}
			} )
			.on( "click", ".altui-rule-arm", function() {
				var ruleId = $( this ).parents( ".altui-rule" ).data( "ruleid" );
				if ( $( this ).hasClass( "activated" ) ) {
					MultiBox.runActionByAltuiID( altuiid, "urn:upnp-org:serviceId:RulesEngine1", "SetRuleArming", { ruleId: ruleId, arming: "0" } );
				} else if ( $( this ).hasClass( "paused" ) ) {
					MultiBox.runActionByAltuiID( altuiid, "urn:upnp-org:serviceId:RulesEngine1", "SetRuleArming", { ruleId: ruleId, arming: "1" } );
				}
			} )
			.on( "click", ".altui-rule-ack", function() {
				var $rule = $( this ).parents( ".altui-rule" );
				var ruleId = $rule.data( "ruleid" );
				if ( $( this ).hasClass( "altui-rule-active" ) ) {
					//$( this ).addClass("big-spinner");
					MultiBox.runActionByAltuiID( altuiid, "urn:upnp-org:serviceId:RulesEngine1", "SetRuleAcknowledgement", { ruleId: ruleId, acknowledgement: "1" } );
				} else if ( $( this ).hasClass( "altui-rule-acknowledged" ) ) {
					//$( this ).addClass("big-spinner");
					MultiBox.runActionByAltuiID( altuiid, "urn:upnp-org:serviceId:RulesEngine1", "SetRuleAcknowledgement", { ruleId: ruleId, acknowledgement: "0" } );
				}
			} )
			.on( "click", ".altui-rule-errors", function() {
				var $rule = $( this ).parents( ".altui-rule" );
				var ruleId = $rule.data( "ruleid" );
				var ruleName = $rule.find( ".altui-rule-title-name" ).text();
				var dialog =  DialogManager.registerDialog('dialogModal',
					defaultDialogModalTemplate.format( 
							_T("Rule #" + ruleId + "(" + ruleName + ")"),
							"",				// body
							"modal-lg"		// size
							));
					$.when( _getRulesInfosAsync( device, ruleId ) )
						.done( function( rulesInfos ) {
							var html = '<div class="panel panel-default">'
								+			'<small><table class="table">'
								+				'<thead>'
								+					('<tr><th>{0}</th><th>{1}</th><th>{2}</th></tr>'.format( _T( "Date" ), _T( "Event" ), _T( "Error" ) ) )
								+				'</thead>'
								+				'<tbody>';
							$.each(rulesInfos[0].errors, function( i, e ) {
								html +=				'<tr><td>{0}</td><td>{1}</td><td>{2}</td></tr>'.format( _convertTimestampToLocaleString( e.timestamp ), e.event, e.message);
							});
							html +=				'</tbody>'
								+			'</table></small>';
								+		'</div>';
							$(dialog).find( ".row-fluid" ).append(html);
							$( 'div#dialogModal' ).modal();
						} );
			} );

		// Draw the rules
		$(".altui-mainpanel").append( '<div class="altui-rules"></div>' );
		$.when( _getRulesAsync( device ) )
			.done( function( rules ) {
				_settings[ device.altuiid ].rules = rules;
				// Sort by rule name
				rules.sort( function( a, b ) {
					if ( a.name < b.name ) {
						return -1;
					} else if ( a.name < b.name ) {
						return 1;
					}
					return 0;
				} );
				$.each( rules, function( idx, rule) {
					var fileName          = _getParamValue( rule, "FileName");
					var isAcknowledgeable = ( _getParamValue( rule, "Ackable") === "1" );
					var isArmed           = ( _getParamValue( rule, "Armed") === "1" );
					$(".altui-mainpanel .altui-rules").append(
							'<div class="col-sm-6 col-md-4 col-lg-3">'
						+		'<div class="panel panel-default altui-rule" data-altuiid="' + device.altuiid + '"'
						+				' data-ruleid="' + rule.id + '"'
						+				' data-ruleidx="' + rule.idx + '"'
						+				' data-rulefilename="' + fileName + '"'
						+				' data-ruleacknowledgeable="' + _getParamValue( rule, "Ackable") + '"'
						+				' data-ruleacknowledged="0"'
						+			'>'
						+			'<div class="panel-heading altui-device-heading">'
						+				'<button type="button" class="altui-rule-remove pull-right btn btn-default btn-xs" title="' + _T( "Remove" ) + '">'
						+					'<span class="glyphicon glyphicon-trash text-danger"></span>'
						+				'</button>'
						+				'<div class="pull-right text-muted"><small>#' + rule.id + '</small></div>'
						+				'<div class="panel-title altui-device-title" data-toggle="tooltip" data-placement="left">'
						+					'<span class="altui-rule-arm glyphicon glyphicon-off" aria-hidden="true"></span>'
						+					'<small class="altui-rule-title-name">' + rule.name + '</small>'
						+				'</div>'
						+			'</div>'
						+			'<div class="panel-body altui-rule-body">'
						+				'<small class="altui-rule-infos text-muted pull-right"></small>'
						+				'<table>'
						+					'<tr>'
						+						'<td>'
						+							( isAcknowledgeable ?
													'<div class="altui-device-icon altui-rule-icon pull-left img-rounded altui-rule-ack" title="' + _T( "Change aknowledgement" ) + '"></div>'
													:
													'<div class="altui-device-icon altui-rule-icon pull-left img-rounded"></div>'
													)
						+						'</td>'
						+						'<td width="16px">'
						+							'<button type="button" class="altui-rule-edit pull-left btn btn-xs btn-default" title="' + _T( "Edit" ) + '">'
						+								'<span class="glyphicon glyphicon-pencil " aria-hidden="true"></span>'
						+							'</button>'
						+							'<button type="button" class="altui-rule-timeline pull-left btn btn-xs btn-default" data-ruleid="' + rule.id + '"  title="' + _T( "Timeline" ) + '">'
						+								'<span class="glyphicon glyphicon-calendar" aria-hidden="true"></span>'
						+							'</button>'
						+						'</td>'
						+					'</tr>'
						+				'</table>'
						+			'</div>'
						+		'</div>'
						+	'</div>'
					);
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

	function _removeRule( altuiid, fileName, idx ) {
		if ( idx == undefined ) {
			return;
		}
		var device = MultiBox.getDeviceByAltuiID( altuiid );
		$.when( _loadRulesAsync( device, fileName ) )
			.done( function( xmlRules ) {
				xmlRules.splice((idx - 1), 1);
				$.when( _saveRulesFileAsync( fileName, xmlRules ) )
					.done( function() {
						MultiBox.runActionByAltuiID( altuiid, "urn:upnp-org:serviceId:RulesEngine1", "LoadRules", { fileName: fileName } );
						_pageRules( altuiid );
						PageMessage.message( "File \"" + fileName + "\" has been saved", "success");
					} );
			} );
	};

	function _saveBlocklyChanges( altuiid, fileName, xmlRules, idx ) {
		// Get new or modified rules from Blockly
		var workspace = Blockly.getMainWorkspace();
		var $xmlBlockly = $( Blockly.Xml.workspaceToDom( workspace ) );
		$xmlBlockly.find( "block[type=\"rule\"]" )
			.each( function( i, xmlNewRule ) {
				if ( ( idx != undefined ) && ( i === 0 ) ) {
					xmlRules[ idx - 1 ] = xmlNewRule;
				} else {
					xmlRules.push( xmlNewRule );
				}
			} );

		$.when( _saveRulesFileAsync( fileName, xmlRules ) )
			.done( function() {
				MultiBox.runActionByAltuiID( altuiid, "urn:upnp-org:serviceId:RulesEngine1", "LoadRules", { fileName: fileName } );
				_pageRules( altuiid );
				PageMessage.message( "File \"" + fileName + "\" has been saved", "success");
			} );
	};

	function _pageRuleEdit( altuiid, fileName, idx ) {
		var device = MultiBox.getDeviceByAltuiID( altuiid );
		UIManager.clearPage( _T( "Control Panel" ), "Edit rule - {0} <small>#{1}</small>".format( device.name , altuiid ), UIManager.oneColumnLayout );

		// Known rules for this XML file
		var _currentRules = $.grep( _settings[ altuiid ].rules, function( rule, i ) { return _getParamValue( rule, "FileName") === fileName } )
			.sort( function( a,b ) { return a.idx - b.idx } );
		// Rules in the XML file
		var _currentXmlRules = [];

		// Draw the panel
		var html = '<div class="altui-rule-toolbar">'
			+		'<div class="btn-group" role="group" aria-label="...">'
			+			'<button class="btn btn-default altui-rule-cancel" title="' + _T( "Cancel" ) + '">'
			+				'<span class="glyphicon glyphicon-remove" aria-hidden="true"></span>'
			+			'</button>'
			+			'<button class="btn btn-default disabled altui-rule-confirm" title="' + _T( "Save Changes" ) + '">'
			+				'<span class="glyphicon glyphicon-cloud-upload" aria-hidden="true"></span>'
			+			'</button>'
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
		$(".altui-mainpanel")
			.append(  html )
			.on( "click", ".altui-rule-cancel", function() {
				if (
					$( ".altui-mainpanel .altui-rule-confirm" ).hasClass( "disabled" ) 
					|| confirm("The rule has been modified, are you sure to cancel ?")
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

		$.when( _loadBlocklyResourcesAsync( device ) )
			.done( function() {
				_drawBlocklyPanel( device );
				_watchBlocklyChanges( device );
				$.when( _loadRulesAsync( device, fileName ) )
					.done( function( xmlRules ) {
						_currentXmlRules = xmlRules;
						_checkXmlRulesIds( _currentXmlRules, _currentRules );
						if ( idx != null ) {
							var workspace = Blockly.getMainWorkspace();
							Blockly.Xml.domToWorkspace(workspace, { childNodes: [ _currentXmlRules[ idx - 1 ] ] } );
						}
					} );
			} );
	};

	function _importXml() {
		var workspace = Blockly.getMainWorkspace();
		var xml_text = $( "#altui-rule-xml-import" ).val();
		var xml = Blockly.Xml.textToDom( xml_text );
		_decodeCarriageReturns( xml );
		Blockly.Xml.domToWorkspace( workspace, xml );
	};
	function _exportXml( xml ) {
		var workspace = Blockly.getMainWorkspace();
		var xml = (xml != undefined ? xml : Blockly.Xml.workspaceToDom( workspace ));
		_encodeCarriageReturns( xml );
		var xml_text = Blockly.Xml.domToPrettyText( xml );
		$( "#altui-rule-xml-export" ).val( xml_text );
		$( "#altui-rule-export" ).toggleClass( "collapse", false );
		Blockly.fireUiEvent(window, 'resize');
	};

	// explicitly return public methods when this object is instantiated
	return {
		//---------------------------------------------------------
		// PUBLIC  functions
		//---------------------------------------------------------

		getStyle: _getStyle,

		drawDevice: function( device ) {
			if ( _settings[ device.altuiid ] == null ) {
				_settings[ device.altuiid ] = {};
			}
			if ( !_registerIsDone ) {
				EventBus.registerEventHandler("on_ui_deviceStatusChanged", ALTUI_RulesEngine, "onDeviceStatusChanged");
				_registerIsDone = true;
			}

			/*
			$.when( _getTimelineAsync( device ) )
			.done( function( timeline ) {
				_updateDevice( device, timeline );
			} );
			*/

			return '<div class="panel-content">'
				+		'<div class="btn-group" role="group" aria-label="...">'
				+			'<button class="btn btn-default pull-left" onclick="javascript:ALTUI_RulesEngine.pageRules(\'' + device.altuiid + '\');">'
				+				'<span class="glyphicon glyphicon-th" title="' + _T( "Rules" ) + '"></span>'
				+			'</button>'
				+			'<button class="btn btn-default pull-left" onclick="javascript:ALTUI_RulesEngine.pageTimeline(\'' + device.altuiid + '\');">'
				+				'<span class="glyphicon glyphicon-calendar" title="' + _T( "Timeline" ) + '"></span>'
				+			'</button>'
				+		'</div>'
				+		'<div class="info"></div>'
				//+			'<div class="altui-rule-panel">' + MultiBox.getStatus( device, "urn:upnp-org:serviceId:RulesEngine1", "RulePanel" ) + '</div>'
				+	'</div>';
		},

		drawControlPanel: function( device, domparent ) {
			//_pageRules( device.altuiid );
		},

		onDeviceStatusChanged: _onDeviceStatusChanged,

		pageRules: _pageRules,
		pageTimeline: _pageTimeline
	};
})( window );
