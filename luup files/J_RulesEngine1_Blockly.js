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

goog.require( "Blockly.Blocks" );
goog.require( "Blockly.Msg" );

// Custom colors
// http://www.rapidtables.com/web/color/color-picker.htm
/**
 * The richness of block colours, regardless of the hue.
 * Must be in the range of 0 (inclusive) to 1 (exclusive).
 */
//Blockly.HSV_SATURATION = 0.45;
Blockly.HSV_SATURATION = 0.70;
/**
 * The intensity of block colours, regardless of the hue.
 * Must be in the range of 0 (inclusive) to 1 (exclusive).
 */
//Blockly.HSV_VALUE = 0.65;
Blockly.HSV_VALUE = 0.65;


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
// Blockly - Text Area
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
// Blockly - Field CodeArea
// ****************************************************************************
 
goog.provide('Blockly.FieldCodeArea');

goog.require('Blockly.FieldTextInput');
goog.require('Blockly.Msg');
goog.require('goog.asserts');
goog.require('goog.dom');
goog.require('goog.userAgent');

/**
 * Class for an editable code field.
 * @param {string} text The initial content of the field.
 * @param {Function} opt_changeHandler An optional function that is called
 *     to validate any constraints on what the user entered.  Takes the new
 *     text as an argument and returns either the accepted text, a replacement
 *     text, or null to abort the change.
 * @extends {Blockly.Field}
 * @constructor
 */
Blockly.FieldCodeArea = function(text, opt_changeHandler) {
  Blockly.FieldCodeArea.superClass_.constructor.call(this, text, opt_changeHandler);
};
goog.inherits(Blockly.FieldCodeArea, Blockly.FieldTextInput);

/**
 * Update the text node of this field to display the current text.
 * @private
 */
Blockly.FieldCodeArea.prototype.updateTextNode_ = function() {
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
Blockly.FieldCodeArea.prototype.render_ = function() {
	this.size_.width = this.textElement_.getBBox().width + 5;
	//this.size_.height = ( this.text_.split( /\n/ ).length || 1 ) * 20 + ( Blockly.BlockSvg.SEP_SPACE_Y + 5 );
	this.size_.height = ( this.text_.split( /\n/ ).length || 1 ) * 18 + ( Blockly.BlockSvg.SEP_SPACE_Y + 5 );
	if ( this.borderRect_ ) {
		this.borderRect_.setAttribute( "width", this.size_.width + Blockly.BlockSvg.SEP_SPACE_X );
		this.borderRect_.setAttribute( "height", this.size_.height - ( Blockly.BlockSvg.SEP_SPACE_Y + 5 ) );
	}
};

/**
 * Show the inline free-text editor on top of the text.
 * @param {boolean=} opt_quietInput True if editor should be created without
 *     focus.  Defaults to false.
 * @private
 */
Blockly.FieldCodeArea.prototype.showEditor_ = function(opt_quietInput) {
	var quietInput = opt_quietInput || false;
	var self = this;
	ALTUI_RulesEngine.showLuaEditor( this.text_, function( newValue) {
		self.setText.call( self, newValue );
	} );
};

// ****************************************************************************
// Blockly - Field Lua code
// ****************************************************************************

Blockly.Msg.LUA_CODE_HELPURL = "http://www.lua.org/";
Blockly.Msg.LUA_CODE_TOOLTIP = "A LUA code.";

Blockly.Blocks[ "lua_code" ] = {
	/**
	 * Block for multi-lines text value.
	 * @this Blockly.Block
	 */
	init: function() {
		this.setHelpUrl( Blockly.Msg.LUA_CODE_HELPURL );
		this.setColour( Blockly.Blocks.texts.HUE );
		this.appendDummyInput()    
			.appendField( new Blockly.FieldCodeArea( "" ), "TEXT" );
		this.setOutput( true, "String" );
		this.setTooltip( Blockly.Msg.LUA_CODE_TOOLTIP );
	}
};

// ****************************************************************************
// Blockly - Rule
// ****************************************************************************

goog.provide( "Blockly.Blocks.rules" );
Blockly.Blocks.rules.HUE = 140;

Blockly.Msg.RULE_TITLE = "Rule";
Blockly.Msg.RULE_TOOLTIP = "A LUA code.";

Blockly.Blocks[ "rule" ] = {
	hasToCheckDevice: false,

	init: function() {
		this.setColour( Blockly.Blocks.rules.HUE );

		var thatBlock = this;
		this.appendValueInput( "name" )
			.setCheck( "String" )
			.appendField( "Rule #" )
			.appendField( new Blockly.FieldTextInput( "", function ( text ) {
				thatBlock.setWarningText( "You should not modify the id of a rule,\nunless you know exactly what you are doing.\nIf it's a new rule, let the id empty,\nthe engine will calculate it." );
				return text;
			} ), "id" );

		//var image = new Blockly.FieldImage('http://www.gstatic.com/codesite/ph/images/star_on.gif', 15, 15, '*');
		//input.appendField(image);

		this.appendValueInput( "description" )
			.setCheck( "String" )
			.appendField( "description" );

		// Properties
		this.appendValueInput( "properties" )
			.setCheck( [ "Properties", "Property" ] )
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
		this.setTooltip( Blockly.Msg.RULE_TITLE );
		this.setHelpUrl( "http://www.example.com/" );
	},

	onchange: function() {
		// Check if is enabled
		/*
		if ( this.getFieldValue( "isEnabled" ) === "TRUE" ) {
			if ( this.disabled ) {
				this.setDisabled( false );
			}
		} else {
			if ( !this.disabled ) {
				this.setDisabled( true );
			}
		}
		*/
	}
};

// ****************************************************************************
// Blockly - Rule properties
// ****************************************************************************

goog.provide( "Blockly.Blocks.properties" );
Blockly.Blocks.properties.HUE = 160;

Blockly.Msg.LIST_PROPERTY_TOOLTIP = "A LUA code.";
Blockly.Msg.LIST_RULE_PROPERTY_TOOLTIP = "List of rule properties";
Blockly.Msg.LIST_RULE_PROPERTY_CREATE_EMPTY_TITLE = "no property";
Blockly.Msg.RULE_PROPERTY_AUTO_UNTRIP_TOOLTIP = "Defines the time after which the rule is switched off automatically.";
Blockly.Msg.RULE_PROPERTY_IS_ACKNOWLEDGEABLE_TOOLTIP = "Defines if this rule is acknowledgeable.";


Blockly.Blocks[ "list_property" ] = function() {};
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
			.appendField( Blockly.Msg.LIST_RULE_PROPERTY_CREATE_EMPTY_TITLE );
	} else {
		for ( var i = 0; i < this.itemCount_; i++ ) {
			var input = this.appendValueInput( "ADD" + i )
				.setCheck( "Property" );
		}
	}
	this.setInputsInline( false );
	if ( !this.outputConnection ) {
		this.setOutput( true, "Properties" );
	} else {
		this.outputConnection.setCheck( "Properties" );
	}
	this.setTooltip(Blockly.Msg.LIST_RULE_PROPERTY_TOOLTIP);
};

// TODO
Blockly.Blocks[ "property_auto_untrip" ] = {
	init: function() {
		this.setColour( Blockly.Blocks.properties.HUE );

		this.appendDummyInput()
			.appendField( "(TODO) auto untrip in" )
			.appendField( new Blockly.FieldTextInput( "0", Blockly.FieldTextInput.numberValidator ), "autoUntripInterval" )
			.appendField( new Blockly.FieldDropdown( [ [ "seconds", "S"], [ "minutes", "M" ], [ "hours", "H" ] ] ), "unit" );

		this.setInputsInline( true );
		this.setOutput( true, "Property" );
		this.setTooltip(Blockly.Msg.RULE_PROPERTY_AUTO_UNTRIP_TOOLTIP);
	}
};

