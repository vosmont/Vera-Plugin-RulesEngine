//# sourceURL=J_RulesEngine1_Blockly.js
"use strict";
// This program is free software: you can redistribute it and/or modify
// it under the condition that it is for private or home useage and 
// this whole comment is reproduced in the source code file.
// Commercial utilisation is not authorized without the appropriate
// written agreement from amg0 / alexis . mermet @ gmail . com
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. 

window.ALTUI_RulesEngineResourcesAreLoaded = true;

// ****************************************************************************
// Blockly - Field TextArea
// ****************************************************************************
 
/**
 * @fileoverview Text input field.
 * @author primary.edw@gmail.com (Andrew Mee)
 * based on work in field_textinput by fraser@google.com (Neil Fraser)
 * refactored by toebes@extremenetworks.com (John Toebes)
 */
goog.provide('Blockly.FieldTextArea');

goog.require('Blockly.FieldTextInput');
goog.require('Blockly.Msg');
goog.require('goog.asserts');
goog.require('goog.dom');
goog.require('goog.userAgent');

/**
 * Class for an editable text field.
 * @param {string} text The initial content of the field.
 * @param {Function} opt_changeHandler An optional function that is called
 *     to validate any constraints on what the user entered.  Takes the new
 *     text as an argument and returns either the accepted text, a replacement
 *     text, or null to abort the change.
 * @extends {Blockly.Field}
 * @constructor
 */
Blockly.FieldTextArea = function(text, opt_changeHandler) {
  Blockly.FieldTextArea.superClass_.constructor.call(this, text, opt_changeHandler);
};
goog.inherits(Blockly.FieldTextArea, Blockly.FieldTextInput);

/**
 * Update the text node of this field to display the current text.
 * @private
 */
Blockly.FieldTextArea.prototype.updateTextNode_ = function() {
  if (!this.textElement_) {
    // Not rendered yet.
    return;
  }
  var text = this.text_;

  // Empty the text element.
  goog.dom.removeChildren(/** @type {!Element} */ (this.textElement_));

  // Replace whitespace with non-breaking spaces so the text doesn't collapse.
  text = text.replace(/ /g, Blockly.Field.NBSP);
  if (this.sourceBlock_.RTL && text) {
    // The SVG is LTR, force text to be RTL.
    text += '\u200F';
  }
  if (!text) {
    // Prevent the field from disappearing if empty.
    text = Blockly.Field.NBSP;
  }

  var lines = text.split('\n');
  var dy = '0em';
  for (var i = 0; i < lines.length; i++) {
    var tspanElement = Blockly.createSvgElement('tspan',
        {'dy': dy, 'x': 0}, this.textElement_);
    dy = '1em';
    var textNode = document.createTextNode(lines[i]);
    tspanElement.appendChild(textNode);
  }

  // Cached width is obsolete.  Clear it.
  this.size_.width = 0;
};

/**
 * Draws the border with the correct width.
 * Saves the computed width in a property.
 * @private
 */
Blockly.FieldTextArea.prototype.render_ = function() {
  this.size_.width = this.textElement_.getBBox().width + 5;
  this.size_.height = (this.text_.split(/\n/).length ||1)*20 +
                        (Blockly.BlockSvg.SEP_SPACE_Y+5) ;
  if (this.borderRect_) {
    this.borderRect_.setAttribute('width',
         this.size_.width + Blockly.BlockSvg.SEP_SPACE_X);
	this.borderRect_.setAttribute('height',
         this.size_.height -  (Blockly.BlockSvg.SEP_SPACE_Y+5));
  }

};

/**
 * Show the inline free-text editor on top of the text.
 * @param {boolean=} opt_quietInput True if editor should be created without
 *     focus.  Defaults to false.
 * @private
 */
Blockly.FieldTextArea.prototype.showEditor_ = function(opt_quietInput) {
  var quietInput = opt_quietInput || false;
  if (!quietInput && (goog.userAgent.MOBILE || goog.userAgent.ANDROID ||
                      goog.userAgent.IPAD)) {
    // Mobile browsers have issues with in-line textareas (focus & keyboards).
    var newValue = window.prompt(Blockly.Msg.CHANGE_VALUE_TITLE, this.text_);
    if (this.changeHandler_) {
      var override = this.changeHandler_(newValue);
      if (override !== undefined) {
        newValue = override;
      }
    }
    if (newValue !== null) {
      this.setText(newValue);
    }
    return;
  }

  Blockly.WidgetDiv.show(this, this.sourceBlock_.RTL, this.widgetDispose_());
  var div = Blockly.WidgetDiv.DIV;
  // Create the input.
  var htmlInput = goog.dom.createDom('textarea', 'blocklyHtmlInput');
  Blockly.FieldTextInput.htmlInput_ = htmlInput;
  htmlInput.style.resize = 'none';
  htmlInput.style['line-height'] = '20px';
  htmlInput.style.height = '100%';
  div.appendChild(htmlInput);

  htmlInput.value = htmlInput.defaultValue = this.text_;
  htmlInput.oldValue_ = null;
  this.validate_();
  this.resizeEditor_();
  if (!quietInput) {
    htmlInput.focus();
    htmlInput.select();
  }

  // Bind to keydown -- trap Enter without IME and Esc to hide.
  htmlInput.onKeyDownWrapper_ =
      Blockly.bindEvent_(htmlInput, 'keydown', this, this.onHtmlInputKeyDown_);
  // Bind to keyup -- trap Enter; resize after every keystroke.
  htmlInput.onKeyUpWrapper_ =
      Blockly.bindEvent_(htmlInput, 'keyup', this, this.onHtmlInputChange_);
  // Bind to keyPress -- repeatedly resize when holding down a key.
  htmlInput.onKeyPressWrapper_ =
      Blockly.bindEvent_(htmlInput, 'keypress', this, this.onHtmlInputChange_);
  var workspaceSvg = this.sourceBlock_.workspace.getCanvas();
  htmlInput.onWorkspaceChangeWrapper_ =
      Blockly.bindEvent_(workspaceSvg, 'blocklyWorkspaceChange', this,
      this.resizeEditor_);
};

