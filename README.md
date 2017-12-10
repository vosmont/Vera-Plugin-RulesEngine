# <img align="left" src="media/rulesengine_logo.png"> Vera-Plugin-RulesEngine

A rules engine for [Vera Control, Ltd.](http://getvera.com/) Home Controllers

<br/>

<img src="media/rulesengine_example.png">

**Compatible with UI5 & UI7 / VeraPlus, VeraEdge, Vera3, VeraLite / [openLuup](https://github.com/akbooer/openLuup)**

**Rules are editable only with [AltUI](https://github.com/amg0/ALTUI)**

More informations here :
- http://forum.micasaverde.com/index.php/topic,34489.0.html


## Main benefits :
- allows to create visually rules (with [Blockly](https://github.com/google/blockly))
- management of complex conditions
- no dependence with scenes (can work at the same time)
- no longer need of LUUP reloading
- customizable (actions with LUA code, custom modules, custom Blockly blocks, ...)
- creation and edition made with a graphical editor
- openLuup compliant


## Main notions :
- a rule is active or not active.
- as soon as the condition (calculated from an assembly of conditions) is satisfied, the rule becomes active.
  In contrast, as soon as the condition is no more satisfied, the rule is not active any more.
- actions can be made for the various stages of the life of a rule : at the start, as long as it is active (reminder) and at the end.
- condition can be added to group of actions, in order to discard it even if the rule is still active.
- level for conditions, which allows to make actions just for this level.
- linked rules : ability to use an active rule as a trigger for another.
- enable/disable : status of the rule will change but without effects.
- rule acknowledgement : the actions for reminder event are no more done.
- create visually your rules
- in conditions and actions, first select service/variable, and then the devices implied (by filters)
- the shapes of the items in the editor can be modified with the gear icon


## Installation

You will find the plugin by different ways :

- Mios Marketplace (not often updated) :
  - UI5 : http://apps.mios.com/plugin.php?id=8522
  - UI7 : "Apps->Install apps" by searching "RulesEngine".

- Alternate App Store on ALTUI

- Github : https://github.com/vosmont/Vera-Plugin-RulesEngine
  
  Upload the files in "luup files" in the Vera (by the standard UI in "Apps-->Develop Apps-->Luup files").
  
  Create a new device in "Apps-->Develop Apps-->Create device", and set "Upnp Device Filename" to "D_RulesEngine1.xml".

> **Just UI5**: There's no JSON decoder installed by default.
> If you have the error "No JSON decoder", you have to upload the library in "/usr/lib/lua". You can take "json.lua" or "dkjson.lua".
> You will find "json.lua" here : http://code.mios.com/trac/mios_genericutils/export/20/json.lua
>
> This code can be executed in "Apps->Develop apps->Test Luup code (Lua)"
> ```
> os.execute("wget -q -O /usr/lib/lua/json.lua http://code.mios.com/trac/mios_genericutils/export/20/json.lua")
> ```


## Usage

Open the page of the rules of the plugin in ALTUI. You can add a new rule : a Blockly editor will be displayed.
Create your rule and press the button "OK", it will be upload on the Vera (into a file "C_RulesEngine_Rules.xml").

You can import rules in the Blockly editor with "Import XML".


## Backup

As this plugin is still in development, and important changes can be done between versions, **you should really backup regularly your rules**.

Just download the file "C_RulesEngine_Rules.xml" (by the standard UI in "Apps-->Develop Apps-->Luup files").
In case of problem, you will be able to import XML fragment of rule (in the rule editor).


## ImperiHome

You can visualize your rules on ImperiHome : RulesEngine is compliant with ImperiHome Standard System API (ISS).

Just add an ISS system on ImperiHome with this URL :
- on legacy Vera :
http://{ip}/port_3480/data_request?id=lr_RulesEngine&command=ISS&path=

- on openLuup :
http://{ip}:3480/data_request?id=lr_RulesEngine&command=ISS&path=

For the moment, the rules are in the room "Rules".


## Settings

Here is the list of the parameters (variables in advanced panel) :

**RuleFiles** (default "C_RulesEngine_Rules.xml")
List of the names of the files (separated by commas) containing the xml definition of the rules (Blockly).

**StartupFiles** (default "C_RulesEngine_Startup.lua")
List of the names of the files (separated by commas) containing the LUA code which has to be executed at the startup of the plugin.
If you define global functions, they will be available in the action of type "LUA function" or custom actions.

For example :
File "C_RulesEngine_Startup.lua"

```
NotificationHelper = {
	sendVocal = function (message)
		-- Some code to send vocal message
	end
}

RulesEngine.addActionType(
	"action_vocal",
	function (action, context)
		local message = RulesEngine.getEnhancedMessage(action.message, context)
		RulesEngine.log("Vocal message \"" .. message .. "\"", "ActionType.Vocal", 1)
		NotificationHelper.sendVocal(message)
	end
)
```

File "J_RulesEngine1_Blockly_Custom.js" (declared in "ToolboxConfig" variable)
```
//# sourceURL=J_RulesEngine1_Blockly_Custom.js
"use strict";

goog.require( "Blockly.Blocks" );
goog.require( "Blockly.Blocks.actions" );

Blockly.Blocks['action_vocal'] = {
	init: function () {
		this.setColour(Blockly.Blocks.actions.HUE2);

		this.appendDummyInput()
			.appendField('Vocal');
		this.appendDummyInput()
			.appendField('message :')
			.appendField(new Blockly.FieldTextArea(''), 'message');

		this.setInputsInline(false);
		this.setPreviousStatement(true, 'ActionType');
		this.setNextStatement(true, 'ActionType');
	}
};
```

**Modules**
List of modules to import at the startup of the engine.
It is intended for addons (like Virtual Alarm Panel plugin)

**ToolboxConfig**
A JSON structure defining custom config for the Blockly toolbox.
```
[{"type":"alarm_panel","category":"Properties","resource":"J_RulesEngine1_Blockly_AlarmPanel.js"},{"type":"action_vocal","category":"Actions,Types","resource":"J_RulesEngine1_Blockly_Custom.js"}]
```


## Todo

There remains some work :
- [ ] save modifications on the rules directly on the Vera.
- [ ] find a way for displaying a lot of rules (manipulating several rules into Blockly is a bit hard).
- [ ] backup XML files of the rules.
- [ ] start/stop rules without Luup reload.
- [ ] send history by syslog.


## Logs

You can control your rules execution in the logs. Just set the variable "Debug" to a value between 0 and 4.
Then in a ssh terminal :

- on legacy Vera :
```
tail -f /var/log/cmh/LuaUPnP.log | grep "^01\|RulesEngine"
```

- on openLuup :
```
tail -F {openLuup folder}/cmh-ludl/logs/LuaUPnP.log | grep "ERROR\|RulesEngine"
```