Blockly.Blocks[ "property_is_acknowledgeable" ] = {
	init: function() {
		this.setColour( Blockly.Blocks.properties.HUE );

		this.appendDummyInput()
			.appendField( "is" )
			.appendField( new Blockly.FieldDropdown( [ [ "acknowledgeable", "TRUE" ], [ "not acknowledgeable", "FALSE" ] ] ), "isAcknowledgeable" );

		this.setInputsInline( true );
		this.setOutput( true, "Property" );
		this.setTooltip(Blockly.Msg.RULE_PROPERTY_IS_ACKNOWLEDGEABLE_TOOLTIP);
	}
};

// ****************************************************************************
// Blockly - Devices
// ****************************************************************************

goog.require( "Blockly.Blocks" );

goog.provide( "Blockly.Blocks.devices" );
Blockly.Blocks.devices.HUE = 320;

Blockly.Msg.LIST_DEVICE_TOOLTIP = "List of devices";
Blockly.Msg.LIST_DEVICE_CREATE_EMPTY_TITLE = "no device";

Blockly.Blocks[ "list_device" ] = function() {};
goog.mixin( Blockly.Blocks[ "list_device" ], Blockly.Blocks[ "lists_create_with" ] );
Blockly.Blocks[ "list_device" ].updateShape_ = function() {
	this.setColour( Blockly.Blocks.devices.HUE );
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
			.appendField( Blockly.Msg.LIST_DEVICE_CREATE_EMPTY_TITLE );
	} else {
		for ( var i = 0; i < this.itemCount_; i++ ) {
			var input = this.appendValueInput( "ADD" + i )
				.setCheck( "Device" );
		}
	}
	this.setInputsInline( true );
	if ( !this.outputConnection ) {
		this.setOutput( true, "Devices" );
	} else {
		this.outputConnection.setCheck( "Devices" );
	}
	this.setTooltip(Blockly.Msg.LIST_DEVICE_TOOLTIP);
};

// ****************************************************************************
// Blockly - Generic functions
// ****************************************************************************

// http://wiki.micasaverde.com/index.php/Luup_Device_Categories
var _CATEGORIES = {
	"1": "Interface",
	"2": "Dimmable",
	"3": "Switch",
	"4": "Security sensor",
	"4,1": "Door Sensor",
	"4,2": "Leak Sensor",
	"4,3": "Motion Sensor",
	"4,4": "Smoke Sensor",
	"4,5": "CO Sensor",
	"4,6": "Glass Break Sensor",
	"5": "HVAC",
	"6": "Camera",
	"7": "Door Lock",
	"8": "Window Covering",
	"16": "Humidity Sensor",
	"17": "Temperature Sensor",
	"18": "Light Sensor"
};

var _INPUTS = {
	"device_id"       : { "type": "deviceFilter", "input": "device_id",        "field": "deviceId", "label": "name" },
	"device_room"     : { "type": "deviceFilter", "input": "device_room",      "field": "roomId", "label": "in room" },
	"device_type"     : { "type": "deviceFilter", "input": "device_type",      "field": "deviceType", "label": "type" },
	"device_category" : { "type": "deviceFilter", "input": "device_category",  "field": "category", "label": "category" },
	"variable_service": { "type": "deviceFilter", "input": "variable_service", "field": "service", "label": "service" },
	"variable"        : { "type": "deviceFilter", "input": "variable",         "field": "variable", "label": "variable" },
	"action_service"  : { "type": "deviceFilter", "input": "action_service",   "field": "service", "label": "service" },
	"action"          : { "type": "deviceFilter", "input": "action",           "field": "action", "label": "action" },
	"action_params"   : { "type": "deviceFilter", "input": "action_params",    "field": "params", "label": "with params" },
	"action_group_params"    : { "type": "value", "input": "params",     "label": "with param", "align": "ALIGN_RIGHT", "check": [ "ActionParams", "ActionParam" ], "before": [ "conditions", "do" ] },
	"action_group_conditions": { "type": "value", "input": "conditions", "label": "if",         "align": "ALIGN_RIGHT", "check": "Boolean", "before": [ "do" ] }
};

function _isEmpty(str) {
	return (!str || 0 === str.length);
}

function _filterDevice( device, criterias ) {
	if ( criterias == null ) {
		return true;
	}
	// Filter on controller
	if ( ( criterias.controller_id != null ) && ( MultiBox.controllerOf( device.altuiid ).controller !== criterias.controller_id ) ) {
		return false;
	}
	// Filter on room
	if ( !_isEmpty( criterias.device_room ) && ( _isEmpty( device.room ) || ( device.room.toString() !== criterias.device_room ) ) ) {
		return false;
	}
	// Filter on device id
	if ( !_isEmpty( criterias.device_id ) && ( criterias.device_id !== "0" ) && ( device.id.toString() !== criterias.device_id ) ) {
		return false;
	}
	// Filter on type
	if ( !_isEmpty( criterias.device_type ) && ( device.device_type !== criterias.device_type ) ) {
		return false;
	}
	// Filter on category
	if ( !_isEmpty( criterias.device_category ) && ( criterias.device_category.indexOf( ";" ) === -1 ) && ( _isEmpty( device.category_num ) || ( device.category_num.toString() !== criterias.device_category ) ) ) {
		return false;
	}
	// Filter on category / subcategory
	if ( !_isEmpty( criterias.device_category ) && ( criterias.device_category.indexOf( ";" ) > 0 ) && ( _isEmpty( device.category_num ) || _isEmpty( device.subcategory_num ) || ( device.category_num.toString() + ";" + device.subcategory_num.toString() !== criterias.device_category ) ) ) {
		return false;
	}
	// Filter on service and variable
	if ( !_isEmpty( criterias.variable_service ) && !_isEmpty( criterias.variable ) ) {
		var isFounded = false;
		for ( var i = 0; i < device.states.length; i++ ) {
			if ( ( device.states[i].service === criterias.variable_service ) && ( device.states[i].variable === criterias.variable ) ) {
				isFounded = true;
				break;
			}
		}
		if ( !isFounded ) {
			return false;
		}
	} else {
		// Filter on service
		if ( !_isEmpty( criterias.variable_service ) ) {
			var isServiceFounded = false;
			for ( var i = 0; i < device.states.length; i++ ) {
				if ( device.states[i].service === criterias.variable_service ) {
					isServiceFounded = true;
					break;
				}
			}
			if ( !isServiceFounded ) {
				return false;
			}
		}
		// Filter on variable
		if ( !_isEmpty( criterias.variable ) ) {
			var isVariableFounded = false;
			for ( var i = 0; i < device.states.length; i++ ) {
				if ( device.states[i].variable === criterias.variable ) {
					isVariableFounded = true;
					break;
				}
			}
			if ( !isVariableFounded ) {
				return false;
			}
		}
	}
	// Filter on service and/or action
	if ( !_isEmpty( criterias.action_service ) || !_isEmpty( criterias.action ) ) {
		var isFounded = false;
		MultiBox.getDeviceActions( device, function ( services ) {
			for ( var i = 0; i < services.length; i++ ) {
				if ( !_isEmpty( criterias.action ) ) {
					if ( _isEmpty( criterias.action_service ) || ( services[ i ].ServiceId === criterias.action_service ) ) {
						for ( var j = 0; j < services[ i ].Actions.length; j++ ) {
							if ( services[ i ].Actions[ j ].name === criterias.action ) {
								isFounded = true;
								break;
							}
						}
					}
					if ( isFounded ) {
						break;
					}
				} else if ( services[ i ].ServiceId === criterias.action_service ) {
					isFounded = true;
					break;
				}
			}
		} );
		if ( !isFounded ) {
			return false;
		}
	}

	return true;
}
function _removeInput( inputName ) {
	if ( _INPUTS[ inputName ] != null ) {
		inputName = _INPUTS[ inputName ].input;
	}
	if ( this.getInput( inputName ) ) {
		this.removeInput( inputName );
	}
}
function _moveInputBefore( inputName, inputNames ) {
	if ( _INPUTS[ inputName ] != null ) {
		var inputName = _INPUTS[ inputName ].input;
	}
	for ( var i = 0; i < inputNames.length; i++ ) {
		if ( this.getInput( inputNames[ i ] ) != null ) {
			this.moveInputBefore( inputName, inputNames[ i ] );
			break;
		}
	}
}