/**
 * Handle key down to the editor.
 * @param {!Event} e Keyboard event.
 * @private
 */
Blockly.FieldTextInput.prototype.onHtmlInputKeyDown_ = function(e) {
  var htmlInput = Blockly.FieldTextInput.htmlInput_;
  var escKey = 27;
  if (e.keyCode == escKey) {
    this.setText(htmlInput.defaultValue);
    Blockly.WidgetDiv.hide();
  }
};

/**
 * Handle a change to the editor.
 * @param {!Event} e Keyboard event.
 * @private
 */
Blockly.FieldTextArea.prototype.onHtmlInputChange_ = function(e) {
  Blockly.FieldTextInput.prototype.onHtmlInputChange_.call(this, e);

  var htmlInput = Blockly.FieldTextInput.htmlInput_;
  if (e.keyCode == 27) {
    // Esc
    this.setText(htmlInput.defaultValue);
    Blockly.WidgetDiv.hide();
  } else {
    Blockly.FieldTextInput.prototype.onHtmlInputChange_.call(this, e);
	this.resizeEditor_();
  }
};

/**
 * Resize the editor and the underlying block to fit the text.
 * @private
 */
Blockly.FieldTextArea.prototype.resizeEditor_ = function() {
  var div = Blockly.WidgetDiv.DIV;
  var bBox = this.fieldGroup_.getBBox();
  div.style.width = bBox.width + 'px';
  div.style.height = bBox.height + 'px';
  var xy = this.getAbsoluteXY_();
  // In RTL mode block fields and LTR input fields the left edge moves,
  // whereas the right edge is fixed.  Reposition the editor.
  if (this.RTL) {
    var borderBBox = this.borderRect_.getBBox();
    xy.x += borderBBox.width;
    xy.x -= div.offsetWidth;
  }
  // Shift by a few pixels to line up exactly.
  xy.y += 1;
  if (goog.userAgent.WEBKIT) {
    xy.y -= 3;
  }
  div.style.left = xy.x + 'px';
  div.style.top = xy.y + 'px';
};

// ****************************************************************************
// Blockly - Test Area
// ****************************************************************************

Blockly.Msg.TEXT_TEXTAREA_HELPURL = "https://en.wikipedia.org/wiki/Text_box";
Blockly.Msg.TEXT_TEXTAREA_TOOLTIP = "A letter, word, or several lines of text.";

Blockly.Blocks[ "text_area" ] = {
	/**
	 * Block for multi-lines text value.
	 * @this Blockly.Block
	 */
	init: function() {
		this.setHelpUrl( Blockly.Msg.TEXT_TEXTAREA_HELPURL );
		this.setColour( Blockly.Blocks.texts.HUE );
		this.appendDummyInput()    
			.appendField( new Blockly.FieldTextArea( "" ), "TEXT" );
		this.setOutput( true, "String" );
		this.setTooltip( Blockly.Msg.TEXT_TEXTAREA_TOOLTIP );
	}
};

// ****************************************************************************
// Blockly - Rule
// ****************************************************************************

goog.provide( "Blockly.Blocks.rule" );

goog.require( "Blockly.Blocks" );

Blockly.Blocks[ "rule" ] = {
	hasToCheckDevice: false,

	init: function() {
		this.setColour(160);

		this.appendValueInput( "name" )
			.appendField( new Blockly.FieldCheckbox( "TRUE" ), "isEnabled" )
			.setCheck( "String" )
			.appendField( "Rule" );

		//var image = new Blockly.FieldImage('http://www.gstatic.com/codesite/ph/images/star_on.gif', 15, 15, '*');
		//input.appendField(image);

		this.appendValueInput( "description" )
			.setCheck( "String" )
			.appendField( "description" );

		// Properties (hooks)
		this.appendValueInput( "properties" )
			.setCheck( "Property" )
			.appendField( "properties" );

		// Conditions
		this.appendValueInput( "conditions" )
			.setCheck( "Boolean" )
			.appendField( "If" );

		// Actions
		this.appendDummyInput()
			.appendField( "Do" );
		this.appendStatementInput( "actions" )
			.setCheck( "Action" );

		this.setInputsInline(false);
		this.setTooltip( "" );
		this.setHelpUrl( "http://www.example.com/" );
	},

	onchange: function() {
		// Check if is enabled
		if ( this.getFieldValue( "isEnabled" ) === "TRUE" ) {
			if ( this.disabled ) {
				this.setDisabled( false );
			}
		} else {
			if ( !this.disabled ) {
				this.setDisabled( true );
			}
		}
	}
};

// ****************************************************************************
// Blockly - Rule properties
// ****************************************************************************

goog.provide( "Blockly.Blocks.properties" );

Blockly.Blocks.properties.HUE = 0;

Blockly.Blocks[ "list_property" ] = function() {}
goog.mixin( Blockly.Blocks[ "list_property" ], Blockly.Blocks[ "lists_create_with" ] );
Blockly.Blocks[ "list_property" ].updateShape_ = function() {
	this.setColour( Blockly.Blocks.properties.HUE );
	// Delete everything.
	if ( this.getInput( "EMPTY" ) ) {
		this.removeInput( "EMPTY" );
	} else {
		var i = 0;
		while ( this.getInput( "ADD" + i ) ) {
			this.removeInput( "ADD" + i );
			i++;
		}
	}
	// Rebuild block.
	if ( this.itemCount_ === 0 ) {
		this.appendDummyInput( "EMPTY" )
			//.appendField( Blockly.Msg.LISTS_CREATE_EMPTY_TITLE );
			.appendField( "no property" );
	} else {
		for ( var i = 0; i < this.itemCount_; i++ ) {
			var input = this.appendValueInput( "ADD" + i )
				.setCheck( "Property" );
		}
	}
	this.setInputsInline( false );
	if ( !this.outputConnection ) {
		this.setOutput( true, "Property" );
	} else {
		this.outputConnection.setCheck( "Property" )
	}
};

