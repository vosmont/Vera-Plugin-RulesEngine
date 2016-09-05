//# sourceURL=J_RulesEngine1_Blockly.js
"use strict";

/**
 * This file is part of the plugin RulesEngine.
 * https://github.com/vosmont/Vera-Plugin-RulesEngine
 * Copyright (c) 2016 Vincent OSMONT
 * This code is released under the MIT License, see LICENSE.
 */

window.ALTUI_RulesEngineResourcesAreLoaded = true;

( function( $ ) {

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
// Rule
// ****************************************************************************

goog.provide( "Blockly.Blocks.rules" );
Blockly.Blocks.rules.HUE = 140;

Blockly.Msg.RULE_TITLE = "Rule";
Blockly.Msg.RULE_TOOLTIP = "Define a rule.";

/**
 * Blockly hot patch
 * between version 0.09 and 0.10 to get the rule in the UI and be able to save it without loosing informations
 */
Blockly.Block.prototype.getInput = function(name) {
	if (name === "conditions") {
		name = "condition";
	}
	for (var i = 0, input; input = this.inputList[i]; i++) {
		if (input.name == name) {
			return input;
		}
	}
	// This input does not exist.
	return null;
};

Blockly.Blocks[ "rule" ] = {
	hasToCheckDevice: false,

	init: function() {
		this.setColour( Blockly.Blocks.rules.HUE );

		var thatBlock = this;
		this.appendValueInput( "name" )
			.setCheck( "String" )
			.appendField( "rule #" )
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

		// Condition
		this.appendValueInput( "condition" )
			.setCheck( "Boolean" )
			.appendField( "if" );

		// Actions
		this.appendDummyInput()
			.appendField( "do" );
		this.appendStatementInput( "actions" )
			.setCheck( "ActionGroup" );

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
// Rule properties
// ****************************************************************************

goog.provide( "Blockly.Blocks.properties" );
Blockly.Blocks.properties.HUE = 160;

Blockly.Msg.LIST_PROPERTY_TOOLTIP = "List of the properties of the rule.";
Blockly.Msg.LIST_RULE_PROPERTY_TOOLTIP = "List of rule properties";
Blockly.Msg.LIST_RULE_PROPERTY_CREATE_EMPTY_TITLE = "no property";
Blockly.Msg.RULE_PROPERTY_AUTO_UNTRIP_TOOLTIP = "Define the time after which the rule is switched off automatically.";
Blockly.Msg.RULE_PROPERTY_IS_ACKNOWLEDGEABLE_TOOLTIP = "Define if this rule is acknowledgeable.";
Blockly.Msg.RULE_PROPERTY_ROOM_TOOLTIP = "Define the room of this rule.";


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
};
Blockly.Blocks[ "list_property" ].validate = function() {
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

Blockly.Blocks[ "property_room" ] = {
	init: function() {
		this.setColour( Blockly.Blocks.properties.HUE );

		var roomOptions = [ [ "No room", "" ] ];
		$.each( ALTUI_RulesEngine.getRooms(), function( i, rule ) {
			roomOptions.push( [ rule.name, rule.id.toString() ] );
		} );
		this.appendDummyInput()
			.appendField( "room" )
			.appendField( new Blockly.FieldDropdown( roomOptions ), "roomId" );

		this.setInputsInline( true );
		this.setOutput( true, "Property" );
		this.setTooltip(Blockly.Msg.RULE_PROPERTY_ROOM_TOOLTIP);
	}
};

// ****************************************************************************
// Generic functions
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

var _OPERATORS = {
	"=" : "EQ",
	"==": "EQ",
	"<>": "NEQ",
	"<" : "LT",
	"<=": "LTE",
	">" : "GT",
	">=": "GTE"
}

var _INPUTS = {
	"device": {
		"id"      : { "type": "deviceFilter", "isRemovable": true, "isMainField": true, "field": "deviceId", "label": "name", "before": [ "room", "type", "category" ] },
		"room"    : { "type": "deviceFilter", "isRemovable": true, "isMainField": true, "field": "roomId", "label": "in room", "before": [ "type", "category" ] },
		"type"    : { "type": "deviceFilter", "isRemovable": true, "isMainField": true, "field": "deviceType", "label": "type", "before": [ "category" ] },
		"category": { "type": "deviceFilter", "isRemovable": true, "isMainField": true, "field": "category", "label": "category" }
	},
	"condition": {
		"ADD"           : { "type": "value",        "autoCreate": false, "isRemovable": true, "isMultiple": true, "counter": "items", "label": "", "align": "ALIGN_RIGHT", "check": [ "Boolean" ], "before": [ "actions" ] },
		"actions"       : { "type": "statement",    "isRemovable": true, "label": "do", "align": "ALIGN_RIGHT", "check": [ "ConditionActionGroup" ] },
		"params"        : { "type": "value",        "isRemovable": true, "label": "with params", "align": "ALIGN_RIGHT", "check": [ "ConditionParams", "ConditionParam" ], "before": [ "actions" ] },
		//"device_type"   : { "type": "deviceFilter", "isMainField": true, "field": "deviceType", "label": "template", "before": [ "event", "params", "actions" ] },
		"device_type"   : { "type": "dropdown",     "isMainField": true, "field": "deviceType", "options": ALTUI_RulesEngine.getDeviceTypes, "label": "template", "before": [ "event", "params", "actions" ] },
		"event"         : { "type": "dropdown",     "isMainField": true, "field": "eventId", "options": [], "label": "event", "before": [ "params", "actions" ] },
		"service"       : { "type": "deviceFilter", "isMainField": true, "field": "service",  "label": "service",  "before": [ "variable", "params", "actions" ] },
		"variable"      : { "type": "deviceFilter", "isMainField": true, "field": "variable", "label": "variable", "before": [ "params", "actions" ] },
		"time_operator" : { "type": "dropdown",     "isMainField": true, "field": "operator", "options": [ [ "is", "EQ" ], [ "is between", "BW" ] ], "label": "time" },
		"timer_type"    : { "type": "dropdown",     "isMainField": true, "isRemovable": true, "field": "timerType", "options": [ [ "on days of week", "2" ], [ "on days of month", "3" ] ], "label": "", "before": [ "params" ] },
		"timer_relative": { "type": "dropdown",     "isMainField": true, "isRemovable": true, "field": "timerRelative", "options": [ [ "before sunrise", "1" ], [ "after sunrise", "2" ], [ "before sunset", "3" ], [ "after sunset", "4" ] ], "label": "", "before": [ "params" ] }
	},
	"action": {
		"service": { "type": "deviceFilter", "isMainField": true, "field": "service", "label": "service", "before": [ "action", "action_params", "device" ] },
		"action" : { "type": "deviceFilter", "isMainField": true, "field": "action", "label": "action", "before":[ "action_auto_params", "params", "device" ] },
		"params" : { "type": "deviceFilter", "isRemovable": true, "field": "params", "label": "with params" }
	},
	"action_group": {
		"description": { "type": "value", "isRemovable": true, "label": "description", "align": "ALIGN_RIGHT", "check": [ "String" ], "before": [ "params", "conditions", "do" ] },
		"params"     : { "type": "value", "isRemovable": true, "label": "with params", "align": "ALIGN_RIGHT", "check": [ "ActionParams", "ActionParam" ], "before": [ "conditions", "do" ] },
		"condition"  : { "type": "value", "isRemovable": true, "label": "if", "align": "ALIGN_RIGHT", "check": "Boolean", "before": [ "do" ] }
	}
};

function _isEmpty(str) {
	return (!str || 0 === str.length);
}

function _getInputParam( inputName ) {
	if ( _INPUTS[ this.prefix_ ] && _INPUTS[ this.prefix_ ][ inputName ] ) {
		return _INPUTS[ this.prefix_ ][ inputName ];
	}
	return;
}

function _setMutator() {
	var controls = [];
	for ( var i = 0; i < this.inputs_.length; i++ ) {
		var inputName = this.inputs_[ i ];
		var inputParams = _INPUTS[ this.prefix_ ][ inputName ];
		if ( inputParams.isRemovable ) {
			controls.push( "controls_" + this.prefix_ + "_" + inputName );
		}
	}
	if ( controls.length > 0 ) {
		this.setMutator( new Blockly.Mutator( controls ) );
	}
}

function _filterDevice( device, criterias ) {
//console.info( "_filterDevice", device, criterias )
	if ( !criterias ) {
		return true;
	}
	// Filter on controller
	if ( ( criterias.controller_id > -1 ) && ( MultiBox.controllerOf( device.altuiid ).controller !== criterias.controller_id ) ) {
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
	if ( !_isEmpty( criterias.condition_device_type ) && ( device.device_type !== criterias.condition_device_type ) ) {
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
	// Filter on service and variable(s)
	if ( !_isEmpty( criterias.condition_service ) && !_isEmpty( criterias.condition_variable ) ) {
		var deviceServiceVariables = $.map( device.states, function( state ) { return ( state.service + ";" + state.variable ); } );
		var variables = ( $.isArray( criterias.condition_variable ) ? criterias.condition_variable : [ criterias.condition_variable ] );
		for ( var i = 0; i < variables.length; i++ ) {
			if ( $.inArray( criterias.condition_service + ";" + variables[i], deviceServiceVariables ) === -1 ) {
				return false;
			}
		}

		/*
		var isFounded = false;
		for ( var i = 0; i < device.states.length; i++ ) {
			if ( ( device.states[i].service === criterias.condition_service ) && ( device.states[i].variable === criterias.condition_variable ) ) {
				isFounded = true;
				break;
			}
		}
		if ( !isFounded ) {
			return false;
		}
		*/
	} else {
		// Filter on service
		if ( !_isEmpty( criterias.condition_service ) ) {
			var isServiceFounded = false;
			for ( var i = 0; i < device.states.length; i++ ) {
				if ( device.states[i].service === criterias.condition_service ) {
					isServiceFounded = true;
					break;
				}
			}
			if ( !isServiceFounded ) {
				return false;
			}
		}
		// Filter on variable
		if ( !_isEmpty( criterias.condition_variable ) ) {
			var isVariableFounded = false;
			for ( var i = 0; i < device.states.length; i++ ) {
				if ( device.states[i].variable === criterias.condition_variable ) {
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
	if ( !_isEmpty( criterias.action_service ) || !_isEmpty( criterias.action_action ) ) {
		if ( !ALTUI_RulesEngine.hasDeviceActionService( device, criterias.action_service, criterias.action_action ) ) {
			return false;
		}
	}

	return true;
}
function _removeInput( inputName ) {
	if ( this.getInput( inputName ) ) {
		this.removeInput( inputName );
	}
}

function _moveInputBefore( inputName, beforeInputNames ) {
	if ( !this.getInput( inputName ) ) {
		return;
	}
	if ( !beforeInputNames ) {
		var inputParams = _getInputParam.call( this, inputName );
		beforeInputNames = inputParams.before || [];
	}
	for ( var i = 0; i < beforeInputNames.length; i++ ) {
		var beforeInputName = beforeInputNames[ i ];
		if ( this.getInput( beforeInputName ) ) {
			this.moveInputBefore( inputName, beforeInputName );
			break;
		}
	}
}

function _createDeviceFilterInput( inputName, params, onChange ) {
	var inputParams = _getInputParam.call( this, inputName );
	if ( !inputParams || this.getInput( inputName ) ) {
		return;
	}
	this.hasDeviceFilterInputs_ = true;
	var isReadOnly = $( "#rulesengine-blockly-workspace" ).data( "read_only" );
	var thatBlock = this;
	var params = ( params ? params : {});
	var fieldName = inputParams.field;
	var input = this.appendDummyInput( inputName );

	// Icon
	if ( !_isEmpty( params.icon ) ) {
		input.appendField( new Blockly.FieldImage( params.icon, 20, 20, '*') );
	}

	// Label
	var label = ( params.label ? params.label : inputParams.label);
	input.appendField( label );

	if ( params.align ) {
		input.setAlign( Blockly[ params.align ] );
	}

	// Dropdown list
	if ( isReadOnly ) {
		if ( this.params_[ "text_" + inputName ] ) {
			var fieldLabel = new Blockly.FieldLabel( "" );
			input.appendField( this.params_[ "text_" + inputName ] )
				.appendField( fieldLabel, fieldName );
			// Trick to remove the warnings about non-existent input
			fieldLabel.visible_ = false;
		} else {
			input.appendField( new Blockly.FieldTextInput(), fieldName );
		}
	} else {
		input.appendField(
			new Blockly.FieldDropdown( [ [ "...", "" ] ], function( newValue ) {
				// Update the other filters
				thatBlock.filters_[ thatBlock.prefix_ + "_" + inputName ] = newValue;
				_updateDeviceFilterInputs.call( thatBlock, thatBlock.filters_, thatBlock.prefix_ + "_" + inputName );
				if ( typeof( onChange ) === "function" ) {
					onChange.call( thatBlock, inputName, newValue );
				}
				//_setDeviceExternalFilters.call( thatBlock, thatBlock.filters_ );
			} ),
			fieldName
		);
	}
	return input;
}
function _updateDeviceFilterInput( inputName, filters, filteredDevices ) {
	var inputParams = _getInputParam.call( this, inputName );
	if ( !inputParams || ( inputParams.type !== "deviceFilter" ) ) {
		return;
	}
	var fieldName = inputParams.field;
	var dropdown = this.getField( fieldName );
	if ( !dropdown || !dropdown.getOptions_ ) {
		return false;
	}
	var options = dropdown.getOptions_();
	var currentValue = dropdown.getValue();
	var currentText = dropdown.text_;
	options.splice( 1, options.length );

	var filters = ( filters ? $.extend( {}, filters ) : $.extend( {}, this.filters_ ) );
	var fillOptions, sortOptions;
	var indexValues = {};
	var thatBlock = this;
	var filterName = this.prefix_ + "_" + inputName;
	var filterValue = filters[ filterName ];
	delete filters[ filterName ];
	// Choose the function that handle the filling of the dropdown list
	switch ( filterName ) {
		case "device_id":
			fillOptions = function( devices ) {
				$.each( devices, function( i, device ) {
					var deviceId = device.id.toString();
					if ( !indexValues[ deviceId ] ) {
						indexValues[ deviceId ] = true;
						options.push( [ device.name.trim(), deviceId ] );
					}
				} );
			};
			sortOptions = _sortOptionsByName;
			break;
		case "device_room":
			// Get the all the room for the controller
			var indexRooms = { "0": "no room" };
			$.each( MultiBox.getRoomsSync(), function( idx, room ) {
				if ( ( filters.controller_id > -1 ) && ( MultiBox.controllerOf( room.altuiid ).controller === filters.controller_id ) ) {
					indexRooms[ room.id.toString() ] = room.name;
				}
			} );
			fillOptions = function( devices ) {
				$.each( devices, function( i, device ) {
					if ( !device.room ) {
						return;
					}
					var roomId = device.room.toString();
					if ( !indexValues[ roomId ] ) {
						indexValues[ roomId ] = true;
						options.push( [ indexRooms[ roomId ], roomId ] );
					}
				} );
			};
			sortOptions = _sortOptionsByName;
			break;
		case "device_type":
		//case "condition_device_type":
			fillOptions = function( devices ) {
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
			sortOptions = _sortOptionsByName;
			break;
		case "device_category":
			fillOptions = function( devices ) {
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
						if ( device.subcategory_num ) {
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
			sortOptions = _sortOptionsById;
			break;
		case "condition_variable":
			fillOptions = function( devices ) {
				$.each( devices, function( i, device ) {
					$.each( device.states, function( j, state ) {
						if ( !_isEmpty( filters.condition_service ) && ( state.service !== filters.condition_service ) ) {
							return;
						}
						if ( !indexValues[ state.variable ] ) {
							indexValues[ state.variable ] = true;
							options.push( [ state.variable, state.variable ] );
						}
					} );
				} );
			};
			sortOptions = _sortOptionsByName;
			break;
		case "condition_service":
			fillOptions = function( devices ) {
				$.each( devices, function( i, device ) {
					$.each( device.states, function( j, state ) {
						if ( !_isEmpty( filters.condition_variable ) && ( state.variable !== filters.condition_variable ) ) {
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
			sortOptions = _sortOptionsByName;
			break;
		case "action_action":
			fillOptions = function( devices ) {
				$.each( devices, function( i, device ) {
					$.each( ALTUI_RulesEngine.getDeviceActionNames( device, filters.action_service ), function ( i, actionName ) {
						if ( !indexValues[ actionName ] ) {
							indexValues[ actionName ] = true;
							options.push( [ actionName, actionName ] );
						}
					} );
				} );
			};
			sortOptions = _sortOptionsByName;
			break;
		case "action_service":
			fillOptions = function( devices ) {
				$.each( devices, function( i, device ) {
					$.each( ALTUI_RulesEngine.getDeviceActionServiceNames( device, filters.action_action ), function ( i, serviceName ) {
						if ( !indexValues[ serviceName ] ) {
							indexValues[ serviceName ] = true;
							options.push( [ serviceName.substr( serviceName.lastIndexOf( ":" ) + 1 ), serviceName ] );
						}
					} );
				} );
			};
			sortOptions = _sortOptionsByName;
			break;
		default:
			throw 'Unknown input type.';
	}
	if ( fillOptions ) {
		MultiBox.getDevices(
			null,
			function ( device ) {
				return _filterDevice( device, filters );
			},
			function( devices ) {
				fillOptions( devices );
			}
		);
	}
	if ( sortOptions ) {
		options.sort( sortOptions );
	}
	if ( filteredDevices.length === 0 ) {
		// No filtered device : add former value
		if ( currentValue != "" ) {
			options.push( [ "(invalid) " + currentText, currentValue ] );
		}
	} else if ( currentValue && !indexValues[ currentValue ] ) {
		// The choosen value is no more in the dropdown values
		dropdown.setValue( "" );
	} else if ( currentValue !== "" ) {
		// Refresh text
		dropdown.setValue( currentValue );
	}
}
function _updateDeviceFilterInputs( newFilters, excludedInput ) {
//console.info( "_updateDeviceFilterInputs", this.id, newFilters, excludedInput )
//console.info( "_updateDeviceFilterInputs", this.id, this.filters_, this.externalFilters_ )
	if ( !this.hasDeviceFilterInputs_ ) {
		return;
	}
	var thatBlock = this;
	var hasToFilter = false;
	if ( newFilters ) {
		this.filters_ = newFilters;
		hasToFilter = true;
	}
	if ( this.filteredDevices == null ) {
		hasToFilter = true;
	}
	var filters = $.extend( {}, this.filters_ );
	if ( hasToFilter ) {
		// Apply new filters on the devices
		MultiBox.getDevices(
			null,
			function ( device ) {
				return _filterDevice( device, filters );
			},
			function( devices ) {
				thatBlock.filteredDevices = devices;
			}
		);
//console.info("get filtered devices", this.id, this.filters_, this.filteredDevices.length );
	}

	// Apply the external filters
	var filteredDevices;
	if ( this.externalFilters_ ) {
		$.extend( filters, this.externalFilters_ );
		filteredDevices = [];
		$.each( this.filteredDevices, function( i, device ) {
			if ( _filterDevice( device, filters ) ) {
				filteredDevices.push( device );
			}
		} );
//console.info("get filtered devices with external filters", this.id, filters, this.filteredDevices.length, filteredDevices.length );
	} else {
		filteredDevices = this.filteredDevices;
	}

	// Apply the filters on the device inputs
	for ( var i = 0; i < this.inputs_.length; i++ ) {
		var inputName = this.inputs_[ i ];
		if ( this.getInput( inputName ) ) {
			if ( excludedInput && ( excludedInput === inputName ) ) {
				continue;
			}
			_updateDeviceFilterInput.call( this, inputName, filters, filteredDevices );
		}
	}

	// Update the device label if exists (nb filtered devices)
	if ( ( this.getField( "deviceLabel" ) != null ) && ( this.getField( "deviceLabel" ).textElement_ != null ) ) {
		var deviceLabel;
		if ( ( filteredDevices == null ) || ( filteredDevices.length === 0 ) ) {
			deviceLabel = "no device";
			this.setWarningText( "no device" );
		} else if ( filteredDevices.length > 1 ) {
			deviceLabel = filteredDevices.length + " devices";
			this.setWarningText();
		} else {
			deviceLabel = "1 device";
			this.setWarningText();
		}
		this.getField( "deviceLabel" ).textElement_.innerHTML = deviceLabel;
	}

	filteredDevices = null;
}

function _createInput( inputName, params, onChange, index ) {
	if ( this.getInput( inputName ) ) {
		return;
	}
	var thatBlock = this;
	var params = ( params ? params : {} );
	var inputParams = _getInputParam.call( this, inputName );
	switch ( inputParams.type ) {
		case "deviceFilter":
			_createDeviceFilterInput.call( this, inputName, params, onChange );
			break;

		case "value":
			if ( inputParams.isMultiple ) {
				inputName = inputName + ( index || "0" );
			}
			var input = this.appendValueInput( inputName );
			var check = ( params.check ? params.check : inputParams.check );
			if ( !_isEmpty( check ) ) {
				input.setCheck( check );
			}
			var label = ( params.label ? params.label : inputParams.label );
			if ( !_isEmpty( label ) ) {
				input.appendField( label );
			}
			if ( inputParams.align ) {
				input.setAlign( Blockly[ inputParams.align ] );
			}
			break;

		case "dropdown":
			var input = this.appendDummyInput( inputName );
			var label = ( params.label ? params.label : inputParams.label );
			if ( !_isEmpty( label ) ) {
				input.appendField( label );
			}
			if ( inputParams.align ) {
				input.setAlign( Blockly[ inputParams.align ] );
			}
			var options;
			if ( typeof( inputParams.options ) === "function" ) {
				options = [ [ "...", "" ] ];
				$.each( inputParams.options(), function( i, option ) {
					options.push( [ option.substr( option.lastIndexOf( ":", option.length - 3 ) + 1 ), option ] );
				} );
				options.sort( _sortOptionsByName );
			} else {
				options = inputParams.options
			}
			input.appendField(
				new Blockly.FieldDropdown( options, function( newValue ) {
					thatBlock.filters_[ thatBlock.prefix_ + "_" + inputName ] = newValue;
					if ( typeof( onChange ) === "function" ) {
						onChange.call( thatBlock, inputName, newValue );
					}
				} ),
				inputParams.field
			);
			/*
			if ( typeof( onChange ) === "function" ) {
				onChange.call( thatBlock, inputName );
			}
			*/
			break;

		case "statement":
			var input = this.appendStatementInput( inputName );
			var check = ( params.check ? params.check : inputParams.check );
			if ( !_isEmpty( check ) ) {
				input.setCheck( check );
			}
			var label = ( params.label ? params.label : inputParams.label );
			if ( !_isEmpty( label ) ) {
				input.appendField( label );
			}
			if ( inputParams.align ) {
				input.setAlign( Blockly[ inputParams.align ] );
			}

		default:
	}
	if ( !_isEmpty( inputParams.before ) ) {
		_moveInputBefore.call( this, inputName, inputParams.before );
	}
}

// Set external filters of connected devices
function _setDeviceExternalFilters( filters ) {
	$.each( _getLinkedDeviceBlocks.call( this ), function( i, deviceBlock ) {
		deviceBlock.setExternalFilters( filters );
	} );
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
	var name1 = a[ 0 ].toUpperCase();
	var name2 = b[ 0 ].toUpperCase();
	if ( name1 < name2 ) {
		return -1;
	}
	if ( name1 > name2 ) {
		return 1;
	}
	return 0;
}

function _updateMutationWithParams( attributeNames, container ) {
	for ( var i = 0; i < attributeNames.length; i++ ) {
		var attributeName = attributeNames[i];
		if ( this.params_[ attributeName ] ) {
			container.setAttribute( attributeName, this.params_[ attributeName ] );
		} else {
			var attributeParams = _getInputParam.call( this, attributeName );
			if ( attributeParams && attributeParams.field && this.getField( attributeParams.field ) ) {
				if ( attributeParams.isMainField ) {
					// Attribute used for input construction
					container.setAttribute( "input_" + attributeName, this.getFieldValue( attributeParams.field ) );
				}
				if ( attributeParams.type === "deviceFilter" ) {
					// Store text value for readonly mode
					container.setAttribute( "text_" + attributeName, this.getField( attributeParams.field ).text_ );
				}
			}
		}
	}
	if ( !container.hasAttributes() ) {
		// Force mutation
		container.setAttribute( "dummy", "" );
	}
}
function _loadParamsFromMutation( xmlElement, attributeNames ) {
	this.params_ = {};
	if ( !xmlElement ) {
		return;
	}
	for ( var i = 0; i < attributeNames.length; i++ ) {
		var attributeName = attributeNames[i];
		if ( xmlElement.getAttribute( attributeName ) ) {
			this.params_[ attributeName ] = xmlElement.getAttribute( attributeName );
		}
		if ( xmlElement.getAttribute( "input_" + attributeName ) ) {
			this.params_[ "input_" + attributeName ] = xmlElement.getAttribute( "input_" + attributeName );
		}
		if ( xmlElement.getAttribute( "text_" + attributeName ) ) {
			this.params_[ "text_" + attributeName ] = xmlElement.getAttribute( "text_" + attributeName );
		}
	}
}

// Save choosen removable inputs, to be able to add them to shape next time
function _updateMutationWithRemovableInputs( container ) {
	var inputs = [];
	for ( var i = 0; i < this.inputs_.length; i++ ) {
		var inputName = this.inputs_[ i ];
		var inputParams = _getInputParam.call( this, inputName );
		if ( inputParams && inputParams.isRemovable && this.getInput( inputName ) ) {
			// The removable input has been added
			inputs.push( inputName );
		}
	}
	if ( inputs.length > 0 ) {
		container.setAttribute( "inputs", inputs.join( "," ) );
	}
}
function _createInputsFromMutation( xmlElement, onChange ) {
	// TODO : remove in 0.11
	var pluginVersion = $( "#rulesengine-blockly-workspace" ).data( "plugin_version" );
	var ruleVersion = $( "#rulesengine-blockly-workspace" ).data( "rule_version" );
	var ruleId = $( "#rulesengine-blockly-workspace" ).data( "rule_id" );
	var inputs = xmlElement.getAttribute( "inputs" );
	if ( inputs ) {
		inputs = inputs.split( "," );
		// Update shape
		for ( var i = 0; i < inputs.length; i++ ) {
			var inputToCreate = inputs[ i ];
			// Because of modifications, have to be compliant with former versions
			for ( var j = 0; j < this.inputs_.length; j++ ) {
				var inputName = this.inputs_[ j ];
				var inputParams = _getInputParam.call( this, inputName );
				if ( inputParams && inputParams.isRemovable
					&& ( ( inputToCreate === inputName )
						|| ( inputToCreate === this.prefix_ + "_" + inputName )       // old
						|| ( inputToCreate === this.prefix_ + "_" + inputName + "s" ) // old
					)
				) {
					_createInput.call( this, inputName, null, onChange );
					if ( inputParams.before ) {
						_moveInputBefore.call( this, inputName, inputParams.before );
					}
				}
			}
		
		}
	} else if ( ruleId && ( pluginVersion === "0.10" ) && ( ruleVersion !== "0.10" ) && ( inputs !== "" ) ) {
		// TODO : temporary
		// Compliance with older version (some inputs are constructed by mutator now)
		for ( var i = 0; i < this.inputs_.length; i++ ) {
			var inputName = this.inputs_[ i ];
			var inputParams = _getInputParam.call( this, inputName );
			if ( inputParams && inputParams.isRemovable ) {
				_createInput.call( this, inputName, null, onChange );
			}
		}
	}
}

function _decompose( workspace ) {
	var containerBlock = Blockly.Block.obtain( workspace, "controls_" +  this.prefix_ );
	containerBlock.initSvg();
	var connection = containerBlock.getInput( "STACK" ).connection;
	for ( var i = 0; i < this.inputs_.length; i++ ) {
		var inputName = this.inputs_[ i ];
		var inputParams = _getInputParam.call( this, inputName );
		if ( Blockly.Blocks[ "controls_" + this.prefix_ + "_" + inputName ] ) {
			var nbBlocksToCreate = 0;
			if ( inputParams.isMultiple ) {
				nbBlocksToCreate = this.params_[ inputParams.counter ] != null ? this.params_[ inputParams.counter ] : 0;
			} else if ( this.getInput( inputName ) != null ) {
				nbBlocksToCreate = 1;
			}
			if ( nbBlocksToCreate === 0 ) {
				continue;
			}
			var j = 0;
			do {
				var block = Blockly.Block.obtain( workspace, "controls_" + this.prefix_ + "_" + inputName );
				if ( block ) {
					block.initSvg();
					connection.connect( block.previousConnection );
					connection = block.nextConnection;
				}
				j++;
			} while ( j < nbBlocksToCreate );
		}
	}
	return containerBlock;
}
function _compose( containerBlock, onChange ) {
	var nbExpectedInputs = {}; // Nb inputs in the mutator pop-up
	var block = containerBlock.getInputTargetBlock( "STACK" );
	var controlsPrefix = "controls_" + this.prefix_ + "_";
	while ( block ) {
		if ( block.type.indexOf( controlsPrefix ) === 0 ) {
			var inputName = block.type.substring( controlsPrefix.length ); // Remove prefix from the type
			if ( nbExpectedInputs[ inputName ] ) {
				nbExpectedInputs[ inputName ]++;
			} else {
				nbExpectedInputs[ inputName ] = 1;
			}
		}
		block = block.nextConnection && block.nextConnection.targetBlock();
	}
	if ( this.savedConnections_ == null ) {
		this.savedConnections_ = {};
	}
	for ( var i = 0; i < this.inputs_.length; i++ ) {
		var inputName = this.inputs_[ i ];
		var inputParams = _getInputParam.call( this, inputName );
		if ( nbExpectedInputs[ inputName ] == null ) {
			nbExpectedInputs[ inputName ] = 0;
		}
		if ( inputParams.isRemovable ) {
			// Delete the overinputs
			if ( inputParams.isMultiple ) {
				if ( this.savedConnections_[ inputName ] == null ) {
					this.savedConnections_[ inputName ] = [];
				}
				for ( var j = nbExpectedInputs[ inputName ]; j < this.params_[ inputParams.counter ]; j++ ) {
					var input = this.getInput( inputName + j );
					if ( input ) {
						if ( input.connection && ( this.savedConnections_[ inputName ].indexOf( input.connection.targetConnection ) === -1 ) ) {
							this.savedConnections_[ inputName ].push( input.connection.targetConnection );
						}
						_removeInput.call( this, inputName + j );
					}
				}
				this.params_[ inputParams.counter ] = nbExpectedInputs[ inputName ];
			} else if ( nbExpectedInputs[ inputName ] === 0 ) {
				var input = this.getInput( inputName );
				if ( input ) {
					if ( input.connection ) {
						this.savedConnections_[ inputName ] = [ input.connection.targetConnection ];
					}
					_removeInput.call( this, inputName );
				}
			}
		}
		if ( nbExpectedInputs[ inputName ] > 0 ) {
			// Create the inputs
			if ( inputParams.autoCreate !== false) {
				_createInput.call( this, inputName, {}, onChange );
				if ( inputParams.before ) {
					_moveInputBefore.call( this, inputName, inputParams.before );
				}
			}
		} else {
			// Remove the filter linked to the unwanted input
			if ( this.filters_ && this.filters_[ this.prefix_ + "_" + inputName ] ) {
				delete this.filters_[ this.prefix_ + "_" + inputName ];
			}
		}
	}
	_updateDeviceFilterInputs.call( this );
}
function _getLastSavedValidConnection( inputName ) {
	var connection = this.savedConnections_ && this.savedConnections_[ inputName ] && this.savedConnections_[ inputName ].pop();
	while ( connection ) {
		if ( !connection.sourceBlock_.workspace || connection.targetConnection ) {
			// The saved connection has been reused or deleted
			connection = this.savedConnections_[ inputName ].pop();
		} else {
			return connection;
		}
	}
}

function _getDeviceBlockRealParent() {
	var parent = this.getParent();
	if ( parent && ( parent.type === "list_device" ) ) {
		parent = parent.getParent();
	}
	return parent;
}
function _getLinkedDeviceBlocks() {
	var inputDevice = this.getInput( "device" );
	if ( !inputDevice ) {
		return [];
	}
	var connection = inputDevice.connection;
	var device = connection && connection.targetBlock();
	if ( !device ) {
		return [];
	}
	var devices = [];
	if ( device.type === "list_device" ) {
		for ( var i = 0; i < device.inputList.length; i++ ) {
			var subConnection = device.inputList[i].connection;
			var subDevice = subConnection && subConnection.targetBlock();
			if ( subDevice ) {
				devices.push( subDevice );
			}
		}
	} else {
		devices.push( device );
	}
	return devices;
}

function _setFiltersFromFieldValues() {
	this.filters_ = {};
	for ( var i = 0; i < this.inputs_.length; i++ ) {
		var inputName = this.inputs_[ i ];
		var filterName = this.prefix_ + "_" + inputName;
		if ( this.filters_[ filterName ] == null ) {
			var inputParams = _getInputParam.call( this, inputName );
			var fieldValue = this.getFieldValue( inputParams.field );
			this.filters_[ filterName ] = fieldValue || this.params_[ "input_" + inputName ];
		}
	}
}

// ****************************************************************************
// List of devices
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
	this.setInputsInline( false );
	if ( !this.outputConnection ) {
		this.setOutput( true, "Devices" );
	} else {
		this.outputConnection.setCheck( "Devices" );
	}
};
Blockly.Blocks[ "list_device" ].validate = function() {
	this.setTooltip(Blockly.Msg.LIST_DEVICE_TOOLTIP);
};

// ****************************************************************************
// Device
// ****************************************************************************

goog.require('goog.array');

goog.provide( "Blockly.Blocks.device" );

Blockly.Msg.DEVICE_TOOLTIP = "The number of device is the devices that are matching the selected criterias (included those implied by the connection).";
Blockly.Msg.CURRENT_DEVICE_TOOLTIP = "TODO - Only compatible with action";
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
		this.prefix_ = "device";
		this.params_ = {};
		this.filters_ = {};
		this.externalFilters_ = null;
		this.parent_ = null;
		this.inputs_ = [ "id", "room", "type", "category" ];

		this.appendDummyInput( "number_of_device" )
			.appendField( "device", "deviceLabel" );

		_setMutator.call( this );

		this.setInputsInline( false );
		this.setOutput( true, "Device" );
		this.setTooltip( Blockly.Msg.DEVICE_TOOLTIP );
	},

	mutationToDom: function() {
		var container = document.createElement( "mutation" );
		_updateMutationWithRemovableInputs.call( this, container );
		_updateMutationWithParams.call( this, this.inputs_, container );
		return container;
	},

	domToMutation: function( xmlElement ) {
		_loadParamsFromMutation.call( this, xmlElement, this.inputs_ );
		_createInputsFromMutation.call( this, xmlElement );
	},

	decompose: function( workspace ) {
		return _decompose.call( this, workspace );
	},

	compose: function( containerBlock ) {
		_compose.call( this, containerBlock );
	},

	validate: function() {
		_setFiltersFromFieldValues.call( this );
		// TODO : stocker autre part le controllerId ?
		this.filters_.controller_id = $( "#rulesengine-blockly-workspace" ).data( "controller_id" );
		if ( !this.filters_.controller_id ) { // TODO : is this a typo ?
			this.filters_.controller_id = parseInt( this.filters_.controller_id, 10 );
		}
	},

	setExternalFilters: function( filters ) {
		var isModified = true;
		if ( filters && this.externalFilters_) {
			var newFilters = $.extend( {}, this.externalFilters_, filters );
			var externalFilters = this.externalFilters_;
			isModified = false;

			function _toString( obj ) {
				if ( obj ) {
					return obj.toString();
				}
			}

			$.each( newFilters, function( key, value ) {
				if ( !filters.hasOwnProperty( key )
					|| !externalFilters.hasOwnProperty( key )
					|| ( _toString( filters[ key ] ) !== _toString( externalFilters[ key ] ) ) 
				) {
					isModified = true;
				}
			} );
		}
		if ( isModified ) {
			this.externalFilters_ = $.extend( {}, filters );
			_updateDeviceFilterInputs.call( this );
		}
	},

	onchange: function() {
		var parent = _getDeviceBlockRealParent.call( this );
		if ( parent == null ) {
			if ( this.parent_ ) {
				this.parent_ = null;
				if ( this.externalFilters_ ) {
					// Clear external filters if the connection if broken
					this.setExternalFilters( null );
				}
			}
		} else if ( parent !== this.parent_ ) {
			// New parent
			this.parent_ = parent;
			this.setExternalFilters( parent.getFilters() );
		}
	}
};

Blockly.Blocks[ "current_device" ] = {
	init: function() {
		this.setColour( Blockly.Blocks.devices.HUE );
		this.prefix_ = "device";
		this.params_ = {};
		this.filters_ = {};
		this.externalFilters_ = null;
		this.parent_ = null;

		this.appendDummyInput()
			.appendField( "current device", "deviceLabel" );

		this.setInputsInline( false );
		this.setOutput( true, "Device" );
		this.setTooltip( Blockly.Msg.CURRENT_DEVICE_TOOLTIP );
	},

	checkParent: function() {
		var parent = _getDeviceBlockRealParent.call( this );
		if ( parent == null ) {
			if ( this.parent_ ) {
				// The connection with the parent has been deleted
				this.parent_ = null;
			}
		} else if ( parent !== this.parent_ ) {
			// New parent
			if ( parent.type === "action_device" ) {
				this.parent_ = parent;
			} else {
				// The device is only compatible with device action block
				this.unplug();
			}
		}
	},

	setExternalFilters: function( filters ) {
		this.checkParent();
	},

	onchange: function() {
		this.checkParent();
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
// List of conditions
// ****************************************************************************

goog.require( "Blockly.Blocks" );

goog.provide( "Blockly.Blocks.conditions" );
Blockly.Blocks.conditions.HUE1 = 40;
Blockly.Blocks.conditions.HUE2 = 40;
Blockly.Blocks.conditions.HUE3 = 50;

Blockly.Msg.LIST_CONDITION_WITH_OPERATOR_TITLE = "List of conditions.";
Blockly.Msg.LIST_CONDITION_EMPTY_TITLE = "no condition";

Blockly.Blocks[ "list_with_operator_condition" ] = {
	init: function() {
		this.setHelpUrl( Blockly.Msg.LISTS_CREATE_WITH_HELPURL );
		this.setColour( Blockly.Blocks.conditions.HUE1 );
		this.prefix_ = "condition";
		this.params_ = { "items": 3 };
		this.inputs_ = [ "ADD", "actions" ];
		_setMutator.call( this );

		this.updateShape_();
		this.setInputsInline( false );
		this.setOutput( true, "Boolean" );
		this.setTooltip(Blockly.Msg.LIST_CONDITION_WITH_OPERATOR_TITLE);
	},

	mutationToDom: function() {
		var container = document.createElement( "mutation" );
		_updateMutationWithRemovableInputs.call( this, container );
		_updateMutationWithParams.call( this, [ "items" ], container );
		this.params_[ "items" ] = parseInt( this.params_[ "items" ], 10 );
		return container;
	},

	domToMutation: function( xmlElement ) {
		_loadParamsFromMutation.call( this, xmlElement, [ "items" ] );
		this.updateShape_();
		_createInputsFromMutation.call( this, xmlElement );
	},

	decompose: function( workspace ) {
		return _decompose.call( this, workspace );
	},

	compose: function( containerBlock ) {
		_compose.call( this, containerBlock );
		this.updateShape_();
	},

	updateShape_: function() {
		// Clean
		if ( ( this.params_[ "items" ] > 0 ) && this.getInput('EMPTY') ) {
			this.removeInput('EMPTY');
		} else {
			var i = this.params_[ "items" ];
			while ( this.getInput( "ADD" + i ) ) {
				this.removeInput( "ADD" + i );
				i++;
			}
		}
		// Build missing inputs
		if ( this.params_[ "items" ] === 0 ) {
			if ( this.getInput( "EMPTY" ) == null ) {
				this.appendDummyInput( "EMPTY" )
					.appendField( Blockly.Msg.LIST_CONDITION_EMPTY_TITLE );
				_moveInputBefore.call( this, "EMPTY", [ "actions" ] );
			}
		} else {
			for ( var i = 0; i < this.params_[ "items" ]; i++ ) {
				if ( this.getInput( "ADD" + i ) == null ) {
					var input = this.appendValueInput( "ADD" + i )
						.setCheck( "Boolean" );
					if ( ( i === 0 ) && ( this.params_[ "items" ] > 1 ) ) {
						input.appendField( new Blockly.FieldDropdown( [
								[ "one is true", "OR" ],
								[ "all are true", "AND" ]
							] ),
							"operator"
						);
					}
					_moveInputBefore.call( this, "ADD" + i, [ "actions" ] );
					// Restore last connection if exists
					var connection = _getLastSavedValidConnection.call( this, "ADD" );
					if ( connection ) {
						input.connection.connect( connection );
					}
				}
			}
		}
	}

};

Blockly.Blocks[ "list_with_operators_condition" ] = {
	init: function() {
		this.setHelpUrl( Blockly.Msg.LISTS_CREATE_WITH_HELPURL );
		this.setColour( Blockly.Blocks.conditions.HUE1 );
		this.prefix_ = "condition";
		this.params_ = { "items": 3 };
		this.inputs_ = [ "ADD", "actions" ];
		_setMutator.call( this );

		this.updateShape_();
		this.setInputsInline( false );
		this.setOutput( true, "Boolean" );
		this.setTooltip(Blockly.Msg.LIST_CONDITION_WITH_OPERATOR_TITLE);
	},

	mutationToDom: function() {
		var container = document.createElement( "mutation" );
		_updateMutationWithRemovableInputs.call( this, container );
		_updateMutationWithParams.call( this, [ "items" ], container );
		this.params_[ "items" ] = parseInt( this.params_[ "items" ], 10 );
		return container;
	},

	domToMutation: function( xmlElement ) {
		_loadParamsFromMutation.call( this, xmlElement, [ "items" ] );
		this.updateShape_();
		_createInputsFromMutation.call( this, xmlElement );
	},

	decompose: function( workspace ) {
		return _decompose.call( this, workspace );
	},

	compose: function( containerBlock ) {
		_compose.call( this, containerBlock );
		this.updateShape_();
	},

	updateShape_: function() {
		// Clean
		if ( ( this.params_[ "items" ] > 0 ) && this.getInput('EMPTY') ) {
			this.removeInput('EMPTY');
		} else {
			var i = this.params_[ "items" ];
			while ( this.getInput( "ADD" + i ) ) {
				this.removeInput( "ADD" + i );
				i++;
			}
		}
		// Build missing inputs
		if ( this.params_[ "items" ] === 0 ) {
			if ( this.getInput( "EMPTY" ) == null ) {
				this.appendDummyInput( "EMPTY" )
					.appendField( Blockly.Msg.LIST_CONDITION_EMPTY_TITLE );
				_moveInputBefore.call( this, "EMPTY", [ "actions" ] );
			}
		} else {
			for ( var i = 0; i < this.params_[ "items" ]; i++ ) {
				if ( this.getInput( "ADD" + i ) == null ) {
					var input = this.appendValueInput( "ADD" + i )
						.setCheck( "Boolean" );
					if ( i > 0 ) {
						input.appendField( new Blockly.FieldDropdown( [
								[ "or", "OR" ],
								[ "and", "AND" ]
							] ),
							"operator" + i
						);
					}
					_moveInputBefore.call( this, "ADD" + i, [ "actions" ] );
					// Restore last connection if exists
					var connection = _getLastSavedValidConnection.call( this, "ADD" );
					if ( connection ) {
						input.connection.connect( connection );
					}
				}
			}
		}
	}

};


// ****************************************************************************
// Conditions - Types
// ****************************************************************************

Blockly.Msg.CONDITION_DEVICE_VALUE_TOOLTIP = "Condition on the value of a device's variable.";
Blockly.Msg.CONDITION_TIME_TOOLTIP = "Condition on time.";
Blockly.Msg.CONDITION_TIME_BETWEEN_TOOLTIP = "Condition on time between two boundaries.";
Blockly.Msg.CONDITION_RULE_TOOLTIP = "Condition on the status of another rule.";
Blockly.Msg.CONDITION_INVERTER_TOOLTIP = "Inverts the linked condition (NOT).";
Blockly.Msg.CONDITION_MQTT_TOOLTIP = "(TODO)Condition on a received message from MQTT broker.";

Blockly.Msg.CONTROLS_CONDITION_TITLE = "condition";
Blockly.Msg.CONTROLS_CONDITION_TOOLTIP = "Condition.";
Blockly.Msg.CONTROLS_CONDITION_ADD_TITLE = "subcondition";
Blockly.Msg.CONTROLS_CONDITION_ADD_TOOLTIP = "Subcondition.";
Blockly.Msg.CONTROLS_CONDITION_TIMER_TYPE_TITLE = "days";
Blockly.Msg.CONTROLS_CONDITION_TIMER_TYPE_TOOLTIP = "Days of week or month during which the condition is valid.";
Blockly.Msg.CONTROLS_CONDITION_TIMER_RELATIVE_TITLE = "relative";
Blockly.Msg.CONTROLS_CONDITION_TIMER_RELATIVE_TOOLTIP = "Time is relative to sunrise/sunset.";
Blockly.Msg.CONTROLS_CONDITION_PARAMS_TITLE = "parameters";
Blockly.Msg.CONTROLS_CONDITION_PARAMS_TOOLTIP = "Parameters that modify the condition.";
Blockly.Msg.CONTROLS_CONDITION_ACTIONS_TITLE = "actions";
Blockly.Msg.CONTROLS_CONDITION_ACTIONS_TOOLTIP = "Actions to do on condition changes.";

function _updateConditionValueShape( onChange ) {
	_removeInput.call( this, "variable" );
	_removeInput.call( this, "service" );

	// Device type
	this.getField( "conditionDeviceLabel" ).text_ = ( this.params_.device_label ? this.params_.device_label : "device" );

	// Event
	if ( this.params_.condition_type === "event" ) {
		var thatBlock = this;
		_createInput.call( this, "device_type", {}, function( inputName, newDeviceType ) {
			_updateConditionEventShape.call( thatBlock, newDeviceType, null, null, onChange );
		} );
		_moveInputBefore.call( this, "device_type" );
		_updateConditionEventShape.call( this,
			this.params_.device_type || this.params_.input_device_type,
			this.params_.event || this.params_.input_event,
			this.params_.value || this.params_.variable,
			onChange
		);
		return;
	}

	// Variable
	if ( ( this.params_.variable == null ) || ( this.params_.operator == null ) || ( this.params_.value == null ) ) {
		var variableInput;
		if ( this.params_.variable == null ) {
			variableInput = _createDeviceFilterInput.call( this, "variable", { "icon": this.params_.icon, "label": this.params_.variable_label }, onChange );
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
			if ( this.params_.operators ) {
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
		_moveInputBefore.call( this, "variable" );
	}

	// Service
	if ( this.params_.service == null ) {
		_createDeviceFilterInput.call( this, "service", null, onChange );
		_moveInputBefore.call( this, "service" );
	}
}

function _getEventList( deviceType ) {
	var eventList = {};
	var devicetypesDB = MultiBox.getDeviceTypesDB( "0" ); // TODO : controller_id
	var dt = devicetypesDB[ deviceType ];
	$.each( dt, function( key, value ) {
		if ( value.ui_static_data && value.ui_static_data.eventList2 ) {
			for ( var i = 0; i < value.ui_static_data.eventList2.length; i++ ) {
				var event = value.ui_static_data.eventList2[ i ];
				eventList[ event.id.toString() ] = event;
			}
		}
	} );
	return eventList;
}

function _getCleanText( label ) {
	if ( ( label == null ) || ( label.text == null ) ) {
		return "unknown";
	}
	return label.text.replace( "_DEVICE_NAME_", "device" ).replace( "_ARGUMENT_VALUE_", "value" );
}
function _getAllowedValue( allowedValue ) {
	// Vera implementation is a bit surprising
	// value can be in "value", "on", "off", "m1", "m2", ...
	var value = "0";
	$.each( allowedValue, function( key, tmpValue ) {
		if ( key !== "HumanFriendlyText" ) {
			value = tmpValue;
		}
	} );
	return value;
}

function _updateConditionEventShape( deviceType, eventId, value, onChange ) {
	var thatBlock = this;
	// Clean
	thatBlock.params_.service = null;
	thatBlock.params_.variable = null;
	thatBlock.params_.operator = null;
	thatBlock.params_.value    = null;
	_removeInput.call( this, "event" );
	for ( var i = 0; i < 10; i++ ) {
		_removeInput.call( this, "and" + i );
		_removeInput.call( this, "value" + i );
	}

	// Device condition event
	if ( deviceType ) {

		// Get the list of events
		var eventList = _getEventList( deviceType )
		var inputParams = _getInputParam.call( this, "event" );
		inputParams.options = [];
		$.each( eventList, function( eventId, event ) {
			inputParams.options.push( [ _getCleanText( event.label ), eventId ] );
		} );

		if ( inputParams.options.length > 0 ) {
			inputParams.options.sort( _sortOptionsById );
			if ( eventId == null ) {
				eventId = inputParams.options[0][1];
			}

			var _setVariable = function( multiVariables ) {
				if ( multiVariables.length > 1 ) {
					// MultiVariable: Armed;EQ;1|Tripped;EQ;1
					thatBlock.params_.variable  = $.map( multiVariables, function( multiVariable ) { return multiVariable.join( ";" ); } ).join( "|" );
					thatBlock.params_.variables = $.map( multiVariables, function( multiVariable ) { return multiVariable[0]; } );
					thatBlock.params_.operator  = null;
					thatBlock.params_.value     = null;
				} else if ( multiVariables.length === 1 ) {
					// One variable
					thatBlock.params_.variable  = multiVariables[0][0];
					thatBlock.params_.variables = null;
					thatBlock.params_.operator  = multiVariables[0][1];
					thatBlock.params_.value     = multiVariables[0][2];
				}
			};

			var _onEventChange = function( inputName, newEventId ) {
				for ( var i = 0; i < 10; i++ ) {
					_removeInput.call( thatBlock, "and" + i );
					_removeInput.call( thatBlock, "value" + i );
				}
				var event = eventList[ newEventId ];
				if ( event == null ) {
					return;
				}
				// Service
				thatBlock.params_.service = event.serviceId;
				// Variable(s)
				var multiVariables = [];

				if ( event.serviceStateTable ) {
					// Predefined variable/operator/value
					$.each( event.serviceStateTable, function( variableName, serviceState ) {
						multiVariables.push( [ variableName , _OPERATORS[ serviceState.comparisson ], serviceState.value ] );
					} );

				} else if ( event.argumentList ) {
					var initialValues = [];
					if ( value ) {
						// Get initial values
						initialValues = $.map( value.split( "|" ), function( multiVariable ) {
							if ( multiVariable.indexOf( ";" ) > -1 ) {
								var items = multiVariable.split( ";" );
								return ( items[2] != null ? items[2] : "" );
							} else {
								return multiVariable;
							}
						} );
					}

					// List of arguments
					$.each( event.argumentList, function( i, argument ) {
						if ( i > 0 ) {
							thatBlock
								.appendDummyInput( "and" + i )
								.appendField( "AND" );
						}

						var _onValueChange = function( newValue ) {
							// TODO : check value (dataType, minValue, maxValue)
							multiVariables[ i ] = [ argument.name, _OPERATORS[ argument.comparisson ], newValue ];
							_setVariable( multiVariables );
							if ( typeof( onChange ) === "function" ) {
								onChange.call( thatBlock, "value", newValue );
							}
							return newValue;
						};

						var variableInput = thatBlock.appendDummyInput( "value" + i );
						var initialValue = initialValues[i] || argument.defaultValue || "";
						if ( argument.allowedValueList ) {
							// List of allowed values
							var options = [];
							$.each( argument.allowedValueList, function( j, allowedValue ) {
								options.push( [
									_getCleanText( allowedValue.HumanFriendlyText ),
									_getAllowedValue( allowedValue )
								] );
							} );
							var dropdown = new Blockly.FieldDropdown( options, _onValueChange );
							dropdown.setValue( initialValue );
							variableInput.appendField( dropdown, "value" + i );
						} else {
							// Value has to be set by user
							if ( argument.prefix && argument.prefix.text ) {
								variableInput.appendField( argument.prefix.text );
							}
							variableInput
								.appendField( argument.comparisson )
								.appendField( new Blockly.FieldTextInput( "", _onValueChange ), "value" + i );
							if ( argument.suffix && argument.suffix.text ) {
								variableInput.appendField( argument.suffix.text );
							}
						}
						_moveInputBefore.call( thatBlock, "value" + i, [ "params", "actions" ] );
						// Initial value or default value
						_onValueChange( initialValue );
					} );
				}

				_setVariable( multiVariables );
				if ( typeof( onChange ) === "function" ) {
					onChange.call( thatBlock, "event", newEventId );
				}
			};

			_createInput.call( this, "event", {}, _onEventChange );
			_moveInputBefore.call( this, "event" );
			// Initial event
			_onEventChange( "event", eventId );
		}
	}
}

Blockly.Blocks[ "condition_value" ] = {
	init: function() {
		this.setColour( Blockly.Blocks.conditions.HUE2 );
		this.prefix_ = "condition";
		this.filters_ = {};
		this.params_ = {};
		this.inputs_ = [ "actions", "params", "device_type", "variable", "service" ];

		this.appendValueInput( "device" )
			.appendField( "device", "conditionDeviceLabel" )
			.setAlign( Blockly.ALIGN_RIGHT )
			.setCheck( [ "Devices", "Device" ] );

		_setMutator.call( this );

		this.setInputsInline( false );
		this.setOutput( true, "Boolean" );
		this.setTooltip( Blockly.Msg.CONDITION_DEVICE_VALUE_TOOLTIP );
	},

	mutationToDom: function() {
		var container = document.createElement( "mutation" );
		_updateMutationWithRemovableInputs.call( this, container );
		if ( !_isEmpty( this.params_.condition_type ) ) {
			_updateMutationWithParams.call( this, [ "condition_type", "device_type", "event", "service", "variable", "operator", "value" ], container );
		} else {
			_updateMutationWithParams.call( this, [ "icon", "device_label", "device_type", "event", "operators", "service", "variable_label", "variable", "operator", "value" ], container );
		}
		return container;
	},

	domToMutation: function( xmlElement ) {
		this.params_ = {};
		if ( xmlElement ) {
			_createInputsFromMutation.call( this, xmlElement );
			_loadParamsFromMutation.call( this, xmlElement, [ "condition_type", "icon", "device_label", "device_type", "event", "operators", "service", "variable_label", "variable", "operator", "value" ] );
			// Deprecated (use event now)
			switch( this.params_.condition_type ) {
				case "sensor_armed":
					this.params_.device_label = "security sensor";
					this.params_.service = "urn:micasaverde-com:serviceId:SecuritySensor1";
					this.params_.variable = "Armed";
					this.params_.operators = [ [ "is armed", "EQ" ], [ "is not armed", "NEQ" ] ];
					this.params_.value = "1";
					break;
				case "sensor_tripped":
					this.params_.device_label = "security sensor";
					this.params_.service = "urn:micasaverde-com:serviceId:SecuritySensor1";
					this.params_.variable = "Tripped";
					this.params_.operators = [ [ "is tripped", "EQ" ], [ "is not tripped", "NEQ" ] ];
					this.params_.value = "1";
					break;
				case "sensor_temperature":
					this.params_.device_label = "sensor";
					this.params_.icon = "/cmh/skins/default/img/devices/device_states/temperature_sensor_default.png";
					this.params_.service = "urn:upnp-org:serviceId:TemperatureSensor1";
					this.params_.variable = "CurrentTemperature";
					this.params_.variable_label = "temperature";
					this.params_.operators = [ [ "", "EQ" ], [ "", "LTE" ], [ "", "GTE" ] ];
					break;
				case "sensor_brightness":
					this.params_.device_label = "sensor";
					//this.params_.icon = "/cmh/skins/default/img/devices/device_states/temperature_sensor_default.png";
					this.params_.service = "urn:micasaverde-com:serviceId:LightSensor1";
					this.params_.variable = "CurrentLevel";
					this.params_.variable_label = "brightness";
					this.params_.operators = [ [ "", "EQ" ], [ "", "LTE" ], [ "", "GTE" ] ];
					break;
				case "switch":
					this.params_.service = "urn:upnp-org:serviceId:SwitchPower1";
					this.params_.variable = "Status";
					this.params_.operators = [ [ "is on", "EQ" ], [ "is off", "NEQ" ] ];
					this.params_.value = "1";
					break;
			}
		}
		_updateConditionValueShape.call( this, this.setDeviceExternalFilters );
	},

	decompose: function( workspace ) {
		return _decompose.call( this, workspace );
	},

	compose: function( containerBlock ) {
		_compose.call( this, containerBlock );
	},

	validate: function() {
//console.info( "validate condition", this.id, this.getFieldValue( "service" ), this.params_,  _getLinkedDeviceBlocks.call( this ) )
		if ( this.hasDeviceFilterInputs_ ) {
			// Update the options in the dropdown lists.
			// Blockly will select the saved value just after
			_updateDeviceFilterInputs.call( this,
				{
					"condition_service" : this.params_.input_service || this.params_.service,
					"condition_variable": this.params_.input_variable || this.params_.variables || this.params_.variable
				}
			);
		}
		var thatBlock = this;
		$.each( _getLinkedDeviceBlocks.call( this ), function( i, deviceBlock ) {
			deviceBlock.parent_ = thatBlock;
		} );
		this.setDeviceExternalFilters();
	},

	getFilters: function() {
		/*
		return {
			"condition_service" : ( this.getFieldValue( "service" )  || this.params_.service ),
			"condition_variable": ( this.getFieldValue( "variable" ) || this.params_.variables || this.params_.variable ),
			"device_type"       : ( this.getFieldValue( "deviceType" ) )
		}
		*/
		return {
			"condition_service" : ( this.filters_.condition_service || this.getFieldValue( "service" )  || this.params_.service ),
			"condition_variable": ( this.filters_.condition_variable || this.getFieldValue( "variable" ) || this.params_.variables || this.params_.variable ),
			"device_type"       : ( this.filters_.condition_device_type || this.getFieldValue( "deviceType" ) )
		}
	},

	setDeviceExternalFilters: function() {
		_setDeviceExternalFilters.call( this, this.getFilters() );
	}
};

var timeRE = /^\d\d:\d\d:\d\d$/;
var relativeTimeRE = /^[-+]?\d\d:\d\d:\d\d[rt]$/;
var timeFormatExplication = "format must be 'hh:mm:ss' or relative to sunrise(r)/sunset(t) '[-+]hh:mm:ss[rt]'";

Blockly.Blocks[ "time" ] = {
	init: function() {
		this.setColour( Blockly.Blocks.conditions.HUE1 );
		this.prefix_ = "condition";
		this.params_ = {};

		this.appendDummyInput()
			.appendField( new Blockly.FieldTextInput( "hh:mm:ss" ), "time" );

		this.setInputsInline( false );
		this.setOutput( true, "Time" );
		this.setTooltip( Blockly.Msg.CONDITION_TIME_TOOLTIP );
	},

	onchange: function() {
		var time = this.getFieldValue( "time" );
		if ( time && ( time.match( timeRE ) == null ) && ( time.match( relativeTimeRE ) == null ) ) {
			this.setWarningText( "Time " + timeFormatExplication );
			return;
		}
		var daysOfWeek = this.getFieldValue( "daysOfWeek" );
		if ( daysOfWeek && ( daysOfWeek.match( /^[1-7](,[1-7])*$/ ) == null ) ) {
			this.setWarningText( "Days of week format must be empty or '[1-7](,[1-7])*'" );
			return;
		}
		var daysOfMonth = this.getFieldValue( "daysOfMonth" );
		if ( daysOfMonth && ( daysOfMonth.match( /^\d{1,2}(,\d{1,2})*$/ ) == null ) ) {
			return;
			this.setWarningText( "Days of week format must be '\d{1,2}(,\d{1,2})*'" );
		}
		this.setWarningText();
	}
};

Blockly.Blocks[ "condition_time_old" ] = {
	init: function() {
		this.setColour( Blockly.Blocks.conditions.HUE1 );
		this.prefix_ = "condition";
		this.params_ = {};
		this.filters_ = {};
		//this.inputs_ = [ "time_operator", "timer_type", "timer_relative", "params", "actions" ];
		this.inputs_ = [ "time_operator", "timer_type", "params", "actions" ];

		_setMutator.call( this );
		_createInput.call( this, "time_operator", {}, this.updateShape_ );

		this.setInputsInline( false );
		this.setOutput( true, "Boolean" );
		this.setTooltip( Blockly.Msg.CONDITION_TIME_TOOLTIP );
	},

	onchange: function() {
		var time = this.getFieldValue( "time" );
		if ( time && ( time.match( timeRE ) == null ) && ( time.match( relativeTimeRE ) == null ) ) {
			this.setWarningText( "Time " + timeFormatExplication );
			return;
		}
		var time1 = this.getFieldValue( "time1" );
		if ( time1 && ( time1.match( timeRE ) == null ) && ( time1.match( relativeTimeRE ) == null ) ) {
			this.setWarningText("First time " + timeFormatExplication );
			return;
		}
		var time2 = this.getFieldValue( "time2" );
		if ( time2 && ( time2.match( timeRE ) == null ) && ( time2.match( relativeTimeRE ) == null ) ) {
			this.setWarningText( "Second time " + timeFormatExplication );
			return;
		}
		var daysOfWeek = this.getFieldValue( "daysOfWeek" );
		if ( daysOfWeek && ( daysOfWeek.match( /^[1-7](,[1-7])*$/ ) == null ) ) {
			this.setWarningText( "Days of week format must be empty or '[1-7](,[1-7])*'" );
			return;
		}
		var daysOfMonth = this.getFieldValue( "daysOfMonth" );
		if ( daysOfMonth && ( daysOfMonth.match( /^\d{1,2}(,\d{1,2})*$/ ) == null ) ) {
			return;
			this.setWarningText( "Days of week format must be '\d{1,2}(,\d{1,2})*'" );
		}

		this.setWarningText();
	},

	mutationToDom: function() {
		var container = document.createElement( "mutation" );
		_updateMutationWithRemovableInputs.call( this, container );
		_updateMutationWithParams.call( this, [ "time_operator", "timer_type", "timer_relative" ], container );
		return container;
	},

	domToMutation: function( xmlElement ) {
		_createInputsFromMutation.call( this, xmlElement, this.updateShape_ );
		// TODO : remove 'operator'
		_loadParamsFromMutation.call( this, xmlElement, [ "time_operator", "operator", "timer_type", "timer_relative" ] );
		var timeOperator = this.params_[ "input_time_operator" ] || this.params_[ "time_operator" ] || this.params_[ "operator" ]; // Compliance with older versions
		this.updateShape_( "time_operator", timeOperator );
		var timerType = this.params_[ "input_timer_type" ] || this.params_[ "timer_type" ];
		this.updateShape_( "timer_type", timerType );
	},

	decompose: function( workspace ) {
		return _decompose.call( this, workspace );
	},

	compose: function( containerBlock ) {
		_compose.call( this, containerBlock, this.updateShape_ );
		this.updateShape_( "timer_type", this.getFieldValue( "timerType" ) );
	},

	updateShape_: function( inputName, option ) {
		if ( inputName === "time_operator" ) {
			var inputTime = this.getInput( "time_operator" );
			if ( this.getField( "time" ) != null ) {
				inputTime.removeField('time');
			}
			if ( this.getField( "time1" ) ) {
				inputTime.removeField( "time1" );
				inputTime.removeField( "between_and" );
				inputTime.removeField( "time2" );
			}
			if ( option === "BW" ) {
				inputTime
					.appendField( new Blockly.FieldTextInput( "hh:mm:ss" ), "time1" )
					.appendField( "and", "between_and" )
					.appendField( new Blockly.FieldTextInput( "hh:mm:ss" ), "time2" );
			} else {
				inputTime
					.appendField( new Blockly.FieldTextInput( "hh:mm:ss" ), "time" );
			}
		} else if ( inputName === "timer_type" ) {
			var inputTimerType = this.getInput( "timer_type" );
			if (inputTimerType) {
				if ( option === "3" ) {
					if ( this.getField( "daysOfWeek" ) ) {
						inputTimerType.removeField( "daysOfWeek" );
					}
					if ( this.getField( "daysOfMonth" ) == null ) {
						inputTimerType
							.appendField( new Blockly.FieldTextInput( "" ), "daysOfMonth" );
					}
				} else {
					if ( this.getField( "daysOfMonth" ) ) {
						inputTimerType.removeField( "daysOfMonth" );
					}
					if ( this.getField( "daysOfWeek" ) == null ) {
						inputTimerType
							.appendField( new Blockly.FieldTextInput( "" ), "daysOfWeek" );
					}
				}
			}
		}
	}
};

Blockly.Blocks[ "condition_time" ] = {
	init: function() {
		this.setColour( Blockly.Blocks.conditions.HUE1 );
		this.prefix_ = "condition";
		this.params_ = {};
		this.inputs_ = [ "timer_type", "params", "actions" ];

		this.appendDummyInput()
			.appendField( "time is" );

		this.appendValueInput( "time" )
			.setCheck( "Time" );

		_setMutator.call( this );

		this.setInputsInline( true );
		this.setOutput( true, "Boolean" );
		this.setTooltip( Blockly.Msg.CONDITION_TIME_TOOLTIP );
	},

	mutationToDom: function() {
		var container = document.createElement( "mutation" );
		_updateMutationWithRemovableInputs.call( this, container );
		_updateMutationWithParams.call( this, [ "timer_type" ], container );
		return container;
	},

	domToMutation: function( xmlElement ) {
		_createInputsFromMutation.call( this, xmlElement );
		var timerType = this.params_[ "input_timer_type" ] || this.params_[ "timer_type" ];
		this.updateShape_( timerType );
	},

	decompose: function( workspace ) {
		return _decompose.call( this, workspace );
	},

	compose: function( containerBlock ) {
		_compose.call( this, containerBlock );
		this.updateShape_( this.getFieldValue( "timerType" ) );
	},

	updateShape_: function( option ) {
		var inputTimerType = this.getInput( "timer_type" );
		if (inputTimerType) {
			if ( option === "3" ) {
				if ( this.getField( "daysOfWeek" ) ) {
					inputTimerType.removeField( "daysOfWeek" );
				}
				if ( this.getField( "daysOfMonth" ) == null ) {
					inputTimerType
						.appendField( new Blockly.FieldTextInput( "" ), "daysOfMonth" );
				}
			} else {
				if ( this.getField( "daysOfMonth" ) ) {
					inputTimerType.removeField( "daysOfMonth" );
				}
				if ( this.getField( "daysOfWeek" ) == null ) {
					inputTimerType
						.appendField( new Blockly.FieldTextInput( "" ), "daysOfWeek" );
				}
			}
		}
	}
};

Blockly.Blocks[ "condition_time_between" ] = {
	init: function() {
		this.setColour( Blockly.Blocks.conditions.HUE1 );
		this.prefix_ = "condition";
		this.params_ = {};
		this.inputs_ = [ "timer_type", "params", "actions" ];

		this.appendDummyInput()
			.appendField( "time is between" );

		this.appendValueInput( "time1" )
			.setCheck( "Time" );

		this.appendDummyInput()
			.appendField( "and" );

		this.appendValueInput( "time2" )
			.setCheck( "Time" );

		_setMutator.call( this );

		this.setInputsInline( true );
		this.setOutput( true, "Boolean" );
		this.setTooltip( Blockly.Msg.CONDITION_TIME_BETWEEN_TOOLTIP );
	},

	mutationToDom: function() {
		var container = document.createElement( "mutation" );
		_updateMutationWithRemovableInputs.call( this, container );
		_updateMutationWithParams.call( this, [ "timer_type" ], container );
		return container;
	},

	domToMutation: function( xmlElement ) {
		_createInputsFromMutation.call( this, xmlElement );
		var timerType = this.params_[ "input_timer_type" ] || this.params_[ "timer_type" ];
		this.updateShape_( timerType );
	},

	decompose: function( workspace ) {
		return _decompose.call( this, workspace );
	},

	compose: function( containerBlock ) {
		_compose.call( this, containerBlock );
		this.updateShape_( this.getFieldValue( "timerType" ) );
	},

	updateShape_: function( option ) {
		var inputTimerType = this.getInput( "timer_type" );
		if (inputTimerType) {
			if ( option === "3" ) {
				if ( this.getField( "daysOfWeek" ) ) {
					inputTimerType.removeField( "daysOfWeek" );
				}
				if ( this.getField( "daysOfMonth" ) == null ) {
					inputTimerType
						.appendField( new Blockly.FieldTextInput( "" ), "daysOfMonth" );
				}
			} else {
				if ( this.getField( "daysOfMonth" ) ) {
					inputTimerType.removeField( "daysOfMonth" );
				}
				if ( this.getField( "daysOfWeek" ) == null ) {
					inputTimerType
						.appendField( new Blockly.FieldTextInput( "" ), "daysOfWeek" );
				}
			}
		}
	}
};

Blockly.Blocks[ "condition_rule" ] = {
	init: function() {
		this.setColour( Blockly.Blocks.conditions.HUE1 );
		this.prefix_ = "condition";
		this.inputs_ = [ "params" ];

		var options = [ [ "...", "" ] ];
		var rules = ALTUI_RulesEngine.getRules();
		for ( var i = 0; i < rules.length; i++ ) {
			options.push( [ rules[ i ].name, rules[ i ].id.toString() ] );
		}
		this.appendDummyInput()
			.appendField( "rule" )
			.appendField( new Blockly.FieldDropdown( options ), "ruleId" );

		this.appendDummyInput()
			.appendField( "is" )
			.appendField( new Blockly.FieldDropdown( [ [ "active", "1" ], [ "inactive", "0" ] ] ), "ruleStatus" );

		_setMutator.call( this );

		this.setInputsInline( true );
		this.setOutput( true, "Boolean" );
		this.setTooltip( Blockly.Msg.CONDITION_RULE_TOOLTIP );
	},

	mutationToDom: function() {
		var container = document.createElement( "mutation" );
		_updateMutationWithRemovableInputs.call( this, container );
		return container;
	},

	domToMutation: function( xmlElement ) {
		_createInputsFromMutation.call( this, xmlElement );
	},

	decompose: function( workspace ) {
		return _decompose.call( this, workspace );
	},

	compose: function( containerBlock ) {
		_compose.call( this, containerBlock );
	}
};

Blockly.Blocks[ "condition_inverter" ] = {
	init: function() {
		this.setColour( Blockly.Blocks.conditions.HUE1 );

		this.appendValueInput( "condition" )
			.setCheck( "Boolean" )
			.appendField( "not" );

		this.setInputsInline( false );
		this.setOutput( true, "Boolean" );
		this.setTooltip( Blockly.Msg.CONDITION_INVERTER_TOOLTIP );
	}
};

Blockly.Blocks[ "condition_mqtt" ] = {
	init: function() {
		this.setColour( Blockly.Blocks.conditions.HUE1 );

		this.appendDummyInput()
			.appendField( "MQTT (TODO)" );

		this.appendDummyInput()
			.appendField( "topic" )
			.appendField( new Blockly.FieldTextInput( "" ), "topic" );

		this.appendDummyInput()
			.appendField( "payload" )
			.appendField( new Blockly.FieldTextInput( "" ), "payload" );

		this.setInputsInline( false );
		this.setOutput( true, "Boolean" );
		this.setTooltip( Blockly.Msg.CONDITION_MQTT_TOOLTIP );
	}
};

Blockly.Blocks[ "controls_condition" ] = {
	init: function() {
		this.setColour(Blockly.Blocks.conditions.HUE1);
		this.appendDummyInput()
			.appendField(Blockly.Msg.CONTROLS_CONDITION_TITLE);
		this.appendStatementInput('STACK');
		this.setTooltip(Blockly.Msg.CONTROLS_CONDITION_TOOLTIP);
		this.contextMenu = false;
	}
};

Blockly.Blocks[ "controls_condition_ADD" ] = {
	init: function() {
		this.setColour(Blockly.Blocks.conditions.HUE1);
		this.appendDummyInput()
			.appendField(Blockly.Msg.CONTROLS_CONDITION_ADD_TITLE);
		this.setPreviousStatement(true);
		this.setNextStatement(true);
		this.setTooltip(Blockly.Msg.CONTROLS_CONDITION_ADD_TOOLTIP);
		this.contextMenu = false;
	}
};

Blockly.Blocks[ "controls_condition_timer_type" ] = {
	init: function() {
		this.setColour(Blockly.Blocks.conditions.HUE1);
		this.appendDummyInput()
			.appendField(Blockly.Msg.CONTROLS_CONDITION_TIMER_TYPE_TITLE);
		this.setPreviousStatement(true);
		this.setNextStatement(true);
		this.setTooltip(Blockly.Msg.CONTROLS_CONDITION_TIMER_TYPE_TOOLTIP);
		this.contextMenu = false;
	}
};

Blockly.Blocks[ "controls_condition_timer_relative" ] = {
	init: function() {
		this.setColour(Blockly.Blocks.conditions.HUE1);
		this.appendDummyInput()
			.appendField(Blockly.Msg.CONTROLS_CONDITION_TIMER_RELATIVE_TITLE);
		this.setPreviousStatement(true);
		this.setNextStatement(true);
		this.setTooltip(Blockly.Msg.CONTROLS_CONDITION_TIMER_RELATIVE_TOOLTIP);
		this.contextMenu = false;
	}
};

Blockly.Blocks[ "controls_condition_params" ] = {
	init: function() {
		this.setColour(Blockly.Blocks.conditions.HUE1);
		this.appendDummyInput()
			.appendField(Blockly.Msg.CONTROLS_CONDITION_PARAMS_TITLE);
		this.setPreviousStatement(true);
		this.setNextStatement(true);
		this.setTooltip(Blockly.Msg.CONTROLS_CONDITION_PARAMS_TOOLTIP);
		this.contextMenu = false;
	}
};

Blockly.Blocks[ "controls_condition_actions" ] = {
	init: function() {
		this.setColour(Blockly.Blocks.conditions.HUE1);
		this.appendDummyInput()
			.appendField(Blockly.Msg.CONTROLS_CONDITION_ACTIONS_TITLE);
		this.setPreviousStatement(true);
		this.setNextStatement(true);
		this.setTooltip(Blockly.Msg.CONTROLS_CONDITION_ACTIONS_TOOLTIP);
		this.contextMenu = false;
	}
};

// ****************************************************************************
// Conditions - Sequences
// ****************************************************************************

Blockly.Msg.CONDITION_SEQUENCE_TITLE = "Sequence of conditions.";

Blockly.Blocks[ "condition_sequence" ] = {
	init: function() {
		this.setColour( Blockly.Blocks.conditions.HUE3 );

		this.prefix_ = "condition";
		this.params_ = {};
		this.inputs_ = [ "actions" ];
		_setMutator.call( this );

		this.appendDummyInput()
			.appendField( "sequence of conditions" );

		this.appendStatementInput( "items" )
			.setCheck( "ConditionSequenceItem" );

		this.setInputsInline( false );
		this.setOutput( true, "Boolean" );
		this.setTooltip( Blockly.Msg.CONDITION_SEQUENCE_TITLE );
	},

	mutationToDom: function() {
		var container = document.createElement( "mutation" );
		_updateMutationWithRemovableInputs.call( this, container );
		return container;
	},

	domToMutation: function( xmlElement ) {
		_createInputsFromMutation.call( this, xmlElement );
	},

	decompose: function( workspace ) {
		return _decompose.call( this, workspace );
	},

	compose: function( containerBlock ) {
		_compose.call( this, containerBlock );
	}
};

Blockly.Blocks[ "condition_sequence_separator" ] = {
	init: function() {
		this.setColour( Blockly.Blocks.conditions.HUE3 );

		// Interval between two conditions in a sequence
		this.appendDummyInput( "after" )
			.appendField( "after" )
			.appendField (new Blockly.FieldTextInput( "0", Blockly.FieldTextInput.numberValidator ), "sequenceInterval" )
			.appendField( new Blockly.FieldDropdown( [ [ "seconds", "S"], [ "minutes", "M" ], [ "hours", "H" ] ] ), "unit" );

		this.setInputsInline( true );
		this.setPreviousStatement( true, "ConditionSequenceItem" );
		this.setNextStatement( true, "ConditionSequenceItem" );
	}
};

Blockly.Blocks[ "condition_sequence_item" ] = {
	init: function() {
		this.setColour( Blockly.Blocks.conditions.HUE3 );

		// Condition
		this.appendValueInput( "condition" )
			.setCheck( "Boolean" )
			.appendField( "if" );

		this.setInputsInline( true );
		this.setPreviousStatement( true, "ConditionSequenceItem" );
		this.setNextStatement( true, "ConditionSequenceItem" );
	}
};

// ****************************************************************************
// Conditions - Params
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
};
Blockly.Blocks[ "list_condition_param" ].validate = function() {
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
// Group of actions
// ****************************************************************************

goog.require( "Blockly.Blocks" );

goog.provide( "Blockly.Blocks.actions" );
Blockly.Blocks.actions.HUE1 = 224;
Blockly.Blocks.actions.HUE2 = 240;
Blockly.Msg.ACTION_GROUP_TOOLTIP = "Group of actions. Choose the event linked to these actions and eventually parameters and specific conditions.";
Blockly.Msg.CONTROLS_ACTION_GROUP_TITLE = "group of actions";
Blockly.Msg.CONTROLS_ACTION_GROUP_TOOLTIP = "Group of actions.";
Blockly.Msg.CONTROLS_ACTION_GROUP_DESCRIPTION_TITLE = "description";
Blockly.Msg.CONTROLS_ACTION_GROUP_DESCRIPTION_TOOLTIP = "";
Blockly.Msg.CONTROLS_ACTION_GROUP_PARAMS_TITLE = "param";
Blockly.Msg.CONTROLS_ACTION_GROUP_PARAMS_TOOLTIP = "Parameter which can change the behaviour of the group of actions.";
Blockly.Msg.CONTROLS_ACTION_GROUP_CONDITION_TITLE = "condition";
Blockly.Msg.CONTROLS_ACTION_GROUP_CONDITION_TOOLTIP = "Specific condition for the group of actions. If this condition is not realized, the group of actions is not executed (the status of the rule is not impacted).";

Blockly.Blocks[ "action_group" ] = {
	init: function() {
		this.setColour( Blockly.Blocks.actions.HUE1 );
		this.prefix_ = "action_group";

		// Event
		this.appendDummyInput( "action_group_event" )
			.appendField( "for event" )
			.appendField(
				new Blockly.FieldDropdown(
					/*
					[
						[ "START of the rule", "start" ],
						[ "REPEAT as long as the rule is active", "reminder" ],
						[ "END of the rule", "end" ]
					],
					*/
					[
						[ "OnRuleStart", "start" ],
						[ "OnRuleReminder", "reminder" ],
						[ "OnRuleEnd", "end" ]
					],
					function( option ) {
						var recurrentIntervalInput = ( option === "reminder" );
						this.sourceBlock_.updateShape_( recurrentIntervalInput );
					}
				),
				"event"
			);

		this.appendStatementInput( "do" )
			.setCheck( "ActionType" )
			.appendField( "do" );

		this.inputs_ = [ "description", "params", "condition" ];
		_setMutator.call( this );

		this.setInputsInline( false );
		this.setPreviousStatement( true, "ActionGroup" );
		this.setNextStatement( true, "ActionGroup" );
		this.setTooltip( Blockly.Msg.ACTION_GROUP_TOOLTIP );
	},

	mutationToDom: function() {
		var container = document.createElement( "mutation" );
		_updateMutationWithRemovableInputs.call( this, container );
		var recurrentIntervalInput = ( this.getFieldValue( "event" ) === "reminder" );
		container.setAttribute( "recurrent_interval_input", recurrentIntervalInput );
		return container;
	},

	domToMutation: function( xmlElement ) {
		_createInputsFromMutation.call( this, xmlElement );
		var recurrentIntervalInput = ( xmlElement.getAttribute( "recurrent_interval_input" ) === "true" );
		this.updateShape_( recurrentIntervalInput );
	},

	decompose: function( workspace ) {
		return _decompose.call( this, workspace );
	},

	compose: function( containerBlock ) {
		_compose.call( this, containerBlock );
	},

	updateShape_: function( recurrentIntervalInput ) {
		// Add or remove a Value Input.
		var inputExists = this.getInput( "action_group_recurrent_interval" );
		if ( recurrentIntervalInput ) {
			if ( !inputExists ) {
				// Recurrent interval
				this.appendDummyInput( "action_group_recurrent_interval" )
					.appendField( "every" )
					.appendField( new Blockly.FieldTextInput( "0", Blockly.FieldTextInput.numberValidator ), "recurrentInterval" )
					.appendField( new Blockly.FieldDropdown( [ [ "seconds", "S" ], [ "minutes", "M" ], [ "hours", "H" ] ] ), "unit" )
					.setAlign( Blockly.ALIGN_RIGHT );
				_moveInputBefore.call( this, "action_group_recurrent_interval",[ "action_group_description", "action_group_params", "action_group_conditions", "do" ] );
			}
		} else if ( inputExists ) {
			this.removeInput( "action_group_recurrent_interval" );
		}
	}
};

Blockly.Blocks[ "condition_action_group" ] = {
	init: function() {
		this.setColour( Blockly.Blocks.actions.HUE1 );
		this.prefix_ = "action_group";

		// Event
		this.appendDummyInput( "action_group_event" )
			.appendField( "for event" )
			.appendField(
				new Blockly.FieldDropdown(
					/*
					[
						[ "START - the condition is filled", "conditionStart" ],
						[ "(TODO) REPEAT as long as the condition is filled", "conditionReminder" ],
						[ "END - the condition is no more filled", "conditionEnd" ]
					],
					*/
					[
						[ "OnConditionStart", "conditionStart" ],
						//[ "(TODO) OnConditionReminder", "conditionReminder" ],
						[ "OnConditionEnd", "conditionEnd" ]
					],
					function( option ) {
						var recurrentIntervalInput = ( option === "reminder" );
						this.sourceBlock_.updateShape_( recurrentIntervalInput );
					}
				),
				"event"
			);

		this.appendStatementInput( "do" )
			.setCheck( "ActionType" )
			.appendField( "do" );

		this.inputs_ = [ "description", "params" ];
		_setMutator.call( this );

		this.setInputsInline( false );
		this.setPreviousStatement( true, "ConditionActionGroup" );
		this.setNextStatement( true, "ConditionActionGroup" );
		this.setTooltip( Blockly.Msg.ACTION_GROUP_TOOLTIP );
	},

	mutationToDom: function() {
		var container = document.createElement( "mutation" );
		_updateMutationWithRemovableInputs.call( this, container );
		var recurrentIntervalInput = (this.getFieldValue( "event" ) === "reminder" );
		container.setAttribute( "recurrent_interval_input", recurrentIntervalInput );
		return container;
	},

	domToMutation: function( xmlElement ) {
		_createInputsFromMutation.call( this, xmlElement );
		var recurrentIntervalInput = ( xmlElement.getAttribute( "recurrent_interval_input" ) === "true" );
		this.updateShape_( recurrentIntervalInput );
	},

	decompose: function( workspace ) {
		return _decompose.call( this, workspace );
	},

	compose: function( containerBlock ) {
		_compose.call( this, containerBlock );
	},

	updateShape_: function( recurrentIntervalInput ) {
		// Add or remove a Value Input.
		var inputExists = this.getInput( "action_group_recurrent_interval" );
		if ( recurrentIntervalInput ) {
			if ( !inputExists ) {
				// Recurrent interval
				this.appendDummyInput( "action_group_recurrent_interval" )
					.appendField( "every" )
					.appendField( new Blockly.FieldTextInput( "0", Blockly.FieldTextInput.numberValidator ), "recurrentInterval" )
					.appendField( new Blockly.FieldDropdown( [ [ "seconds", "S" ], [ "minutes", "M" ], [ "hours", "H" ] ] ), "unit" )
					.setAlign( Blockly.ALIGN_RIGHT );
				_moveInputBefore.call( this, "action_group_recurrent_interval",[ "action_group_description", "action_group_params", "action_group_conditions", "do" ] );
			}
		} else if ( inputExists ) {
			this.removeInput( "action_group_recurrent_interval" );
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

Blockly.Blocks[ "controls_action_group_description" ] = {
	init: function() {
		this.setColour(Blockly.Blocks.actions.HUE1);
		this.appendDummyInput()
			.appendField(Blockly.Msg.CONTROLS_ACTION_GROUP_DESCRIPTION_TITLE);
		this.setPreviousStatement(true);
		this.setNextStatement(true);
		this.setTooltip(Blockly.Msg.CONTROLS_ACTION_GROUP_DESCRIPTION_TOOLTIP);
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

Blockly.Blocks[ "controls_action_group_condition" ] = {
	init: function() {
		this.setColour(Blockly.Blocks.actions.HUE1);
		this.appendDummyInput()
			.appendField(Blockly.Msg.CONTROLS_ACTION_GROUP_CONDITION_TITLE);
		this.setPreviousStatement(true);
		this.setNextStatement(true);
		this.setTooltip(Blockly.Msg.CONTROLS_ACTION_GROUP_CONDITION_TOOLTIP);
		this.contextMenu = false;
	}
};


// ****************************************************************************
// Rule actions - Types
// ****************************************************************************

Blockly.Msg.ACTION_WAIT_TOOLTIP = "Wait a defined time.";
Blockly.Msg.ACTION_FUNCTION_TOOLTIP = "Execute LUA code.";
Blockly.Msg.ACTION_DEVICE_TOOLTIP = "Execute an action of a device.";
Blockly.Msg.ACTION_SCENE_TOOLTIP = "Execute a scene.";
Blockly.Msg.ACTION_MQTT_TOOLTIP = "(TODO)Publish a message on MQTT broker.";

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

function _updateActionDeviceShape( onChange ) {
	// Device type
	this.getField( "actionDeviceLabel" ).text_ = ( this.params_.device_label ? this.params_.device_label : "device" );

	// Action params selection
	if ( this.params_.action_params ) {
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
			_createDeviceFilterInput.call( this,
				"action",
				{ "icon": this.params_.icon, "label": this.params_.action_label },
				function( inputName, newAction ) {
					_updateActionDeviceParamsShape.call( thatBlock, newAction );
					if ( typeof( onChange ) === "function" ) {
						onChange.call( thatBlock, "action", newAction );
					}
				}
			);
		} else {
			_removeInput.call( this, "action" );
			this.appendDummyInput( "action" )
				.appendField( this.params_.action_label );
		}
		_moveInputBefore.call( this, "action" );
	} else {
		_removeInput.call( this, "action" );
	}

	// Service
	if ( !this.params_.service ) {
		_createDeviceFilterInput.call( this, "service", null, onChange );
		_moveInputBefore.call( this, "service" );
	} else {
		_removeInput.call( this, "service" );
	}
}

function _updateActionDeviceParamsShape( newAction ) {
	delete this.params_.no_param;

	if ( this.params_.action_params ) {
		return;
	}
	for ( var i = 0; i < 6; i++ ) {
		_removeInput.call( this, "action_params_" + i );
	}

	// TODO : remove input_action_service
	var actionService = this.params_.service || this.getFieldValue( "service" ) || this.params_.input_service || this.params_.input_action_service;
	var actionName    = this.params_.action  || newAction || this.getFieldValue( "action" ) || this.params_.input_action;
	if ( _isEmpty( actionService ) && _isEmpty ( actionName ) ) {
		return;
	}

	// Parameters of the action
	var action = ALTUI_RulesEngine.getDeviceAction( actionService, actionName );
	if ( action && action.input && ( action.input.length > 0 ) ) {
		for ( var i = action.input.length - 1; i >= 0; i-- ) {
			var inputName = action.input[ i ];
			this.appendDummyInput( "action_params_" + i )
				.setAlign( Blockly.ALIGN_RIGHT )
				.appendField( inputName + " =" )
				.appendField( new Blockly.FieldTextInput( "" ), "param_" + inputName );
			_moveInputBefore.call( this, "action_params_" + i, [ "device" ] );
		}
	} else {
		// No param
		this.params_.no_param = true;
	}
}

Blockly.Blocks['action_device'] = {
	init: function () {
		this.setColour( Blockly.Blocks.actions.HUE2 );
		this.prefix_ = "action";
		this.filters_ = {};
		this.params_ = {};

		this.appendValueInput( "device" )
			.appendField( "device", "actionDeviceLabel" )
			.setAlign( Blockly.ALIGN_RIGHT )
			.setCheck( [ "Devices", "Device" ] );

		this.inputs_ = [ "service", "action" ];

		this.setInputsInline( false );
		this.setPreviousStatement( true, "ActionType" );
		this.setNextStatement( true, "ActionType" );
		this.setTooltip( Blockly.Msg.ACTION_DEVICE_TOOLTIP );
	},

	mutationToDom: function() {
		var container = document.createElement( "mutation" );
		_updateMutationWithParams.call( this, [ "action_type", "service", "action", "no_param" ], container );
		return container;
	},

	domToMutation: function( xmlElement ) {
		// TODO : remove action_service
		_loadParamsFromMutation.call( this, xmlElement, [ "action_type", "icon", "device_label", "service", "action_service", "action_label", "action" ] );
		switch( this.params_.action_type ) {
			case "switch":
				this.params_.service = "urn:upnp-org:serviceId:SwitchPower1";
				this.params_.action = "SetTarget";
				this.params_.action_params = [ [ "switch on", '{"newTargetValue":"1"}' ], [ "switch off", '{"newTargetValue":"0"}' ] ];
				break;
			case "dim":
				this.params_.service = "urn:upnp-org:serviceId:Dimming1";
				this.params_.action = "SetLoadLevelTarget";
				this.params_.action_label = "dim";
				break;
			default:
				break;
		}
		_updateActionDeviceShape.call( this, this.setDeviceExternalFilters );
		_updateActionDeviceParamsShape.call( this );
	},

	validate: function() {
//console.info( "validate action", this.id, this.getFieldValue( "service" ), this.params_,  _getLinkedDeviceBlocks.call( this ) )
		if ( this.hasDeviceFilterInputs_ ) {
			_updateDeviceFilterInputs.call( this,
				{
					// TODO : remove input_action_service
					"action_service": this.params_.input_service || this.params_.input_action_service || this.params_.service,
					"action_action" : this.params_.input_action || this.params_.action
				}
			);
		}
		var thatBlock = this;
		$.each( _getLinkedDeviceBlocks.call( this ), function( i, deviceBlock ) {
			deviceBlock.parent_ = thatBlock;
		} );
		this.setDeviceExternalFilters();
	},

	getFilters: function() {
		/*
		return {
			"condition_service" : ( this.getFieldValue( "service" )  || this.params_.service ),
			"condition_variable": ( this.getFieldValue( "variable" ) || this.params_.variables || this.params_.variable ),
			"device_type"       : ( this.getFieldValue( "deviceType" ) )
		}
		*/
		return {
			"action_service": ( this.filters_.action_service || this.getFieldValue( "service" ) || this.params_.service ),
			"action_action" : ( this.filters_.action_action  || this.getFieldValue( "action" )  || this.params_.action )
		}
	},

	setDeviceExternalFilters: function() {
		_setDeviceExternalFilters.call( this, this.getFilters() );
	}
};

Blockly.Blocks['action_scene'] = {
	init: function () {
		this.setColour( Blockly.Blocks.actions.HUE2 );

		var options = [ [ "...", "" ] ];
		$.each( ALTUI_RulesEngine.getScenes(), function( i, scene ) {
			options.push( [ scene.roomName + " - " + scene.name, scene.id.toString() ] );
		} );
		options.sort( _sortOptionsByName );

		this.appendDummyInput()
			.appendField( "scene" );
		this.appendDummyInput()
			.appendField( new Blockly.FieldDropdown( options ), "sceneId" );

		this.setPreviousStatement( true, "ActionType" );
		this.setNextStatement( true, "ActionType" );
		this.setTooltip( Blockly.Msg.ACTION_SCENE_TOOLTIP );
	}
};

Blockly.Blocks[ "action_mqtt" ] = {
	init: function() {
		this.setColour( Blockly.Blocks.actions.HUE2 );

		this.appendDummyInput()
			.appendField( "MQTT (TODO)" );

		this.appendDummyInput()
			.appendField( "topic" )
			.appendField( new Blockly.FieldTextInput( "" ), "topic" );

		this.appendDummyInput()
			.appendField( "payload" )
			.appendField( new Blockly.FieldTextInput( "" ), "payload" );

		this.setInputsInline( false );
		this.setPreviousStatement( true, "ActionType" );
		this.setNextStatement( true, "ActionType" );
		this.setTooltip( Blockly.Msg.ACTION_MQTT_TOOLTIP );
	}
};

// ****************************************************************************
// Rule actions - Params
// ****************************************************************************

Blockly.Msg.LIST_ACTION_PARAM_TOOLTIP = "List of action parameters";
Blockly.Msg.LIST_ACTION_PARAM_CREATE_EMPTY_TITLE = "no param";
Blockly.Msg.ACTION_PARAM_LEVEL_TOOLTIP = "Define for which level of the rule these actions are planned.";
Blockly.Msg.ACTION_PARAM_DELAY_TOOLTIP = "Define the time to wait before doing the actions.";
Blockly.Msg.ACTION_PARAM_CRITICAL_TOOLTIP = "Defines if these actions can be stopped if the status of the rule changes during their execution (critical can't be stopped).";

Blockly.Blocks[ "list_action_param" ] = function() {};
goog.mixin( Blockly.Blocks[ "list_action_param" ], Blockly.Blocks[ "lists_create_with" ] );
Blockly.Blocks[ "list_action_param" ].updateShape_ = function() {
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
	if (this.itemCount_ === 0) {
		this.appendDummyInput( "EMPTY" )
			.appendField( Blockly.Msg.LIST_ACTION_PARAM_CREATE_EMPTY_TITLE );
	} else {
		for (var i = 0; i < this.itemCount_; i++) {
			var input = this.appendValueInput( "ADD" + i)
				.setCheck( "ActionParam" );
		}
	}
	this.setInputsInline( true );
	if ( !this.outputConnection ) {
		this.setOutput( true, "ActionParams" );
	} else {
		this.outputConnection.setCheck( "ActionParams" );
	}
};
Blockly.Blocks[ "list_action_param" ].validate = function() {
	this.setTooltip(Blockly.Msg.LIST_ACTION_PARAM_TOOLTIP);
};

Blockly.Blocks['action_param_level'] = {
	init: function () {
		this.setColour(Blockly.Blocks.actions.HUE1);

		this.appendDummyInput()
			.appendField('for level')
			.appendField(new Blockly.FieldTextInput('0', Blockly.FieldTextInput.numberValidator), 'level');

		this.setInputsInline(true);
		this.setOutput( true, "ActionParam" );
		this.setTooltip( Blockly.Msg.ACTION_PARAM_LEVEL_TOOLTIP );
	}
};

Blockly.Blocks[ "action_param_delay" ] = {
	init: function () {
		this.setColour(Blockly.Blocks.actions.HUE1);

		this.appendDummyInput( "delayInterval" )
			.appendField( "after" )
			.appendField(new Blockly.FieldTextInput( "0", Blockly.FieldTextInput.numberValidator ), "delayInterval" )
			.appendField(new Blockly.FieldDropdown( [ [ "seconds", "S" ], [ "minutes", "M" ], [ "hours", "H" ] ] ), "unit" );

		this.setInputsInline( true );
		this.setOutput( true, "ActionParam" );
		this.setTooltip( Blockly.Msg.ACTION_PARAM_DELAY_TOOLTIP );
	}
};

Blockly.Blocks[ "action_param_critical" ] = {
	init: function () {
		this.setColour( Blockly.Blocks.actions.HUE1 );

		this.appendDummyInput()
			.appendField( "is" )
			.appendField( new Blockly.FieldDropdown( [ [ "critical", "TRUE" ], [ "not critical", "FALSE" ] ] ), "isCritical" );

		this.setInputsInline( true );
		this.setOutput( true, "ActionParam" );
		this.setTooltip( Blockly.Msg.ACTION_PARAM_CRITICAL_TOOLTIP );
	}
};

} ) ( jQuery );