function _createDeviceFilterInput( inputName, params, onChange ) {
	if ( this.getInput( inputName ) ) {
		return;
	}
	var thatBlock = this;
	var params = ( params != null ) ? params : {};
	var fieldName = _INPUTS[ inputName ].field;
	var input = this.appendDummyInput( inputName );

	// Icon
	if ( !_isEmpty( params.icon ) ) {
		input.appendField( new Blockly.FieldImage( params.icon, 20, 20, '*') );
	}

	// Label
	var label = ( params.label != null ) ? params.label : _INPUTS[ inputName ].label;
	input.appendField( label );

	if ( params.align ) {
		input.setAlign( Blockly[ params.align ] );
	}

	// Dropdown list
	input.appendField(
		new Blockly.FieldDropdown( [ [ "...", "" ] ], function( newValue ) {
			// Update the other filters
			var filters = {};
			filters[ inputName ] = newValue;
			for ( var i = 0; i < this.sourceBlock_.inputs_.length; i++ ) {
				var otherInputName = this.sourceBlock_.inputs_[ i ];
				if ( otherInputName !== inputName ) {
					_updateDeviceFilterInput.call( this.sourceBlock_, otherInputName, filters );
				}
			}
			if ( typeof( onChange ) === "function" ) {
				onChange( newValue );
			}
			// Check matching after change
			_checkDeviceFilterConnection.call( thatBlock, filters );
		} ),
		fieldName
	);
	return input;
}
function _updateDeviceFilterInput( inputName, params ) {
	if ( _INPUTS[ inputName ].type !== "deviceFilter" ) {
		return;
	}
	var fieldName = _INPUTS[ inputName ].field;
	var dropdown = this.getField( fieldName );
	if (dropdown == null) {
		return false;
	}
	var options = dropdown.getOptions_();
	var currentValue = dropdown.getValue();
	options.splice( 1, options.length );

	if ( params == null ) {
		params = {};
	}
	// TODO : stocker autre part le controllerId ?
	params.controller_id = $( "#rulesengine-blockly-workspace" ).data( "controller_id" );
	if ( params.controller_id != null ) {
		params.controller_id = parseInt( params.controller_id, 10 );
	}
	// Get all the other choosen values (or from params)
	for ( var i = 0; i < this.inputs_.length; i++ ) {
		var otherInputName = this.inputs_[ i ];
		var otherFieldName = _INPUTS[ otherInputName ].field;
		if ( ( otherInputName !== inputName ) && ( params[ otherInputName ] == null ) ) {
			var otherFieldValue = this.getFieldValue( otherFieldName ) || this.params_[ otherInputName ];
			if ( otherFieldValue != null ) {
				params[ otherInputName ] = otherFieldValue;
			}
		}
	}

	var endFunc, sortFunc;
	var indexValues = {};
	var thatBlock = this;
	switch ( inputName ) {
		case "device_id":
			endFunc = function( devices ) {
				$.each( devices, function( i, device ) {
					if ( !indexValues[ device.device_type ] ) {
						indexValues[ device.id.toString() ] = true;
						options.push( [ device.name, device.id.toString() ] );
					}
				} );
			};
			sortFunc = _sortOptionsByName;
			break;
		case "device_room":
			// Get the all the room for the controller
			var indexRooms = { "0": "no room" };
			$.each( MultiBox.getRoomsSync(), function( idx, room ) {
				if ( ( params.controller_id != null ) && ( MultiBox.controllerOf( room.altuiid ).controller === params.controller_id ) ) {
					indexRooms[ room.id.toString() ] = room.name;
				}
			} );
			endFunc = function( devices ) {
				$.each( devices, function( i, device ) {
					if (device.room == null) {
						return;
					}
					var roomId = device.room.toString();
					if ( !indexValues[ roomId ] ) {
						indexValues[ roomId ] = true;
						options.push( [ indexRooms[ roomId ], roomId ] );
					}
				} );
			};
			sortFunc = _sortOptionsByName;
			break;
		case "device_type":
			endFunc = function( devices ) {
				$.each( devices, function( i, device ) {
					var deviceType = device.device_type;
					if ( !indexValues[ deviceType ] ) {
						indexValues[ deviceType ] = true;
						//options.push( [ deviceType, deviceType ] );
						//options.push( [ deviceType.substr( deviceType.lastIndexOf( ":", deviceType.length - 2 ) + 1, deviceType.length - 2 ), deviceType ] );
						options.push( [ deviceType.substr( deviceType.lastIndexOf( ":", deviceType.length - 3 ) + 1 ), deviceType ] );
					}
				} );
			};
			sortFunc = _sortOptionsByName;
			break;
		case "device_category":
			endFunc = function( devices ) {
				$.each( devices, function( i, device ) {
					if ( device.category_num == null ) {
						return;
					}
					var category = device.category_num.toString();
					var categoryName = _CATEGORIES[ category ];
					if ( !_isEmpty( categoryName ) ) {
						if ( !indexValues[ category ] ) {
							indexValues[ category ] = true;
							options.push( [ categoryName, category ] );
						}
						if ( device.subcategory_num != null ) {
							var subCategory = device.subcategory_num.toString();
							var extendedSubCategory = category + "," + subCategory;
							var subCategoryName = _CATEGORIES[ extendedSubCategory ];
							if ( !_isEmpty( subCategoryName ) && !indexValues[ extendedSubCategory ] ) {
								indexValues[ extendedSubCategory ] = true;
								options.push( [ subCategoryName, subCategory ] );
							}
						}
					}
				} );
			};
			sortFunc = _sortOptionsById;
			break;
		case "variable":
			endFunc = function( devices ) {
				$.each( devices, function( i, device ) {
					$.each( device.states, function( j, state ) {
						if ( !_isEmpty( params.variable_service ) && ( state.service !== params.variable_service ) ) {
							return;
						}
						if ( !indexValues[ state.variable ] ) {
							indexValues[ state.variable ] = true;
							options.push( [ state.variable, state.variable ] );
						}
					} );
				} );
			};
			sortFunc = _sortOptionsByName;
			break;
		case "variable_service":
			endFunc = function( devices ) {
				$.each( devices, function( i, device ) {
					$.each( device.states, function( j, state ) {
						if ( !_isEmpty( params.variable ) && ( state.variable !== params.variable ) ) {
							return;
						}
						if ( !indexValues[ state.service ] ) {
							indexValues[ state.service ] = true;
							options.push( [ state.service.substr( state.service.lastIndexOf( ":" ) + 1 ), state.service ] );
							//options.push( [ state.service, state.service ] );
						}
					} );
				} );
			};
			sortFunc = _sortOptionsByName;
			break;
		case "action":
			endFunc = function( devices ) {
				$.each( devices, function( i, device ) {
					MultiBox.getDeviceActions( device, function ( services ) {
						$.each( services, function ( j, service ) {
							if ( !_isEmpty( params.action_service ) && ( service.ServiceId !== params.action_service ) ) {
								return;
							}
							$.each( service.Actions, function ( k, action ) {
								if ( !indexValues[ action.name ] ) {
									indexValues[ action.name ] = true;
									options.push( [ action.name, action.name ] );
								}
							} );
						} );
					} );
				} );
			};
			sortFunc = _sortOptionsByName;
			break;
		case "action_service":
			endFunc = function( devices ) {
				$.each( devices, function( i, device ) {
					MultiBox.getDeviceActions( device, function ( services ) {
						$.each( services, function ( j, service ) {
							if ( !indexValues[ service.ServiceId ] ) {
								indexValues[ service.ServiceId ] = true;
								options.push( [ service.ServiceId.substr( service.ServiceId.lastIndexOf( ":" ) + 1 ), service.ServiceId ] );
								//options.push( [ service.ServiceId, service.ServiceId ] );
							}
						} );
					} );
				} );
			};
			sortFunc = _sortOptionsByName;
			break;
		default:
			throw 'Unknown input type.';
	}
	if ( endFunc != null ) {
		MultiBox.getDevices(
			null,
			function ( device ) {
				return _filterDevice( device, params );
			},
			endFunc
		);
	}
	if ( sortFunc != null ) {
		options.sort( sortFunc );
	}
	if ( !indexValues[ currentValue ] ) {
		// The choosen value is no more in the dropdown values
		dropdown.setValue( "" );
	} else if ( currentValue != "" ) {
		// Refresh text
		dropdown.setValue( currentValue );
	}

	// The filters have changed, must verify that device matches with conditions
	this.checkedCriterias_ = null;

	return true;
}
function _updateDeviceFilterInputs( params ) {
	if ( params == null ) {
		params = {};
	}
	for ( var i = 0; i < this.inputs_.length; i++ ) {
		var inputName = this.inputs_[ i ];
		if ( this.getInput( inputName ) != null ) {
			_updateDeviceFilterInput.call( this, inputName, params );
		}
	}
}