Blockly.Blocks[ "property_auto_untrip" ] = {
	init: function() {
		this.setColour( Blockly.Blocks.properties.HUE );

		this.appendDummyInput( "since" )
			.appendField( "auto untrip in" )
			.appendField (new Blockly.FieldTextInput( "0", Blockly.FieldTextInput.numberValidator ), "autoUntripInterval" )
			.appendField( new Blockly.FieldDropdown( [ [ "seconds", "S"], [ "minutes", "M" ], [ "hours", "H" ] ] ), "unit" );

		this.setInputsInline( true );
		this.setOutput( true, "Property" );
	}
};

// ****************************************************************************
// Blockly - Rule conditions
// ****************************************************************************

goog.provide( "Blockly.Blocks.conditions" );

goog.require( "Blockly.Blocks" );

Blockly.Blocks.conditions.HUE1 = 15;
Blockly.Blocks.conditions.HUE2 = 45;

Blockly.Msg.LIST_CONDITION_EMPTY_TITLE = "no condition";

Blockly.Blocks[ "list_with_operator_condition" ] = function() {}
goog.mixin( Blockly.Blocks[ "list_with_operator_condition" ], Blockly.Blocks[ "lists_create_with" ] );
Blockly.Blocks[ "list_with_operator_condition" ].updateShape_ = function() {
	this.setColour( Blockly.Blocks.conditions.HUE2 );
	// Delete everything.
	if ( this.getInput( "EMPTY" ) ) {
		this.removeInput( "EMPTY" );
	} else {
		var i = 0;
		while ( this.getInput( "ADD" + i ) ) {
			this.removeInput( "ADD" + i );
			i++;
		}
	}
	// Rebuild block.
	if ( this.itemCount_ === 0 ) {
		this.appendDummyInput( "EMPTY" )
			.appendField( Blockly.Msg.LIST_CONDITION_EMPTY_TITLE );
	} else {
		for ( var i = 0; i < this.itemCount_; i++ ) {
			var input = this.appendValueInput( "ADD" + i )
				.setCheck( "Boolean" );
			if ( i === 0 ) {
				input.appendField( new Blockly.FieldDropdown( [ [ "one is true", "OR" ], [ "all are true", "AND" ] ] ), "operator" );
			}
		}
	}
	this.setInputsInline( false );
	if ( !this.outputConnection ) {
		this.setOutput( true, "Boolean" );
	} else {
		this.outputConnection.setCheck( "Boolean" )
	}
};

// ****************************************************************************
// Blockly - Rule conditions - Types
// ****************************************************************************

function _isEmpty(str) {
	return (!str || 0 === str.length);
}

function _sortOptionsById ( a, b ) {
	if ( a[ 1 ] < b[ 1 ] ) {
		return -1;
	}
	if ( a[ 1 ] > b[ 1 ] ) {
		return 1;
	}
	return 0;
}

function _filterDevice( device, params ) {
	// Filter on controller
	if ( ( params.controllerId != null ) && ( MultiBox.controllerOf( device.altuiid ).controller !== params.controllerId ) ) {
		return false;
	}
	// Filter on room
	if ( !_isEmpty( params.roomId ) && ( _isEmpty( device.room ) || ( device.room.toString() !== params.roomId ) ) ) {
		return false;
	}
	// Filter on device
	if ( !_isEmpty( params.deviceId ) && ( params.deviceId !== "0" ) && ( device.id.toString() !== params.deviceId ) ) {
		return false;
	}
	// Filter on service and variable
	if ( !_isEmpty( params.service ) && !_isEmpty( params.variable ) ) {
		var isFounded = false;
		for ( var i = 0; i < device.states.length; i++ ) {
			if ( ( device.states[i].service === params.service ) && ( device.states[i].variable === params.variable ) ) {
				isFounded = true;
				break;
			}
		}
		if ( !isFounded) {
			return false;
		}
	} else {
		// Filter on service
		if ( !_isEmpty( params.service ) ) {
			var isServiceFounded = false;
			for ( var i = 0; i < device.states.length; i++ ) {
				if ( device.states[i].service === params.service ) {
					isServiceFounded = true;
					break;
				}
			}
			if ( !isServiceFounded) {
				return false;
			}
		}
		// Filter on variable
		if ( !_isEmpty( params.variable ) ) {
			var isVariableFounded = false;
			for ( var i = 0; i < device.states.length; i++ ) {
				if ( device.states[i].variable === params.variable ) {
					isVariableFounded = true;
					break;
				}
			}
			if ( !isVariableFounded) {
				return false;
			}
		}
	}
	// Filter on service for action
	if ( !_isEmpty( params.actionService ) && !_isEmpty( params.action ) ) {
		
	}
	// Filter on action
	return true;
}

function _updateRoomDropdownOptions() {
	var dropdown = this.getField( "roomId" );
	var options = dropdown.getOptions_();
	options.splice( 0, options.length );
	options.push( [ "all", "" ] );
	dropdown.setValue( "" );

	// TODO : stocker autre part le controllerId
	var controllerId = $( "#blocklyDiv" ).data( "controller_id" );
	if ( controllerId != null ) {
		controllerId = parseInt( controllerId, 10 );
	}
	var rooms = $.grep( MultiBox.getRoomsSync(), function( room, idx ) {
		return ( ( controllerId != null ) && ( MultiBox.controllerOf( room.altuiid ).controller === controllerId ) );
	} );
	$.each( rooms, function( idx, room ) {
		options.push( [ room.name, room.id.toString() ] ); 
	} );
}

