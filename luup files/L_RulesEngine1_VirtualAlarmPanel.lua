module("L_RulesEngine1_VirtualAlarmPanel", package.seeall)

-------------------------------------------
-- Plugin variables
-------------------------------------------

_NAME = "RulesEngine_VirtualAlarmPanel"
_DESCRIPTION = "Sauvegarde du statut de la règle dans un VirtualAlarmPanel et gestion d'un acquitement"
_VERSION = "0.01"

-- Services ids
local SID = {
	VirtualAlarmPanel = "urn:upnp-org:serviceId:VirtualAlarmPanel1"
}

local _indexRuleByPanelAlarm = {}
local _indexRuleByPanelAlarmModeAuto = {}

-- Action à l'initialisation d'une règle
RulesEngine.addHook(
	"VirtualAlarmPanel",
	"onRuleStatusInit",
	function (rule)
		if (type(rule.alarmPanel) ~= "table") then
			RulesEngine.log("Rule '" .. rule.name .. "' has no alarmPanel param", "VirtualAlarmPanel.onRuleStatusInit", 3)
			return
		end
		if (rule.alarmPanel.deviceId == nil) then
			rule.alarmPanel.deviceId = DeviceHelper.getIdByName(rule.alarmPanel.device)
		end
		if (rule.alarmPanel.deviceId == nil) then
			RulesEngine.log("Rule '" .. rule.name .. "' - VirtualAlarmPanel device is unkown", "VirtualAlarmPanel.onRuleStatusInit", 2)
			return
		end

		-- Initialisation de la règle avec le statut du voyant
		RulesEngine.log("Rule '" .. rule.name .. "' - Retrieves status from alarm panel #" .. tostring(rule.alarmPanel.deviceId) .. "' and alarm '" .. tostring(rule.alarmPanel.alarmId) .. "'", "VirtualAlarmPanel.onRuleStatusInit", 2)
		local lul_resultcode, lul_resultstring, lul_job, lul_returnarguments = luup.call_action(
			SID.VirtualAlarmPanel,
			"GetAlarmStatus",
			{ alarmId = rule.alarmPanel.alarmId },
			rule.alarmPanel.deviceId
		)
		if ((lul_resultcode == 0) and (lul_returnarguments.retStatus ~= nil) and (lul_returnarguments.retStatus ~= "")) then
			rule._status = lul_returnarguments.retStatus
			rule._lastStatusTime = tonumber(lul_returnarguments.retLastUpdate)
		else
			RulesEngine.log("Rule '" .. rule.name .. "' - Can't retrieve status from VirtualAlarmPanel", "VirtualAlarmPanel.onRuleStatusInit", 1)
		end

		-- Enregistrement de l'observation des voyants
		-- Permet de gérer "à la main" le statut de la règle
		--luup.variable_watch("RulesEngine_VirtualAlarmPanel.onPanelAlarmStatusIsActivated", SID.VirtualAlarmPanel, "LastActiveAlarmId", rule.alarmPanel.deviceId)
	end
)

-- Action à l'activation d'une règle
RulesEngine.addHook(
	"VirtualAlarmPanel",
	"onRuleIsActivated",
	function (rule)
		if (type(rule.alarmPanel) ~= "table") then
			return
		end
		-- Activation du voyant lié
		RulesEngine.log("Rule '" .. rule.name .. "' - Activates panel alarm " .. rule.alarmPanel.alarmId, "VirtualAlarmPanel.onRuleIsActivated", 1)

		local indexByPanelAlarmName = tostring(rule.alarmPanel.deviceId) .. "-" .. tostring(rule.alarmPanel.alarmId)
		_indexRuleByPanelAlarmModeAuto[indexByPanelAlarmName] = true

		luup.call_action(
			SID.VirtualAlarmPanel,
			"SetAlarmStatus",
			{ alarmId = rule.alarmPanel.alarmId, newStatus = "1" },
			rule.alarmPanel.deviceId
		)
	end
)

-- Action à la désactivation d'une règle
RulesEngine.addHook(
	"VirtualAlarmPanel",
	"onRuleIsDeactivated",
	function (rule)
		if (type(rule.alarmPanel) ~= "table") then
			return
		end
		-- Désactivation du voyant lié
		RulesEngine.log("Rule '" .. rule.name .. "' - Deactivates panel alarm " .. rule.alarmPanel.alarmId, "VirtualAlarmPanel.onRuleIsDeactivated", 1)

		local indexByPanelAlarmName = tostring(rule.alarmPanel.deviceId) .. "-" .. tostring(rule.alarmPanel.alarmId)
		_indexRuleByPanelAlarmModeAuto[indexByPanelAlarmName] = true

		luup.call_action(
			SID.VirtualAlarmPanel,
			"SetAlarmStatus",
			{ alarmId = rule.alarmPanel.alarmId, newStatus = "0" },
			rule.alarmPanel.deviceId
		)
	end
)

-- **************************************************
-- Acknoledgment hook
-- **************************************************

-- Acknoledgment
-- If active, rule actions are not made
RulesEngine.addHook(
	"VirtualAlarmPanel",
	"beforeDoingAction",
	function (rule)
		if (type(rule.alarmPanel) ~= "table") then
			return true
		end
		if (rule.alarmPanel.noAcknowledge == true) then
			RulesEngine.log("Rule '" .. rule.name .. "' - Acknoledged is not allowed", "VirtualAlarmPanel.beforeDoingAction", 3)
			return true
		end
		local lul_resultcode, lul_resultstring, lul_job, lul_returnarguments = luup.call_action(
			SID.VirtualAlarmPanel,
			"GetAlarmAcknowledge",
			{ alarmId = rule.alarmPanel.alarmId },
			rule.alarmPanel.deviceId
		)
		if (lul_resultcode == 0) then
			if (lul_returnarguments.retAcknowledge == "1") then
				RulesEngine.log("Rule '" .. rule.name .. "' - Is acknoledged", "VirtualAlarmPanel.beforeDoingAction", 1)
				return false
			end
		else
			RulesEngine.log("Rule '" .. rule.name .. "' - Can't retrieve acknoledge", "VirtualAlarmPanel.beforeDoingAction", 1)
		end
		return true
	end
)