function _createInput( inputName, params, onChange ) {
	var inputParams = _INPUTS[ inputName ];
	if ( this.getInput( inputParams.input ) ) {
		return;
	}
	var params = ( params != null ) ? params : {};
	switch ( inputParams.type ) {
		case "deviceFilter":
			_createDeviceFilterInput.call( this, inputName, params, onChange );
			break;

		case "value":
			var input = this.appendValueInput( inputParams.input );
			var check = ( params.check != null ) ? params.check : inputParams.check;
			if ( !_isEmpty( check ) ) {
				input.setCheck( check );
			}
			var label = ( params.label != null ) ? params.label : inputParams.label;
			if ( !_isEmpty( label ) ) {
				input.appendField( label );
			}
			if ( inputParams.align ) {
				input.setAlign( Blockly[ inputParams.align ] );
			}
			break;

		default:
	}
	if ( !_isEmpty( inputParams.before ) ) {
		_moveInputBefore.call( this, inputName, inputParams.before );
	}
}

function _checkDeviceFilterConnection( criterias ) {
	// Check if connected devices are matching criterias
	var inputDevice = this.getInput( "device" );
	if ( !inputDevice ) {
		return;
	}
	var connection = inputDevice.connection;
	var device = connection && connection.targetBlock();
	if ( device == null ) {
		return;
	}
	if ( device.type === "list_device" ) {
		for ( var i = 0; i < device.inputList.length; i++ ) {
			var subConnection = device.inputList[i].connection;
			var subDevice = subConnection && subConnection.targetBlock();
			if ( subDevice != null ) {
				subDevice.isMatching( criterias );
			}
		}
	} else {
		device.isMatching( criterias );
	}
}

function _sortOptionsById( a, b ) {
	if ( a[ 1 ] < b[ 1 ] ) {
		return -1;
	}
	if ( a[ 1 ] > b[ 1 ] ) {
		return 1;
	}
	return 0;
}
function _sortOptionsByName( a, b ) {
	if ( a[ 0 ] < b[ 0 ] ) {
		return -1;
	}
	if ( a[ 0 ] > b[ 10 ] ) {
		return 1;
	}
	return 0;
}

function _createMutationContainer( attributeNames ) {
	var container = document.createElement( "mutation" );
	for ( var i = 0; i < attributeNames.length; i++ ) {
		var attributeName = attributeNames[i];
		if ( this.params_[ attributeName ] != null ) {
			container.setAttribute( attributeName, this.params_[ attributeName ] );
		} else if ( _INPUTS[ attributeName ] != null ) {
			container.setAttribute( "input_" + attributeName, this.getFieldValue( _INPUTS[ attributeName ].field ) );
		}
	}
	return container;
}
function _loadMutationAttributes( xmlElement, attributeNames ) {
	for ( var i = 0; i < attributeNames.length; i++ ) {
		var attributeName = attributeNames[i];
		this.params_[ attributeName ] = xmlElement.getAttribute( attributeName );
		if ( _INPUTS[ attributeName ] != null ) {
			this.params_[ "input_" + attributeName ] = xmlElement.getAttribute( "input_" + attributeName );
		}
	}
}

function _createMutationContainerFromInputs() {
	var container = document.createElement( "mutation" );
	var inputs = [];
	for ( var i = 0; i < this.inputs_.length; i++ ) {
		var inputName = this.inputs_[ i ];
		if ( this.getInput( _INPUTS[ inputName ].input ) != null ) {
			inputs.push( inputName );
		}
	}
	container.setAttribute( "inputs", inputs.join( "," ) );
	return container;
}
function _loadMutationInputs( xmlElement ) {
	var inputs = xmlElement.getAttribute( "inputs" );
	if ( inputs == null ) {
		return;
	}
	inputs = inputs.split( "," );
	// Update shape
	for ( var i = 0; i < this.inputs_.length; i++ ) {
		var inputName = this.inputs_[ i ];
		if ( goog.array.contains( inputs, inputName ) ) {
			_createInput.call( this, inputName );
		}
	}
}

function _decompose( workspace, type ) {
	var containerBlock = Blockly.Block.obtain( workspace, "controls_" +  type );
	containerBlock.initSvg();
	var connection = containerBlock.getInput( "STACK" ).connection;
	for ( var i = 0; i < this.inputs_.length; i++ ) {
		var inputName = this.inputs_[ i ];
		if ( this.getInput( _INPUTS[ inputName ].input ) != null ) {
			var block = Blockly.Block.obtain( workspace, "controls_" + inputName );
			if ( block != null ) {
				block.initSvg();
				connection.connect( block.previousConnection );
				connection = block.nextConnection;
			}
		}
	}
	return containerBlock;
}

function _compose( containerBlock ) {
	var isInputPresent = {};
	var block = containerBlock.getInputTargetBlock( "STACK" );
	while ( block ) {
		var inputName = block.type.substr(9); // Removes "controls_" from the type
		isInputPresent[ inputName ] = true;
		block = block.nextConnection && block.nextConnection.targetBlock();
	}
	for ( var i = 0; i < this.inputs_.length; i++ ) {
		var inputName = this.inputs_[ i ];
		if ( isInputPresent[ inputName ] ) {
			_createInput.call( this, inputName );
			// Update
			_updateDeviceFilterInput.call( this, inputName, {} );
		} else {
			_removeInput.call( this, inputName );
		}
	}
}


// ****************************************************************************
// Blockly - Device
// ****************************************************************************

goog.require('goog.array');

goog.provide( "Blockly.Blocks.device" );

Blockly.Msg.DEVICE_TOOLTIP = "{0} device(s) matching";
Blockly.Msg.DEVICE_NO_FILTER_TOOLTIP = "No filter is selected.";

Blockly.Msg.CONTROLS_DEVICE_TITLE = "device";
Blockly.Msg.CONTROLS_DEVICE_TOOLTIP = "TODO";
Blockly.Msg.CONTROLS_DEVICE_ID_TITLE = "id";
Blockly.Msg.CONTROLS_DEVICE_ID_TOOLTIP = "TODO";
Blockly.Msg.CONTROLS_DEVICE_ROOM_TITLE = "room";
Blockly.Msg.CONTROLS_DEVICE_ROOM_TOOLTIP = "TODO";
Blockly.Msg.CONTROLS_DEVICE_TYPE_TITLE = "type";
Blockly.Msg.CONTROLS_DEVICE_TYPE_TOOLTIP = "TODO";
Blockly.Msg.CONTROLS_DEVICE_CATEGORY_TITLE = "category";
Blockly.Msg.CONTROLS_DEVICE_CATEGORY_TOOLTIP = "TODO";

