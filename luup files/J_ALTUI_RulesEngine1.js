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
.altui-rule-toolbar { margin:5px 15px;  }\
.altui-rule-body .altui-rule-infos { margin-left:5px; }\
.altui-rule-body .altui-rule-errors { color:red; font-size:0.8em; }\
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
//console.log("onDeviceStatusChanged: lastUpdate ", device.states[ i ].value);
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
					d.reject();
				}
			} )
			.fail( function( jqxhr, textStatus, errorThrown ) {
				PageMessage.message( "Get timeline error : " + errorThrown, "warning" );
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
			$(nodePath).html( "<div>Next schedule: " + _convertTimestampToLocaleString( nextSchedule.timestamp ) + "</div>" );
		} else {
			$(nodePath).html( "<div>No scheduled task</div>" );
		}
	};

	function _updateRules( device, jsonRulesInfos ) {
		if ( $( ".altui-rules" ).length === 0 ) {
			return;
		}
		var rulesInfos = $.parseJSON( jsonRulesInfos || MultiBox.getStatus( device, "urn:upnp-org:serviceId:RulesEngine1", "Rules" ) );
//console.log("rulesInfos", rulesInfos);
		$.each( rulesInfos, function( idx, infos ) {
			var $mainPanel = $( '.altui-mainpanel .altui-rule[data-ruleidx="' + idx + '"]' );
			// Icon status
			var $icon = $mainPanel.find( "img.altui-device-icon" );
			if ( ( infos.status === "1" ) && $icon.hasClass( "altui-rule-inactive" ) ) {
				$icon
					.removeClass( "altui-rule-inactive" )
					.addClass( "altui-rule-active" )
					.attr( "src", "http://vosmont.github.io/icons/virtual_alarm_panel_on.png" );
			} else if ( ( infos.status === "0" ) && $icon.hasClass( "altui-rule-active" ) ) {
				$icon
					.removeClass( "altui-rule-active" )
					.addClass( "altui-rule-inactive" )
					.attr( "src", "http://vosmont.github.io/icons/virtual_alarm_panel_off.png" );
			}
			// Acknowledgement
			var $ackButton = $mainPanel.find( ".altui-rule-ackbutton" );
			$ackButton.removeClass("spinner");
			if ( infos.isAcknowledged ) {
				if ( !$ackButton.hasClass( "on" ) ) {
					$ackButton
						.removeClass( "off" )
						.addClass( "on" )
						.next( ".altui-button-stateLabel" )
							.text( _T( "Ack" ) );
				}
			} else {
				if ( $ackButton.hasClass( "on" ) ) {
					$ackButton
						.removeClass( "on" )
						.addClass( "off" )
						.next( ".altui-button-stateLabel" )
							.text( "" );
				}
			}
			// Enable / disable
			var $enableMenuItem = $mainPanel.find( ".dropdown-menu .altui-rule-arm" );
			if ( infos.isArmed ) {
				if ( $enableMenuItem.hasClass( "arm" ) ) {
					$enableMenuItem
						.removeClass( "arm" )
						.addClass( "disarm" )
						.text( _T( "Disarm" ) );
				}
			} else {
				if ( $enableMenuItem.hasClass( "disable" ) ) {
					$enableMenuItem
						.removeClass( "disarm" )
						.addClass( "arm" )
						.text( _T( "Arm" ) );
				}
			}
			// Infos
			var status = {
				"1": "ON",
				"0": "OFF"
			};
			var html = ( status[ infos.status ] || "KO" ) 
				+ ( infos.lastStatusUpdate > 0 ? _T( " since " ) + _convertTimestampToLocaleString( infos.lastStatusUpdate ) : "");
			if ( $.isArray( infos.errors ) && ( infos.errors.length > 0 ) ) {
				html += '<div class="altui-rule-errors">';
				$.each( infos.errors, function( i, error ) {
					html += '<div>' + error + '</div>';
				} );
				html += '</div>';
			}
			$mainPanel.find( ".altui-rule-infos" ).html( html );
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
			.done( function() {
				for (var i = 0; i < arguments.length; i++) {
					_resourceLoaded[ arguments[ i ][ 2 ].fileName ] = true;
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
				PageMessage.message( "File \"" + fileName + "\" has been saved", "success");
				d.resolve();
			} else {
				PageMessage.message( "Save \"" + fileName + "\" : " + html, "danger");
				d.reject();
			}
		} )
		.fail( function( jqxhr, textStatus, errorThrown ) {
			PageMessage.message( "Save \"" + fileName + "\" : " + textStatus + " - " + (errorThrown || "unknown"), "danger");
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
			var ruleId = $( xmlRule ).children( "field[name=\"id\"]" ).text();
			var ruleName = $( xmlRule ).children( "value[name=\"name\"]" ).text().trim();
			if ( ruleId != "" ) {
				if ( ruleId !== rule.id ) {
					PageMessage.message( "Desynchronization: id #" + ruleId + " of the rule at position " + idx + " in the xml file is not the expected id #" + rule.id + ". You should not save.", "warning");
				}
				if ( ruleName !== rule.name ) {
					PageMessage.message( "Desynchronization: name '" + ruleName + "' of the rule at position " + idx + " in the xml file is not the expected name '" + rule.name + "'. You should not save.", "warning");
				}
			} else {
				// The rule has not an id; add it
				if ( ruleName !== rule.name ) {
					PageMessage.message( "Desynchronization: name '" + ruleName + "' of the rule at position " + idx + " in the xml file is not the expected name '" + rule.name + "'. You should not save.", "warning");
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
				$( ".altui-rule-confirmbutton" ).removeClass( "btn-default" ).removeClass( "disabled" ).addClass( "btn-danger" );
				$( workspace.getCanvas() ).off( "blocklyWorkspaceChange" );
			}
			_isFirstCall = false;
		} );
	}

	function _pageRules( altuiid ) {
		var device = MultiBox.getDeviceByAltuiID( altuiid );
		UIManager.clearPage( _T( "Control Panel" ), "Rules - {0} <small>#{1}</small>".format( device.name , altuiid ), UIManager.oneColumnLayout );

		// TODO : select the file
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
				var idx = parseInt( $( this ).data( "ruleidx" ), 10 );
				_pageRuleEdit( altuiid, fileName, idx );
			} )
			.on( "click", ".altui-rule-arm", function() {
				var ruleId = $( this ).data( "ruleid" );
				if ( $( this ).hasClass( "arm" ) ) {
					MultiBox.runActionByAltuiID( altuiid, "urn:upnp-org:serviceId:RulesEngine1", "SetRuleArming", { ruleId: ruleId, arming: "1" } );
				} else {
					MultiBox.runActionByAltuiID( altuiid, "urn:upnp-org:serviceId:RulesEngine1", "SetRuleArming", { ruleId: ruleId, arming: "0" } );
				}
			} )
			.on( "click", ".altui-rule-ackbutton", function() {
				var ruleId = $( this ).data( "ruleid" );
				$( this ).addClass("spinner");
				if ( $( this ).hasClass( "off" ) ) {
					MultiBox.runActionByAltuiID( altuiid, "urn:upnp-org:serviceId:RulesEngine1", "SetRuleAcknowledgement", { ruleId: ruleId, acknowledgement: "1" } );
				} else {
					MultiBox.runActionByAltuiID( altuiid, "urn:upnp-org:serviceId:RulesEngine1", "SetRuleAcknowledgement", { ruleId: ruleId, acknowledgement: "0" } );
				}
			} );

		// Draw the rules
		$(".altui-mainpanel").append( '<div class="altui-rules"></div>' );
		$.when( _getRulesAsync( device ) )
				.done( function( rules ) {
					_settings[ device.altuiid ].rules = rules;
					$.each( rules, function( idx, rule) {
						var isAcknowledgeable = ( $.grep( rule.params, function( param, i ) { return ( ( param.key === "Ackable" ) && ( param.value === "1" ) ); } ).length === 1 );
						$(".altui-mainpanel .altui-rules").append(
								'<div class="col-sm-6 col-md-4 col-lg-3">'
							+		'<div class="panel panel-default altui-rule" data-altuiid="' + device.altuiid + '" data-ruleid="' + rule.id + '" data-ruleidx="' + idx + '" id="' + device.altuiid + '">'
							+			'<div class="panel-heading altui-device-heading">'
							+				'<div class="btn-group pull-right">'
							+					'<button class="btn btn-default btn-xs dropdown-toggle altui-device-command" type="button" data-toggle="dropdown" aria-expanded="true">'
							+						'<span class="caret"></span>'
							+					'</button>'
							+					'<ul class="dropdown-menu" role="menu">'
							+						'<li><a class="altui-rule-edit" href="#" role="menuitem" data-ruleidx="' + idx + '">' + _T( "Edit" ) + '</a></li>'
							+						'<li><a class="altui-rule-arm ' + (rule.isArmed ? 'disarm' : 'arm' ) + '" href="#" role="menuitem" data-ruleid="' + rule.id + '">' + (rule.isArmed ? _T( "Disarm" ) : _T( "Arm" )) + '</a></li>'
							+						'<li><a class="altui-rule-remove" href="#" role="menuitem" data-ruleidx="' + idx + '">' + _T( "Remove" ) + '</a></li>'
							+					'</ul>'
							+				'</div>'
							+				'<div class="pull-right text-muted"><small>#' + rule.id + '</small></div>'
							+				'<div class="panel-title altui-device-title" data-toggle="tooltip" data-placement="left">'
							+					'<small class="altui-rule-title-name">' + rule.name + '</small>'
							+				'</div>'
							+			'</div>'
							+			'<div class="panel-body altui-rule-body">'
							+				'<img class="altui-device-icon pull-left img-rounded altui-rule-inactive" src="http://vosmont.github.io/icons/virtual_alarm_panel_off.png">'
							+			( isAcknowledgeable ?
											'<div class="altui-button-onoff pull-right">'
							+					'<div class="pull-right on-off-device off altui-rule-ackbutton" data-ruleid="' + rule.id + '"></div>'
							+					'<div class="altui-button-stateLabel"></div>'
							+				'</div>' : '' )
							+				'<div class="altui-rule-infos"></div>'
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

	function _saveBlocklyChanges( altuiid, fileName, xmlRules, idx ) {
		// Get new or modified rules from Blockly
		var workspace = Blockly.getMainWorkspace();
		var $xmlBlockly = $( Blockly.Xml.workspaceToDom( workspace ) );
		$xmlBlockly.find( "block[type=\"rule\"]" )
			.each( function( i, xmlRule ) {
				if ( i === 0 ) {
					xmlRules[ idx ] = xmlRule;
				} else {
					xmlRules.push( xmlRule );
				}
			} );

		$.when( _saveRulesFileAsync( fileName, xmlRules ) )
			.done( function() {
				PageMessage.message( "File '" + fileName + "' has been saved - Reload rules", "info");
				MultiBox.runActionByAltuiID( altuiid, "urn:upnp-org:serviceId:RulesEngine1", "LoadRules", { fileName: fileName } );
				ALTUI_RulesEngine.pageRules( altuiid );
			} )
			.fail( function() {
				PageMessage.message( "Rule XML has been dumped", "warning");
				ALTUI_RulesEngine.dumpXml();
			} );
	};

	function _pageRuleEdit( altuiid, fileName, idx ) {
		var device = MultiBox.getDeviceByAltuiID( altuiid );
		UIManager.clearPage( _T( "Control Panel" ), "Edit rule - {0} <small>#{1}</small>".format( device.name , altuiid ), UIManager.oneColumnLayout );

		var _rules = _settings[ altuiid ].rules;
		var _xmlRules = [];

		// Draw the panel
		var html = '<div class="altui-scene-toolbar">'
			+			'<button class="btn btn-default altui-rule-cancelbutton">' + _T( "Cancel" ) + '</button>'
			+			'<button class="btn btn-default disabled altui-rule-confirmbutton">' + _T( "Save Changes" ) + '</button>'
			+	'</div>'
			+	'<div class="col-xs-12">' + htmlControlPanel + '</div>';
		$(".altui-mainpanel")
			.append(  html )
			.on( "click", ".altui-rule-cancelbutton", function() {
				if (
					$( ".altui-mainpanel .altui-rule-confirmbutton" ).hasClass( "disabled" ) 
					|| confirm("The rule has been modified, are you sure to cancel ?")
				) {
					ALTUI_RulesEngine.pageRules( altuiid );
				}
			} )
			.on( "click", ".altui-rule-confirmbutton", function() {
				if ( !$( this ).hasClass( "disabled" ) ) {
					_saveBlocklyChanges( altuiid, fileName, _xmlRules, idx );
				}
			} );

		$.when( _loadBlocklyResourcesAsync( device ) )
			.done( function() {
				_drawBlocklyPanel( device );
				_watchBlocklyChanges( device );
				$.when( _loadRulesAsync( device, fileName ) )
					.done( function( xmlRules ) {
						_xmlRules = xmlRules;
						_checkXmlRulesIds( _xmlRules, _rules );
						if ( idx != null ) {
							var workspace = Blockly.getMainWorkspace();
							Blockly.Xml.domToWorkspace(workspace, { childNodes: [ _xmlRules[ idx ] ] } );
						}
					} );
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
				_settings[ device.altuiid ] = {};
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
		pageTimeline: _pageTimeline,

		loadXml: function () {
			var workspace = Blockly.getMainWorkspace();
			var xml_text = $( "#xmlRules" ).val();
			var xml = Blockly.Xml.textToDom( xml_text );
			_decodeCarriageReturns( xml );
			Blockly.Xml.domToWorkspace( workspace, xml );
		},
		dumpXml: function () {
			var workspace = Blockly.getMainWorkspace();
			var xml = Blockly.Xml.workspaceToDom( workspace );
			_encodeCarriageReturns( xml );
			//var xml_text = Blockly.Xml.domToText(xml);
			var xml_text = Blockly.Xml.domToPrettyText( xml );
			$( "#xmlRules" ).val( xml_text );
		}
	};
})( window );