function _updateDeviceDropdownOptions( params ) {
	var dropdown = this.getField( "deviceId" );
	var options = dropdown.getOptions_();
	options.splice( 0, options.length );
	options.push( [ "...", "0" ] );

	params.controllerId = $( "#blocklyDiv" ).data( "controller_id" );
	if ( params.roomId == null ) {
		params.roomId = this.getFieldValue( "roomId" );
	}
	var deviceId = params.deviceId;
	params.deviceId = null;
	if ( params.service == null ) {
		params.service = this.getFieldValue( "service" );
	}
	if ( params.variable == null ) {
		params.variable = this.getFieldValue( "variable" );
	}
	var indexDevices = {};
	MultiBox.getDevices(
		null,
		function ( device ) {
			return _filterDevice( device, params );
		},
		function( devices ) {
			$.each( devices, function( i, device ) {
				options.push( [ device.name, device.id.toString() ] );
				indexDevices[ device.id.toString() ] = device.name;
			} );
		}
	);
	if ( ( deviceId != null ) && ( deviceId != "0" ) ) {
		if ( indexDevices[ deviceId ] == null ) {
			// Device exists no more
			this.setWarningText("The device #" + deviceId + " with name '" + params.deviceName + "' no more exists.");
			dropdown.setValue( "0" );
			return false;
		} else {
			// TODO : should use ByAltuiID
			var device = MultiBox.getDeviceByID(deviceId);
			if ( ( device != null ) && ( device.name !== params.deviceName ) ) {
				this.setWarningText("The name of the selected device has changed.\nIt's no more '" + params.deviceName + "', but now '" + device.name + "'.");
			}
		}
	} else if ( ( this.getFieldValue( "deviceId" ) !== "0" ) && ( indexDevices[ this.getFieldValue( "deviceId" ) ] == null ) ) {
		dropdown.setValue( "0" );
	}
	return true;
};

function _updateServiceDropdownOptions( params ) {
	var dropdown = this.getField( "service" );
	var options = dropdown.getOptions_();
	options.splice( 0, options.length );
	options.push( [ "...", "" ] );

	params.controllerId = $( "#blocklyDiv" ).data( "controller_id" );
	params.roomId = this.getFieldValue( "roomId" );
	if ( params.deviceId == null ) {
		params.deviceId = this.getFieldValue( "deviceId" );
	}
	if ( params.variable == null ) {
		params.variable = this.getFieldValue( "variable" );
	}
	var indexServices = {};
	MultiBox.getDevices(
		null,
		function ( device ) {
			return _filterDevice( device, params );
		},
		function( devices ) {
			$.each( devices, function( i, device ) {
				$.each( device.states, function( j, state ) {
					if ( !_isEmpty( params.variable ) && ( state.variable !== params.variable ) ) {
						return;
					}
					if ( !indexServices[ state.service ] ) {
						options.push( [ state.service.substr( state.service.lastIndexOf( ":" ) + 1 ), state.service ] );
						//options.push( [ state.service, state.service ] );
					}
					indexServices[ state.service ] = true;
				} );
			} );
		}
	);
	if ( !indexServices[ this.getFieldValue( "service" ) ] ) {
		dropdown.setValue( "" );
	}
}

function _updateVariableDropdownOptions( params ) {
	var dropdown = this.getField( "variable" );
	var options = dropdown.getOptions_();
	options.splice(0, options.length);
	options.push( [ "...", "" ] );

	params.controllerId = $( "#blocklyDiv" ).data( "controller_id" );
	params.roomId = this.getFieldValue( "roomId" );
	if ( params.deviceId == null ) {
		params.deviceId = this.getFieldValue( "deviceId" );
	}
	if ( params.service == null ) {
		params.service = this.getFieldValue( "service" );
	}
	var indexVariables = {};
	MultiBox.getDevices(
		null,
		function ( device ) {
			return _filterDevice( device, params );
		},
		function( devices ) {
			$.each( devices, function( i, device ) {
				$.each( device.states, function( j, state ) {
					if ( !_isEmpty( params.service ) && ( state.service !== params.service ) ) {
						return;
					}
					if ( !indexVariables[ state.variable ] ) {
						options.push( [ state.variable, state.variable ] );
					}
					indexVariables[ state.variable ] = true;
				} );
			} );
		}
	);
	options.sort(_sortOptionsById);
	if ( !indexVariables[ this.getFieldValue( "variable" ) ] ) {
		dropdown.setValue( "" );
	}
}

function _updateActionServiceDropdownOptions( params ) {
	var dropdown = this.getField( "service" );
	var options = dropdown.getOptions_();
	options.splice( 0, options.length );
	options.push( [ "...", "" ] );

	params.controllerId = $( "#blocklyDiv" ).data( "controller_id" );
	params.roomId = this.getFieldValue( "roomId" );
	if ( params.deviceId == null ) {
		params.deviceId = this.getFieldValue( "deviceId" );
	}
	if ( params.variable == null ) {
		params.variable = this.getFieldValue( "variable" );
	}
	var indexServices = {};
	MultiBox.getDevices(
		null,
		function ( device ) {
			return _filterDevice( device, params );
		},
		function( devices ) {
			$.each( devices, function( i, device ) {
				MultiBox.getDeviceActions( device, function ( services ) {
					$.each( services, function ( i, service ) {
						if ( !indexServices[ service.ServiceId ] ) {
							options.push( [ service.ServiceId.substr(service.ServiceId.lastIndexOf(":") + 1 ), service.ServiceId ] );
						}
						indexServices[ service.ServiceId ] = true;
					} );
				} );
			} );
		}
	);
	if ( !indexServices[ this.getFieldValue( "service" ) ] ) {
		dropdown.setValue( "" );
	}
}