Blockly.Blocks[ "device" ] = {
	init: function() {
		this.setColour( Blockly.Blocks.devices.HUE );
		this.params_ = {};

		this.inputs_ = [ "device_id", "device_room", "device_type", "device_category" ];
		var controls = [];
		for ( var i = 0; i < this.inputs_.length; i++ ) {
			controls.push( "controls_" + this.inputs_[ i ] );
		}
		this.setMutator( new Blockly.Mutator( controls ) );

		this.checkedCriterias_ = null;

		this.setInputsInline( false );
		this.setOutput( true, "Device" );
	},

	mutationToDom: function() {
		return _createMutationContainerFromInputs.call(this);
	},

	domToMutation: function( xmlElement ) {
		_loadMutationInputs.call( this, xmlElement );
	},

	decompose: function( workspace ) {
		return _decompose.call( this, workspace, "device" );
	},

	compose: function( containerBlock ) {
		return _compose.call( this, containerBlock );
	},

	validate: function() {
		_updateDeviceFilterInputs.call( this );
	},

	isMatching: function( criterias, filters ) {
		var isMatching = false;

		// Check if the control on these criterias has already been done.
		if ( ( criterias != null ) && ( this.checkedCriterias_ != null ) ) {
			isMatching = true;
			$.each( this.checkedCriterias_, function( criteria, value ) {
				if ( criterias[ criteria ] !== value ) {
					isMatching = false;
				}
			} );
			if ( isMatching ) {
				return true;
			} else {
				this.checkedCriterias_ = null;
			}
		}

		// Get choosen filters
		if ( filters == null ) {
			for ( var i = 0; i < this.inputs_.length; i++ ) {
				var inputName = this.inputs_[ i ];
				if ( this.getInput( _INPUTS[ inputName ].input ) != null ) {
					var fieldName = _INPUTS[ inputName ].field;
					var fieldValue = this.getFieldValue( fieldName );
					if ( !_isEmpty( fieldValue ) ) {
						if ( filters == null ) {
							filters = {};
						}
						filters[ inputName ] = fieldValue;
					}
				}
			}
		}
		if ( filters == null ) {
			this.setTooltip( Blockly.Msg.DEVICE_NO_FILTER_TOOLTIP );
			this.setWarningText();
			return false;
		}

		// Apply the filters and then the criterias
		var nbMatchingDevices = 0, nbNotMatchingDevices = 0;
		if ( criterias == null ) {
			criterias = this.checkedCriterias_;
		}
		MultiBox.getDevices(
			null,
			function ( device ) {
				return _filterDevice( device, filters );
			},
			function( devices ) {
				// All the filtered devices have to match the given criterias
				isMatching = true;
				for ( var i = 0; i < devices.length; i++ ) {
					if ( !_filterDevice( devices[ i ], criterias ) ) {
						isMatching = false;
						nbNotMatchingDevices++;
					} else {
						nbMatchingDevices++;
					}
				}
			}
		);

		if ( isMatching ) {
			this.checkedCriterias_ = criterias;
			this.setWarningText();
		} else {
			this.checkedCriterias_ = null;
			if (nbNotMatchingDevices > 1) {
				this.setWarningText( nbNotMatchingDevices + " devices do not match the criterias\n" + JSON.stringify( criterias ) );
			} else {
				this.setWarningText( "One device does not match criterias\n" + JSON.stringify( criterias ) );
			}
		}

		this.setTooltip( Blockly.Msg.DEVICE_TOOLTIP.format( nbMatchingDevices ) );

		return isMatching;
	}
};

Blockly.Blocks[ "controls_device" ] = {
	init: function() {
		this.setColour(Blockly.Blocks.devices.HUE);
		this.appendDummyInput()
			.appendField(Blockly.Msg.CONTROLS_DEVICE_TITLE);
		this.appendStatementInput('STACK');
		this.setTooltip(Blockly.Msg.CONTROLS_DEVICE_TOOLTIP);
		this.contextMenu = false;
	}
};

Blockly.Blocks[ "controls_device_id" ] = {
	init: function() {
		this.setColour(Blockly.Blocks.devices.HUE);
		this.appendDummyInput()
			.appendField(Blockly.Msg.CONTROLS_DEVICE_ID_TITLE);
		this.setPreviousStatement(true);
		this.setNextStatement(true);
		this.setTooltip(Blockly.Msg.CONTROLS_DEVICE_ID_TOOLTIP);
		this.contextMenu = false;
	}
};

Blockly.Blocks[ "controls_device_room" ] = {
	init: function() {
		this.setColour(Blockly.Blocks.devices.HUE);
		this.appendDummyInput()
			.appendField(Blockly.Msg.CONTROLS_DEVICE_ROOM_TITLE);
		this.setPreviousStatement(true);
		this.setNextStatement(true);
		this.setTooltip(Blockly.Msg.CONTROLS_DEVICE_ROOM_TOOLTIP);
		this.contextMenu = false;
	}
};

Blockly.Blocks[ "controls_device_type" ] = {
	init: function() {
		this.setColour(Blockly.Blocks.devices.HUE);
		this.appendDummyInput()
			.appendField(Blockly.Msg.CONTROLS_DEVICE_TYPE_TITLE);
		this.setPreviousStatement(true);
		this.setNextStatement(true);
		this.setTooltip(Blockly.Msg.CONTROLS_DEVICE_TYPE_TOOLTIP);
		this.contextMenu = false;
	}
};

Blockly.Blocks[ "controls_device_category" ] = {
	init: function() {
		this.setColour(Blockly.Blocks.devices.HUE);
		this.appendDummyInput()
			.appendField(Blockly.Msg.CONTROLS_DEVICE_CATEGORY_TITLE);
		this.setPreviousStatement(true);
		this.setNextStatement(true);
		this.setTooltip(Blockly.Msg.CONTROLS_DEVICE_CATEGORY_TOOLTIP);
		this.contextMenu = false;
	}
};

// ****************************************************************************
// Blockly - Rule conditions
// ****************************************************************************

goog.require( "Blockly.Blocks" );

goog.provide( "Blockly.Blocks.conditions" );
Blockly.Blocks.conditions.HUE1 = 40;
Blockly.Blocks.conditions.HUE2 = 40;

Blockly.Msg.LIST_CONDITION_EMPTY_TITLE = "no condition";

Blockly.Blocks[ "list_with_operator_condition" ] = function() {};
goog.mixin( Blockly.Blocks[ "list_with_operator_condition" ], Blockly.Blocks[ "lists_create_with" ] );
Blockly.Blocks[ "list_with_operator_condition" ].updateShape_ = function() {
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
			.appendField( Blockly.Msg.LIST_CONDITION_EMPTY_TITLE );
	} else {
		for ( var i = 0; i < this.itemCount_; i++ ) {
			var input = this.appendValueInput( "ADD" + i )
				.setCheck( "Boolean" );
			if ( i === 0 ) {
				input.appendField( new Blockly.FieldDropdown( [
						[ "one is true", "OR" ],
						[ "all are true", "AND" ]
					] ),
					"operator"
				);
			}
		}
	}
	this.setInputsInline( false );
	if ( !this.outputConnection ) {
		this.setOutput( true, "Boolean" );
	} else {
		this.outputConnection.setCheck( "Boolean" );
	}
};

// ****************************************************************************
// Blockly - Rule conditions - Types
// ****************************************************************************

function _updateConditionValueShape() {
	// Device type
	this.getField( "deviceLabel" ).text_ = ( this.params_.device_label != null ? this.params_.device_label : "device" );

	// Variable
	_removeInput.call( this, "variable" );
	if ( ( this.params_.variable == null ) || ( this.params_.operator == null ) || ( this.params_.value == null ) ) {
		var variableInput;
		if ( this.params_.variable == null ) {
			variableInput = _createDeviceFilterInput.call( this, "variable", { "icon": this.params_.icon, "label": this.params_.variable_label } );
		} else {
			variableInput = this.appendDummyInput( "variable" );
			if ( !_isEmpty( this.params_.variable_label ) ) {
				variableInput
					.appendField( this.params_.variable_label );
			}
		}
		// Operator
		if ( this.params_.operator == null ) {
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
			var operators;
			if ( this.params_.operators != null ) {
				if (typeof this.params_.operators  === "string") {
					operators = JSON.parse( this.params_.operators.replace( /&quot/g, "\"") );
				} else {
					operators = this.params_.operators;
				}
				// Replace empty labels
				for( var i = 0; i < operators.length; i++ ) {
					if ( operators[ i ][ 0 ] === "" ) {
						for( var j = 0; j < OPERATORS.length; j++ ) {
							if ( operators[ i ][ 1 ] === OPERATORS[ j ][ 1 ] ) {
								operators[ i ][ 0 ] = OPERATORS[ j ][ 0 ];
								break;
							}
						}
					}
				}
			} else {
				operators = OPERATORS;
			}
			variableInput
				.appendField( new Blockly.FieldDropdown( operators ), "operator" );
		}
		// Value
		if ( this.params_.value == null ) {
			variableInput
				.appendField( new Blockly.FieldTextInput( "" ), "value" );
		}
		this.moveInputBefore( "variable", "params" );
	}

	// Service
	if ( this.params_.variable_service == null ) {
		_createDeviceFilterInput.call( this, "variable_service" );
		_moveInputBefore.call( this, "variable_service", [ "variable", "params" ] );
	} else {
		_removeInput.call( this, "variable_service" );
	}
}

function _updateActionDeviceShape() {
	// Device type
	this.getField( "deviceLabel" ).text_ = ( this.params_.device_label != null ? this.params_.device_label : "device" );

	// Action params selection
	if ( this.params_.action_params !== undefined ) {
		this.appendDummyInput( "action_auto_params" )
			.appendField( new Blockly.FieldDropdown( this.params_.action_params ), "actionParams" );
		_moveInputBefore.call( this, "action_auto_params", [ "device" ] );
	} else {
		_removeInput.call( this, "action_auto_params" );
	}

	// Action
	if ( !this.params_.action || this.params_.action_label ) {
		if ( !this.params_.action ) {
			var thatBlock = this;
			_createDeviceFilterInput.call( this, "action", { "icon": this.params_.icon, "label": this.params_.action_label },
				function( newAction ) {
					_updateActionDeviceParamsShape.call( thatBlock, newAction );
				}
			);
		} else {
			_removeInput.call( this, "action" );
			this.appendDummyInput( "action" )
				.appendField( this.params_.action_label );
		}
		_moveInputBefore.call( this, "action", [ "action_auto_params", "action_params", "device" ] );
	} else {
		_removeInput.call( this, "action" );
	}

	// Service
	if ( this.params_.action_service == null ) {
		_createDeviceFilterInput.call( this, "action_service" );
		_moveInputBefore.call( this, "action_service", [ "action", "action_params", "device" ] );
	} else {
		_removeInput.call( this, "action_service" );
	}
}

function _updateActionDeviceParamsShape( newAction ) {
	if ( this.params_.action_params ) {
		return;
	}
	for ( var i = 0; i < 6; i++ ) {
		_removeInput.call( this, "action_params_" + i );
	}

	var actionService = this.params_.action_service || this.getFieldValue( "service" ) || this.params_.input_action_service;
	var actionName    = this.params_.action || newAction || this.getFieldValue( "action" )  || this.params_.input_action;
	if ( _isEmpty( actionService ) && _isEmpty ( actionName ) ) {
		return;
	}

	// Action params
	var action = ALTUI_RulesEngine.getDeviceAction( actionService, actionName );
	if ( ( action !== undefined ) && ( action.input !== undefined ) && ( action.input.length > 0 ) ) {
		for ( var i = action.input.length - 1; i >= 0; i-- ) {
			var inputName = action.input[ i ];
			this.appendDummyInput( "action_params_" + i )
				.setAlign( Blockly.ALIGN_RIGHT )
				.appendField( inputName + " =" )
				.appendField( new Blockly.FieldTextInput( "" ), "param_" + inputName );
			_moveInputBefore.call( this, "action_params_" + i, [ "device" ] );
		}
	}
}

Blockly.Blocks[ "condition_value" ] = {
	init: function() {
		this.setColour( Blockly.Blocks.conditions.HUE2 );
		this.params_ = {};

		this.appendValueInput( "device" )
			.appendField( "device", "deviceLabel" )
			.setAlign( Blockly.ALIGN_RIGHT )
			.setCheck( [ "Devices", "Device" ] );

		this.appendValueInput( "params" )
			.appendField( "with" )
			.setAlign( Blockly.ALIGN_RIGHT )
			.setCheck( [ "ConditionParams", "ConditionParam" ] );

		this.inputs_ = [ "variable_service", "variable" ];
		_updateConditionValueShape.call( this );

		this.setInputsInline( false );
		this.setOutput( true, "Boolean" );
	},

	mutationToDom: function() {
		if ( !_isEmpty( this.params_.condition_type ) ) {
			return _createMutationContainer.call( this, [ "condition_type", "variable_service", "variable", "operator", "value" ] );
		} else {
			return _createMutationContainer.call( this, [ "icon", "device_label", "operators", "variable_service", "variable_label", "variable", "operator", "value" ] );
		}
	},

	domToMutation: function( xmlElement ) {
		this.params_ = {};
		if ( xmlElement != null ) {
			_loadMutationAttributes.call( this, xmlElement, [ "condition_type", "icon", "device_label", "operators", "variable_service", "variable_label", "variable", "operator", "value" ] );
			switch( this.params_.condition_type ) {
				case "sensor_armed":
					this.params_.device_label = "security sensor";
					this.params_.variable_service = "urn:micasaverde-com:serviceId:SecuritySensor1";
					this.params_.variable = "Armed";
					this.params_.operators = [ [ "is armed", "EQ" ], [ "is not armed", "NEQ" ] ];
					this.params_.value = "1";
					break;
				case "sensor_tripped":
					this.params_.device_label = "security sensor";
					this.params_.variable_service = "urn:micasaverde-com:serviceId:SecuritySensor1";
					this.params_.variable = "Tripped";
					this.params_.operators = [ [ "is tripped", "EQ" ], [ "is not tripped", "NEQ" ] ];
					this.params_.value = "1";
					break;
				case "sensor_temperature":
					this.params_.device_label = "sensor";
					this.params_.icon = "/cmh/skins/default/img/devices/device_states/temperature_sensor_default.png";
					this.params_.variable_service = "urn:upnp-org:serviceId:TemperatureSensor1";
					this.params_.variable = "CurrentTemperature";
					this.params_.variable_label = "temperature";
					this.params_.operators = [ [ "", "EQ" ], [ "", "LTE" ], [ "", "GTE" ] ];
					break;
				case "switch":
					this.params_.variable_service = "urn:upnp-org:serviceId:SwitchPower1";
					this.params_.variable = "Status";
					this.params_.operators = [ [ "is on", "EQ" ], [ "is off", "NEQ" ] ];
					this.params_.value = "1";
					break;
			}
		}
		_updateConditionValueShape.call( this );
	},

	validate: function() {
		var params = {
			"action_service": this.params_["input_action_service"],
			"action": this.params_["input_action"]
		};
		_updateDeviceFilterInputs.call( this, params );
	},

	onchange: function() {
		var criterias = {
			"variable_service": (this.getFieldValue( "service" )  || this.params_.variable_service),
			"variable"        : (this.getFieldValue( "variable" ) || this.params_.variable)
		};
		_checkDeviceFilterConnection.call( this, criterias );
	}
};