function _updateActionDropdownOptions( params ) {
	var dropdown = this.getField( "action" );
	var options = dropdown.getOptions_();
	options.splice(0, options.length);
	options.push( [ "...", "" ] );

	var thatBlock = this;
	this._actions = {};

	params.controllerId = $( "#blocklyDiv" ).data( "controller_id" );
	params.roomId = this.getFieldValue( "roomId" );
	if ( params.deviceId == null ) {
		params.deviceId = this.getFieldValue( "deviceId" );
	}
	if ( params.service == null ) {
		params.service = this.getFieldValue( "service" );
	}
	var indexActions = {};
	MultiBox.getDevices(
		null,
		function ( device ) {
			return _filterDevice( device, params );
		},
		function( devices ) {
			$.each( devices, function( i, device ) {
				MultiBox.getDeviceActions( device, function ( services ) {
					$.each( services, function ( j, service ) {
						if ( _isEmpty( params.actionService ) || (service.ServiceId === params.actionService) ) {
							$.each( service.Actions, function ( k, action ) {
								if ( thatBlock._actions[ action.name ] == null ) {
									options.push( [ action.name, action.name ] );
								}
								thatBlock._actions[ action.name ] = action;
							});
						}
					} );
				} );
			} );
		}
	);
	/*if ( this.actionServices_ != null ) {
		$.each( this.actionServices_, function( i, service ) {
			if ( _isEmpty( params.service ) || (service.ServiceId === params.service) ) {
				$.each( service.Actions, function ( j, action ) {
					if ( !indexActions[ action.name ] ) {
						options.push( [ action.name, action.name ] );
					}
					indexActions[ action.name ] = true;
				});
			}
		});
	}*/
	options.sort(_sortOptionsById);
	if ( this._actions[ this.getFieldValue( "action" ) ] == null ) {
		dropdown.setValue( "" );
		_updateActionShape.call( this );
	}
}

function _updateActionShape( actionName ) {
	if ( this.getInput( "params" ) ) {
		this.removeInput( "params" );
	}
	if ( _isEmpty( actionName ) ) {
		return;
	}
	var input = this.appendDummyInput( "params" );
	if ( ( this._actions[ actionName ] != null ) && ( this._actions[ actionName ].input != null ) ) {
		if ( this._actions[ actionName ].input.length > 0 ) {
			input.appendField( "with {" );
			$.each( this._actions[ actionName ].input, function ( i, inputName ) {
				if ( i > 0 ) {
					input.appendField( ", " );
				}
				input
					.appendField( inputName + " :" )
					.appendField( new Blockly.FieldTextInput( "" ), inputName );
			} );
			input.appendField( "}" );
		}
	}
}

Blockly.Blocks[ "condition_value" ] = {
	init: function() {
		var OPERATORS = this.RTL ? [
			[ "=", "EQ" ],
			[ "\u2260", "NEQ" ],
			[ ">", "LT" ],
			[ "\u2265", "LTE" ],
			[ "<", "GT" ],
			[ "\u2264", "GTE" ],
			[ "like", "LIKE" ],
			[ "not like", "NOTLIKE" ]
		] : [
			[ "=", "EQ" ],
			[ "\u2260", "NEQ" ],
			[ "<", "LT" ],
			[ "\u2264", "LTE" ],
			[ ">", "GT" ],
			[ "\u2265", "GTE" ],
			[ "like", "LIKE" ],
			[ "not like", "NOTLIKE" ]
		];
		this.setColour( Blockly.Blocks.conditions.HUE1 );

		// Room
		this.appendDummyInput()
			.appendField( "for room" )
			.appendField(
				new Blockly.FieldDropdown( [ [ "all", "" ] ], function( newRoomId ) {
					_updateDeviceDropdownOptions.call( this.sourceBlock_, { roomId: newRoomId } );
					_updateServiceDropdownOptions.call( this.sourceBlock_, {} );
					_updateVariableDropdownOptions.call( this.sourceBlock_, {} );
				} ),
				"roomId"
			)

		// Device
		//this.appendDummyInput()
			.appendField( "device" )
			.appendField(
				new Blockly.FieldDropdown( [ [ "...", "0" ] ], function( newDeviceId ) {
					this.sourceBlock_.setWarningText();
					_updateServiceDropdownOptions.call( this.sourceBlock_, { deviceId: newDeviceId } );
					_updateVariableDropdownOptions.call( this.sourceBlock_, { deviceId: newDeviceId } );
				} ),
				'deviceId'
			);

		// Service
		this.appendDummyInput()
			.appendField( "service" )
			.appendField(
				new Blockly.FieldDropdown( [ [ "...", "" ] ], function( newService ) {
					_updateDeviceDropdownOptions.call( this.sourceBlock_, { service: newService } );
					_updateVariableDropdownOptions.call( this.sourceBlock_, { service: newService } );
				} ),
				'service'
			);

		// Variable
		this.appendDummyInput()
			.appendField( "variable" )
			.appendField(
				new Blockly.FieldDropdown( [ [ "...", "" ] ], function( newVariable ) {
					_updateDeviceDropdownOptions.call( this.sourceBlock_, { variable: newVariable } );
					_updateServiceDropdownOptions.call( this.sourceBlock_, { variable: newVariable } );
				} ), 
				"variable"
			)//;

		// Operator
		//this.appendDummyInput()
			.appendField( " " )
			.appendField( new Blockly.FieldDropdown( OPERATORS ), "operator" )//;

		// Expected value
		//this.appendDummyInput()
			.appendField( " " )
			.appendField( new Blockly.FieldTextInput( "" ), "value" );

		this.appendValueInput( "params" )
			//.appendField( "with" )
			.appendField( " " )
			.setCheck( "ConditionParam" );

		this.setInputsInline( true );
		this.setOutput( true, "Boolean" );
	},

	mutationToDom: function() {
		var container = document.createElement( "mutation" );
		container.setAttribute( "room_id", this.getFieldValue( "roomId" ) );
		container.setAttribute( "device_name", this.getField( "deviceId" ).getText() );
		container.setAttribute( "device_id", this.getFieldValue( "deviceId" ) );
		container.setAttribute( "service", this.getFieldValue( "service" ) );
		container.setAttribute( "variable", this.getFieldValue( "variable" ) );
		return container;
	},

	domToMutation: function( xmlElement ) {
		var roomId, deviceId, deviceName, service, variable;
		if ( xmlElement != null ) {
			roomId     = xmlElement.getAttribute( "room_id" );
			deviceId   = xmlElement.getAttribute( "device_id" );
			deviceName = xmlElement.getAttribute( "device_name" ); // TODO : à utiliser pour détecter changement de config
			service    = xmlElement.getAttribute( "service" );
			variable   = xmlElement.getAttribute( "variable" );
		}
		_updateRoomDropdownOptions.call( this );
		//if (!_updateDeviceDropdownOptions.call( this, { roomId: roomId, deviceId: deviceId, deviceName: deviceName, service: service, variable: variable } )) {
		if (!_updateDeviceDropdownOptions.call( this, { deviceId: deviceId, deviceName: deviceName, service: service, variable: variable } )) {
			deviceId = "0";
		}
		_updateServiceDropdownOptions.call( this, { deviceId: deviceId, variable: variable } );
		_updateVariableDropdownOptions.call( this, { deviceId: deviceId, service: service } );
	}
};