Blockly.Blocks[ "condition_time" ] = {
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
				new Blockly.FieldDropdown( [ [ "on days of week", "2" ], [ "on days of month", "3" ] ], function( option ) {
					this.sourceBlock_.updateShape_( "timerType", option );
				} ),
				"timerType"
			);

		this.appendValueInput( "params" )
			.appendField( "with" )
			.setAlign( Blockly.ALIGN_RIGHT )
			.setCheck( [ "ConditionParams", "ConditionParam" ] );

		this.setInputsInline( true );
		this.setOutput( true, "Boolean" );
	},

	onchange: function() {
		if ( ( this.getFieldValue( "time" ) != null ) && ( this.getFieldValue( "time" ).match( /^\d\d:\d\d:\d\d$/ ) == null ) ) {
			this.setWarningText( "Time format must be 'hh:mm:ss'" );
		} else if ( ( this.getFieldValue( "time1" ) != null ) && ( this.getFieldValue( "time1" ).match( /^\d\d:\d\d:\d\d$/ ) == null ) ) {
			this.setWarningText("First time format must be 'hh:mm:ss'");
		} else if ( ( this.getFieldValue( "time2" ) != null ) && ( this.getFieldValue( "time2" ).match( /^\d\d:\d\d:\d\d$/ ) == null ) ) {
			this.setWarningText( "Second time format must be 'hh:mm:ss'" );
		} else {
			this.setWarningText( null );
		}
	},

	mutationToDom: function() {
		var container = document.createElement( "mutation" );
		container.setAttribute( "operator", this.getFieldValue( "operator" ) );
		container.setAttribute( "timer_type", this.getFieldValue( "timerType" ) );
		return container;
	},

	domToMutation: function( xmlElement ) {
		var operator = xmlElement.getAttribute( "operator" );
		this.updateShape_( "operator", operator );
		var timerType = xmlElement.getAttribute( "timer_type" );
		this.updateShape_( "timerType", timerType );
	},

	updateShape_: function( type, option ) {
		if ( type === "operator" ) {
			var inputTime = this.getInput( "time" );
			if ( this.getField( "time" ) != null ) {
				inputTime.removeField('time');
			}
			if ( this.getField( "time1" ) != null ) {
				inputTime.removeField( "time1" );
				inputTime.removeField( "between_and" );
				inputTime.removeField( "time2" );
			}
			if ( option === "EQ" ) {
				inputTime
					.appendField( new Blockly.FieldTextInput( "hh:mm:ss" ), "time" );
			} else {
				inputTime
					.appendField( new Blockly.FieldTextInput( "hh:mm:ss" ), "time1" )
					.appendField( "and", "between_and" )
					.appendField( new Blockly.FieldTextInput( "hh:mm:ss" ), "time2" );
			}
		} else if ( type === "timerType" ) {
			var inputTimerType = this.getInput( "timerType" );
			if ( this.getField( "daysOfWeek" ) != null ) {
				inputTimerType.removeField( "daysOfWeek" );
			}
			if ( this.getField( "daysOfMonth" ) != null ) {
				inputTimerType.removeField( "daysOfMonth" );
			}
			if ( option === "2" ) {
				inputTimerType
					.appendField( new Blockly.FieldTextInput( "" ), "daysOfWeek" );
			} else {
				inputTimerType
					.appendField( new Blockly.FieldTextInput( "" ), "daysOfMonth" );
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
			.appendField( "with" )
			.setAlign( Blockly.ALIGN_RIGHT )
			.setCheck( [ "ConditionParams", "ConditionParam" ] );

		this.setInputsInline( true );
		this.setOutput( true, "Boolean" );
	}
};

// ****************************************************************************
// Blockly - Rule conditions - Params
// ****************************************************************************

Blockly.Msg.LIST_CONDITION_PARAM_TITLE = "list of condition parameters";
Blockly.Msg.LIST_CONDITION_PARAM_CREATE_EMPTY_TITLE = "no param";

Blockly.Blocks[ "list_condition_param" ] = function() {};
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
			.appendField( Blockly.Msg.LIST_CONDITION_PARAM_CREATE_EMPTY_TITLE );
	} else {
		for ( var i = 0; i < this.itemCount_; i++ ) {
			var input = this.appendValueInput( "ADD" + i )
				.setCheck( "ConditionParam" );
		}
	}
	this.setInputsInline( true );
	if ( !this.outputConnection ) {
		this.setOutput( true, "ConditionParams" );
	} else {
		this.outputConnection.setCheck( "ConditionParams" );
	}
	this.setTooltip(Blockly.Msg.LIST_CONDITION_PARAM_TITLE);
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

goog.require( "Blockly.Blocks" );

goog.provide( "Blockly.Blocks.actions" );
Blockly.Blocks.actions.HUE1 = 224;
Blockly.Blocks.actions.HUE2 = 240;
Blockly.Msg.ACTION_GROUP_TOOLTIP = "Group of actions. Choose the event linked to these actions and eventually parameters and specific conditions.";
Blockly.Msg.CONTROLS_ACTION_GROUP_TITLE = "group of actions";
Blockly.Msg.CONTROLS_ACTION_GROUP_TOOLTIP = "Group of actions.";
Blockly.Msg.CONTROLS_ACTION_GROUP_PARAMS_TITLE = "param";
Blockly.Msg.CONTROLS_ACTION_GROUP_PARAMS_TOOLTIP = "Parameter which can change the behaviour of the group of actions.";
Blockly.Msg.CONTROLS_ACTION_GROUP_CONDITIONS_TITLE = "condition";
Blockly.Msg.CONTROLS_ACTION_GROUP_CONDITIONS_TOOLTIP = "Specific condition for the group of actions. If this condition is not realized, the group of actions is not executed (the status of the rule is not impacted).";

Blockly.Blocks[ "action_group" ] = {
	init: function() {
		this.setColour( Blockly.Blocks.actions.HUE1 );

		// Event
		this.appendDummyInput()
			.appendField( "for event" )
			.appendField(
				new Blockly.FieldDropdown(
					[
						/*
						[ "as soon as the rule is activated", "start" ],
						[ "repeat as long as the rule is active", "reminder" ],
						[ "as soon as the rule is deactivated", "end" ],
						[ "(TODO) when a condition is filled", "conditionStart" ],
						[ "(TODO) when a condition is no more filled", "conditionEnd" ]
						*/
						[ "START of the rule", "start" ],
						[ "REPEAT as long as the rule is active", "reminder" ],
						[ "END of the rule", "end" ],
						[ "(TODO) a condition is filled", "conditionStart" ],
						[ "(TODO) a condition is no more filled", "conditionEnd" ],
					],
					function( option ) {
						var recurrentIntervalInput = ( option === "reminder" );
						this.sourceBlock_.updateShape_( recurrentIntervalInput );
					}
				),
				"event"
			);

		//this.appendDummyInput( "end" );

		this.appendStatementInput( "do" )
			.setCheck( "ActionType" )
			.appendField( "do" );

		this.inputs_ = [ "action_group_params", "action_group_conditions" ];
		this.setMutator( new Blockly.Mutator( [ "controls_action_group_params", "controls_action_group_conditions" ] ) );

		this.setInputsInline( false );
		this.setPreviousStatement( true, "Action" );
		this.setNextStatement( true, "Action" );
		this.setTooltip( Blockly.Msg.ACTION_GROUP_TOOLTIP );
	},

	mutationToDom: function() {
		var container = _createMutationContainerFromInputs.call(this);
		var recurrentIntervalInput = (this.getFieldValue( "event" ) === "reminder" );
		container.setAttribute( "recurrent_interval_input", recurrentIntervalInput );
		return container;
	},

	domToMutation: function( xmlElement ) {
		_loadMutationInputs.call( this, xmlElement );
		var recurrentIntervalInput = ( xmlElement.getAttribute( "recurrent_interval_input" ) === "true" );
		this.updateShape_( recurrentIntervalInput );
	},

	decompose: function( workspace ) {
		return _decompose.call( this, workspace, "action_group" );
	},

	compose: function( containerBlock ) {
		return _compose.call( this, containerBlock );
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
					.appendField( new Blockly.FieldDropdown( [ [ "seconds", "S" ], [ "minutes", "M" ], [ "hours", "H" ] ] ), "unit" )
					.setAlign( Blockly.ALIGN_RIGHT );
				this.moveInputBefore( "recurrentInterval", "params" );
			}
		} else if ( inputExists ) {
			this.removeInput( "recurrentInterval" );
		}
	}
};

Blockly.Blocks[ "controls_action_group" ] = {
	init: function() {
		this.setColour(Blockly.Blocks.actions.HUE1);
		this.appendDummyInput()
			.appendField(Blockly.Msg.CONTROLS_ACTION_GROUP_TITLE);
		this.appendStatementInput('STACK');
		this.setTooltip(Blockly.Msg.CONTROLS_ACTION_GROUP_TOOLTIP);
		this.contextMenu = false;
	}
};

Blockly.Blocks[ "controls_action_group_params" ] = {
	init: function() {
		this.setColour(Blockly.Blocks.actions.HUE1);
		this.appendDummyInput()
			.appendField(Blockly.Msg.CONTROLS_ACTION_GROUP_PARAMS_TITLE);
		this.setPreviousStatement(true);
		this.setNextStatement(true);
		this.setTooltip(Blockly.Msg.CONTROLS_ACTION_GROUP_PARAMS_TOOLTIP);
		this.contextMenu = false;
	}
};

Blockly.Blocks[ "controls_action_group_conditions" ] = {
	init: function() {
		this.setColour(Blockly.Blocks.actions.HUE1);
		this.appendDummyInput()
			.appendField(Blockly.Msg.CONTROLS_ACTION_GROUP_CONDITIONS_TITLE);
		this.setPreviousStatement(true);
		this.setNextStatement(true);
		this.setTooltip(Blockly.Msg.CONTROLS_ACTION_GROUP_CONDITIONS_TOOLTIP);
		this.contextMenu = false;
	}
};


// ****************************************************************************
// Blockly - Rule actions - Types
// ****************************************************************************

Blockly.Msg.ACTION_WAIT_TOOLTIP = "Waits a defined time.";
Blockly.Msg.ACTION_FUNCTION_TOOLTIP = "Executes LUA code.";
Blockly.Msg.ACTION_DEVICE_TOOLTIP = "Executes an action of a device.";

Blockly.Blocks['action_wait'] = {
	init: function () {
		this.setColour( Blockly.Blocks.actions.HUE2 );

		this.appendDummyInput( "delayInterval" )
			.appendField( "wait" )
			.appendField( new Blockly.FieldTextInput( "0", Blockly.FieldTextInput.numberValidator ), "delayInterval" )
			.appendField( new Blockly.FieldDropdown( [ [ "seconds", "S" ], [ "minutes", "M" ], [ "hours", "H" ] ] ), "unit" );

		this.setPreviousStatement( true, "ActionType" );
		this.setNextStatement( true, "ActionType" );
		this.setTooltip( Blockly.Msg.ACTION_WAIT_TOOLTIP );
	}
};

Blockly.Blocks['action_function'] = {
	init: function () {
		this.setColour( Blockly.Blocks.actions.HUE2 );

		this.appendDummyInput()
			.appendField( "LUA function" );
		this.appendDummyInput()
			.appendField( new Blockly.FieldCodeArea( "" ), "functionContent" );

		this.setPreviousStatement( true, "ActionType" );
		this.setNextStatement( true, "ActionType" );
		this.setTooltip( Blockly.Msg.ACTION_FUNCTION_TOOLTIP );
	}
};

Blockly.Blocks['action_device'] = {
	init: function () {
		this.setColour( Blockly.Blocks.actions.HUE2 );
		this.params_ = {};

		this.appendValueInput( "device" )
			.appendField( "device", "deviceLabel" )
			.setAlign( Blockly.ALIGN_RIGHT )
			.setCheck( [ "Devices", "Device" ] );

		this.inputs_ = [ "action_service", "action" ];
		_updateActionDeviceShape.call( this );

		this.setInputsInline( false );
		this.setPreviousStatement( true, "ActionType" );
		this.setNextStatement( true, "ActionType" );
		this.setTooltip( Blockly.Msg.ACTION_DEVICE_TOOLTIP );
	},

	mutationToDom: function() {
		return _createMutationContainer.call( this, [ "action_type", "action_service", "action" ] );
	},

	domToMutation: function( xmlElement ) {
		this.params_ = {};
		if ( xmlElement != null ) {
			_loadMutationAttributes.call( this, xmlElement, [ "action_type", "icon", "device_label", "action_service", "action_label", "action" ] );
			switch( this.params_.action_type ) {
				case "switch":
					this.params_.action_service = "urn:upnp-org:serviceId:SwitchPower1";
					this.params_.action = "SetTarget";
					this.params_.action_params = [ [ "switch on", '{"newTargetValue":"1"}' ], [ "switch off", '{"newTargetValue":"0"}' ] ];
					break;
				case "dim":
					this.params_.action_service = "urn:upnp-org:serviceId:Dimming1";
					this.params_.action = "SetLoadLevelTarget";
					this.params_.action_label = "dim";
					break;
			}
		}
		_updateActionDeviceShape.call( this );
		_updateDeviceFilterInputs.call( this, { "action_service": this.params_[ "input_action_service" ], "action": this.params_[ "input_action" ] } );
		_updateActionDeviceParamsShape.call( this );
	},

	onchange: function() {
		var criterias = {
			"action_service": ( this.params_.action_service || this.getFieldValue( "service" ) ),
			"action"        : ( this.params_.action         || this.getFieldValue( "action" ) )
		};
		_checkDeviceFilterConnection.call( this, criterias );
	}
};

// ****************************************************************************
// Blockly - Rule actions - Params
// ****************************************************************************

Blockly.Msg.LIST_ACTION_PARAM_TOOLTIP = "List of action parameters";
Blockly.Msg.LIST_ACTION_PARAM_CREATE_EMPTY_TITLE = "no param";
Blockly.Msg.ACTION_PARAM_LEVEL_TOOLTIP = "Defines for which level of the rule these actions are planned.";
Blockly.Msg.ACTION_PARAM_DELAY_TOOLTIP = "Defines the time to wait before doing the actions.";
Blockly.Msg.ACTION_PARAM_CRITICAL_TOOLTIP = "Defines if these actions can be stopped if the status of the rule changes during their execution (critical can't be stopped).";

Blockly.Blocks['list_action_param'] = function() {};
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
			.appendField( Blockly.Msg.LIST_ACTION_PARAM_CREATE_EMPTY_TITLE );
	} else {
		for (var i = 0; i < this.itemCount_; i++) {
			var input = this.appendValueInput('ADD' + i)
				.setCheck('ActionParam');
		}
	}
	this.setInputsInline(true);
	if (!this.outputConnection) {
		this.setOutput(true, 'ActionParams');
	} else {
		this.outputConnection.setCheck('ActionParams');
	}
	this.setTooltip( Blockly.Msg.LIST_ACTION_PARAM_TOOLTIP );
};

Blockly.Blocks['action_param_level'] = {
	init: function () {
		this.setColour(Blockly.Blocks.actions.HUE1);

		this.appendDummyInput()
			.appendField('for level')
			.appendField(new Blockly.FieldTextInput('0', Blockly.FieldTextInput.numberValidator), 'level');

		this.setInputsInline(true);
		this.setOutput(true, 'ActionParam');
		this.setTooltip( Blockly.Msg.ACTION_PARAM_LEVEL_TOOLTIP );
	}
};

Blockly.Blocks['action_param_delay'] = {
	init: function () {
		this.setColour(Blockly.Blocks.actions.HUE1);

		this.appendDummyInput('delayInterval')
			.appendField('after')
			.appendField(new Blockly.FieldTextInput('0', Blockly.FieldTextInput.numberValidator), 'delayInterval')
			.appendField(new Blockly.FieldDropdown([['seconds', 'S'], ['minutes', 'M'], ['hours', 'H']]), 'unit');

		this.setInputsInline(true);
		this.setOutput(true, 'ActionParam');
		this.setTooltip( Blockly.Msg.ACTION_PARAM_DELAY_TOOLTIP );
	}
};

Blockly.Blocks['action_param_critical'] = {
	init: function () {
		this.setColour(Blockly.Blocks.actions.HUE1);

		this.appendDummyInput()
			.appendField( "is" )
			.appendField( new Blockly.FieldDropdown( [ [ "critical", "TRUE" ], [ "not critical", "FALSE" ] ] ), "isCritical" );

		this.setInputsInline(true);
		this.setOutput(true, 'ActionParam');
		this.setTooltip( Blockly.Msg.ACTION_PARAM_CRITICAL_TOOLTIP );
	}
};