Blockly.Blocks['condition_time'] = {
	init: function() {
		this.setColour( Blockly.Blocks.conditions.HUE1 );

		// Time
		this.appendDummyInput( "time" )
			.appendField( "time" )
			.appendField(
				new Blockly.FieldDropdown( [ [ "is", "EQ" ], [ "is between", "BW" ] ], function( option ) {
					this.sourceBlock_.updateShape_( "operator", option );
				} ),
				"operator"
			);

		// Type of timer
		this.appendDummyInput( "timerType" )
			.appendField(
				new Blockly.FieldDropdown( [ [ "on days of week", "WEEK" ], [ "on days of month", "MONTH" ] ], function( option ) {
					this.sourceBlock_.updateShape_( "timerType", option );
				} ),
				"timerType"
			);

		this.appendValueInput( "params" )
			//.appendField( "with" )
			.appendField( " " )
			.setCheck( "ConditionParams", "ConditionParam" );

		this.setInputsInline( true );
		this.setOutput( true, "Boolean" );
	},

	onchange: function() {
		if ((this.getFieldValue('time') != null) && (this.getFieldValue('time').match(/^\d\d:\d\d$/) == null)) {
			this.setWarningText("Time format must be 'hh:mm:ss'");
		} else if ((this.getFieldValue('time1') != null) && (this.getFieldValue('time1').match(/^\d\d:\d\d$/) == null)) {
			this.setWarningText("First time format must be 'hh:mm:ss'");
		} else if ((this.getFieldValue('time2') != null) && (this.getFieldValue('time2').match(/^\d\d:\d\d$/) == null)) {
			this.setWarningText("Second time format must be 'hh:mm:ss'");
		} else {
			this.setWarningText(null);
		}
	},

	mutationToDom: function () {
		var container = document.createElement('mutation');
		container.setAttribute('operator', this.getFieldValue('operator'));
		container.setAttribute('timer_type', this.getFieldValue('timerType'));
		return container;
	},

	domToMutation: function (xmlElement) {
		var operator = xmlElement.getAttribute('operator');
		this.updateShape_('operator', operator);
		var timerType = xmlElement.getAttribute('timer_type');
		this.updateShape_('timerType', timerType);
	},

	updateShape_: function (type, option) {
		if (type === 'operator') {
			var inputTime = this.getInput('time');
			if (this.getField('time') != null) {
				inputTime.removeField('time');
			}
			if (this.getField('time1') != null) {
				inputTime.removeField('time1');
				inputTime.removeField('between_and');
				inputTime.removeField('time2');
			}
			if (option === 'EQ') {
				inputTime
					.appendField(new Blockly.FieldTextInput('hh:mm:ss'), 'time');
			} else {
				inputTime
					.appendField(new Blockly.FieldTextInput('hh:mm:ss'), 'time1')
					.appendField('and', 'between_and')
					.appendField(new Blockly.FieldTextInput('hh:mm:ss'), 'time2');
			}
		} else if (type === 'timerType') {
			var inputTimerType = this.getInput('timerType');
			if (this.getField('daysOfWeek') != null) {
				inputTimerType.removeField('daysOfWeek');
			}
			if (this.getField('daysOfMonth') != null) {
				inputTimerType.removeField('daysOfMonth');
			}
			if (option === 'WEEK') {
				inputTimerType
					.appendField(new Blockly.FieldTextInput(''), 'daysOfWeek');
			} else {
				inputTimerType
					.appendField(new Blockly.FieldTextInput(''), 'daysOfMonth');
			}
		}
	}
};

Blockly.Blocks[ "condition_rule" ] = {
	init: function() {
		this.setColour( Blockly.Blocks.conditions.HUE1 );

		this.appendDummyInput()
			.appendField( "rule" )
			.appendField( new Blockly.FieldTextInput( "" ), "rule" );

		this.appendDummyInput()
			.appendField( "is" )
			.appendField( new Blockly.FieldDropdown( [ [ "active", "1" ], [ "inactive", "0" ] ] ), "status" );

		this.appendValueInput( "params" )
			//.appendField( "with" )
			.appendField( " " )
			.setCheck( "ConditionParams", "ConditionParam" );

		this.setInputsInline( true );
		this.setOutput( true, "Boolean" );
	}
};

/*
Blockly.Blocks[ "condition_value_templates" ] = {
	init: function() {
		var TEMPLATES = {
			"urn:schemas-micasaverde-com:service:SecuritySensor:1": [ "is tripped and armed", "tripped_on" ]
		};
		
		this.setColour( Blockly.Blocks.conditions.HUE1 );

		this.appendDummyInput()
			// Room
			.appendField( "for room" )
			.appendField(
				new Blockly.FieldDropdown( [ [ "all", "" ] ], function( newRoomId ) {
					_updateDeviceDropdownOptions.call( this.sourceBlock_, { roomId: newRoomId } );
				} ),
				"roomId"
			)
			// Device
			.appendField( "device" )
			.appendField(
				new Blockly.FieldDropdown( [ [ "...", "0" ] ] ),
				'deviceId'
			)
			.appendField( "is" )
			.appendField(
				new Blockly.FieldDropdown( [
					[ "is", "EQ" ],
					[ "is between", "BW" ]
				], function( option ) {
					this.sourceBlock_.updateShape_( "operator", option );
				} ),
				"operator"
			);

		this.appendValueInput( "params" )
			.appendField( " " )
			.setCheck( "ConditionParam" );

		this.setInputsInline( true );
		this.setOutput( true, "Boolean" );
}
*/

// ****************************************************************************
// Blockly - Rule conditions - Params
// ****************************************************************************

Blockly.Blocks[ "list_condition_param" ] = function() {}
goog.mixin( Blockly.Blocks[ "list_condition_param" ], Blockly.Blocks[ "lists_create_with" ] );
Blockly.Blocks[ "list_condition_param" ].updateShape_ = function() {
	this.setColour( Blockly.Blocks.conditions.HUE1 );
	// Delete everything.
	if ( this.getInput( "EMPTY" ) ) {
		this.removeInput( "EMPTY" );
	} else {
		var i = 0;
		while ( this.getInput( "ADD" + i ) ) {
			this.removeInput( "ADD" + i );
			i++;
		}
	}
	// Rebuild block.
	if ( this.itemCount_ === 0 ) {
		this.appendDummyInput( "EMPTY" )
			//.appendField(Blockly.Msg.LISTS_CREATE_EMPTY_TITLE);
			.appendField( "no param" );
	} else {
		for ( var i = 0; i < this.itemCount_; i++ ) {
			var input = this.appendValueInput( "ADD" + i )
				.setCheck( "ConditionParam" );
			if (i === 0) {
				//input.appendField( Blockly.Msg.LISTS_CREATE_WITH_INPUT_WITH );
				//input.appendField( "with params" );
			}
		}
	}
	this.setInputsInline( true );
	if ( !this.outputConnection ) {
		this.setOutput( true, "ConditionParam" );
	} else {
		this.outputConnection.setCheck( "ConditionParam" )
	}
};

Blockly.Blocks[ "condition_param_level" ] = {
	init: function() {
		this.setColour( Blockly.Blocks.conditions.HUE2 );

		this.appendDummyInput()
			.appendField( "level" )
			.appendField( new Blockly.FieldTextInput( "0", Blockly.FieldTextInput.numberValidator ), "level" );

		this.setInputsInline( true );
		this.setOutput( true, "ConditionParam" );
	}
};

Blockly.Blocks[ "condition_param_since" ] = {
	init: function() {
		this.setColour( Blockly.Blocks.conditions.HUE2 );

		this.appendDummyInput( "since" )
			.appendField( "since" )
			.appendField (new Blockly.FieldTextInput( "0", Blockly.FieldTextInput.numberValidator ), "sinceInterval" )
			.appendField( new Blockly.FieldDropdown( [ [ "seconds", "S"], [ "minutes", "M" ], [ "hours", "H" ] ] ), "unit" );

		this.setInputsInline( true );
		this.setOutput( true, "ConditionParam" );
	}
};

// ****************************************************************************
// Blockly - Rule actions
// ****************************************************************************

goog.provide( "Blockly.Blocks.actions" );

goog.require( "Blockly.Blocks" );

Blockly.Blocks.actions.HUE1 = 225;
Blockly.Blocks.actions.HUE2 = 195;

Blockly.Blocks[ "action_group" ] = {
	init: function() {
		this.setColour( Blockly.Blocks.actions.HUE1 );

		// Event
		this.appendDummyInput()
			.appendField( "for event" )
			.appendField(
				new Blockly.FieldDropdown( [ [ "start", "start" ], [ "reminder", "reminder" ], [ "end", "end" ] ], function( option ) {
					var recurrentIntervalInput = ( option === "reminder" );
					this.sourceBlock_.updateShape_( recurrentIntervalInput );
				} ),
				"event"
			);

		this.appendValueInput( "params" )
			//.appendField('with')
			.appendField( "" )
			.setCheck( "ActionParam" );

		this.appendStatementInput( "do" )
			.setCheck( "ActionType" )
			.appendField( "do" );

		this.setInputsInline( true );
		this.setPreviousStatement( true, "Action" );
		this.setNextStatement( true, "Action" );
	},

	mutationToDom: function() {
		var container = document.createElement( "mutation" );
		var recurrentIntervalInput = (this.getFieldValue( "event" ) === "reminder" );
		container.setAttribute( "recurrent_interval_input", recurrentIntervalInput );
		return container;
	},

	domToMutation: function( xmlElement ) {
		var recurrentIntervalInput = ( xmlElement.getAttribute( "recurrent_interval_input" ) === "true" );
		this.updateShape_( recurrentIntervalInput );
	},

	updateShape_: function( recurrentIntervalInput ) {
		// Add or remove a Value Input.
		var inputExists = this.getInput( "recurrentInterval" );
		if ( recurrentIntervalInput ) {
			if ( !inputExists ) {
				// Recurrent interval
				this.appendDummyInput( "recurrentInterval" )
					.appendField( "every" )
					.appendField( new Blockly.FieldTextInput( "0", Blockly.FieldTextInput.numberValidator ), "recurrentInterval" )
					.appendField( new Blockly.FieldDropdown( [ [ "seconds", "S" ], [ "minutes", "M" ], [ "hours", "H" ] ] ), "unit" );
				this.moveInputBefore( "recurrentInterval", "params" );
			}
		} else if ( inputExists ) {
			this.removeInput( "recurrentInterval" );
		}
	}
};

// ****************************************************************************
// Blockly - Rule actions - Types
// ****************************************************************************

Blockly.Blocks['action_function'] = {
	init: function () {
		this.setColour(Blockly.Blocks.actions.HUE2);

		this.appendDummyInput()
			.appendField('LUA function :');
		this.appendDummyInput()
			.appendField(new Blockly.FieldTextArea(''), 'functionContent');

		this.setPreviousStatement(true, 'ActionType');
		this.setNextStatement(true, 'ActionType');
		//this.setTooltip('Returns number of letters in the provided text.');
	}
};

Blockly.Blocks['action_device'] = {
	init: function () {
		this.services_ = [];
		this.setColour(Blockly.Blocks.actions.HUE2);

		this.appendDummyInput()
			.appendField('Device action');

		// Room
		this.appendDummyInput()
			.appendField( "room" )
			.appendField(
				new Blockly.FieldDropdown( [ [ "all", "" ] ], function( newRoomId ) {
					_updateDeviceDropdownOptions.call( this.sourceBlock_, { roomId: newRoomId } );
					_updateActionServiceDropdownOptions.call( this.sourceBlock_, {} );
					_updateActionDropdownOptions.call( this.sourceBlock_, {} );
				} ),
				"roomId"
			)//;

		// Device
		//this.appendDummyInput()
			.appendField( "name" )
			.appendField(
				new Blockly.FieldDropdown( [ [ "...", "0" ] ], function( newDeviceId ) {
					_updateActionServiceDropdownOptions.call( this.sourceBlock_, { deviceId: newDeviceId } );
					_updateActionDropdownOptions.call( this.sourceBlock_, { deviceId: newDeviceId } );
				} ),
				"deviceId"
			);

		// Service
		this.appendDummyInput()
			.appendField( "service" )
			.appendField(
				new Blockly.FieldDropdown( [ [ "...", "" ] ], function( newService ) {
					_updateDeviceDropdownOptions.call( this.sourceBlock_, { actionService: newService } );
					_updateActionDropdownOptions.call( this.sourceBlock_, { actionService: newService } );
				} ),
				"service"
			)//;

		// Action
		//this.appendDummyInput()
			.appendField( "action" )
			.appendField(
				new Blockly.FieldDropdown( [ [ "...", "" ] ], function( newAction ) {
					_updateDeviceDropdownOptions.call( this.sourceBlock_, { action: newAction } );
					_updateActionServiceDropdownOptions.call( this.sourceBlock_, { action: newAction } );
					_updateActionShape.call( this.sourceBlock_, newAction );
				} ),
				"action"
			);

		this.setInputsInline(false);
		this.setPreviousStatement(true, 'ActionType');
		this.setNextStatement(true, 'ActionType');
		//this.setTooltip('Returns number of letters in the provided text.');
	},

	mutationToDom: function() {
		var container = document.createElement( "mutation" );
		container.setAttribute( "room_id", this.getFieldValue( "roomId" ) );
		container.setAttribute( "device_id", this.getFieldValue( "deviceId" ) );
		container.setAttribute( "device_name", this.getField( "deviceId" ).getText() );
		container.setAttribute( "service", this.getFieldValue( "service" ) );
		container.setAttribute( "action", this.getFieldValue( "action" ) );
		return container;
	},

	domToMutation: function( xmlElement ) {
		var roomId, deviceId, deviceName, service, action;
		if ( xmlElement != null ) {
			roomId     = xmlElement.getAttribute( "room_id" );
			deviceId   = xmlElement.getAttribute( "device_id" );
			deviceName = xmlElement.getAttribute( "device_name" ); // TODO : à utiliser pour détecter changement de config
			service    = xmlElement.getAttribute( "service" );
			action     = xmlElement.getAttribute( "action" );
		}
		_updateRoomDropdownOptions.call( this );
		_updateDeviceDropdownOptions.call( this, { roomId: roomId, actionService: service, action: action } );
		_updateActionServiceDropdownOptions.call( this, { deviceId: deviceId, action: action } );
		_updateActionDropdownOptions.call( this, { deviceId: deviceId, actionService: service } );
		_updateActionShape.call( this, action );
	}
};

// ****************************************************************************
// Blockly - Rule actions - Params
// ****************************************************************************

Blockly.Blocks['list_action_param'] = function() {}
goog.mixin(Blockly.Blocks['list_action_param'], Blockly.Blocks['lists_create_with']);
Blockly.Blocks['list_action_param'].updateShape_ = function() {
	this.setColour(Blockly.Blocks.actions.HUE1);
	// Delete everything.
	if (this.getInput('EMPTY')) {
		this.removeInput('EMPTY');
	} else {
		var i = 0;
		while (this.getInput('ADD' + i)) {
			this.removeInput('ADD' + i);
			i++;
		}
	}
	// Rebuild block.
	if (this.itemCount_ == 0) {
		this.appendDummyInput('EMPTY')
			//.appendField(Blockly.Msg.LISTS_CREATE_EMPTY_TITLE);
			.appendField("no param");
	} else {
		for (var i = 0; i < this.itemCount_; i++) {
			var input = this.appendValueInput('ADD' + i)
				.setCheck('ActionParam');
			if (i == 0) {
				//input.appendField(Blockly.Msg.LISTS_CREATE_WITH_INPUT_WITH);
				//input.appendField("with params");
			}
		}
	}
	this.setInputsInline(true);
	if (!this.outputConnection) {
		this.setOutput(true, 'ActionParam');
	} else {
		this.outputConnection.setCheck('ActionParam')
	}
};

Blockly.Blocks['action_param_level'] = {
	init: function () {
		this.setColour(Blockly.Blocks.actions.HUE2);

		this.appendDummyInput()
			.appendField('for level')
			.appendField(new Blockly.FieldTextInput('0', Blockly.FieldTextInput.numberValidator), 'level');

		this.setInputsInline(true);
		this.setOutput(true, 'ActionParam');
	}
};

Blockly.Blocks['action_param_delay'] = {
	init: function () {
		this.setColour(Blockly.Blocks.actions.HUE2);

		this.appendDummyInput('delayInterval')
			.appendField('after')
			.appendField(new Blockly.FieldTextInput('0', Blockly.FieldTextInput.numberValidator), 'delayInterval')
			.appendField(new Blockly.FieldDropdown([['seconds', 'S'], ['minutes', 'M'], ['hours', 'H']]), 'unit');

		this.setInputsInline(true);
		this.setOutput(true, 'ActionParam');
	}
};
