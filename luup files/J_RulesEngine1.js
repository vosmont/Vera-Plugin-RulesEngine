//# sourceURL=J_RulesEngine1.js

/**
 * This file is part of the plugin RulesEngine.
 * https://github.com/vosmont/Vera-Plugin-RulesEngine
 * Copyright (c) 2016 Vincent OSMONT
 * This code is released under the MIT License, see LICENSE.
 */


( function( $ ) {
	if ( !window.api ) {
		window.api = {
			version: "UI5"
		};
	}
	// Custom CSS injection
	if ( !window.Utils ) {
		window.Utils = {};
	}
	// UI7 fix
	Utils.getDataRequestURL = function() {
		var dataRequestURL = api.getDataRequestURL();
		if ( dataRequestURL.indexOf( "?" ) === -1 ) {
			dataRequestURL += "?";
		}
		return dataRequestURL;
	};
	Utils.injectCustomCSS = function( nameSpace, css ) {
		if ( $( "#custom-css-" + nameSpace ).size() === 0 ) {
			Utils.logDebug( "Injects custom CSS for " + nameSpace );
			var pluginStyle = $( '<style id="custom-css-' + nameSpace + '">' );
			pluginStyle
				.text( css )
				.appendTo( "head" );
		} else {
			Utils.logDebug( "Injection of custom CSS has already been done for " + nameSpace );
		}
	};
} ) ( jQuery );


var RulesEngine = ( function( api, $ ) {
	var _uuid = "3148380e-7c06-4b80-96fa-b849d90dc8f9";
	var _deviceId;

	// Inject plugin specific CSS rules
	Utils.injectCustomCSS( "rulesengine", '\
.rulesengine-panel { padding: 5px; }\
.rulesengine-panel td { padding: 5px; }\
.rulesengine-error { color:red; }\
#rulesengine-donate { text-align: center; width: 70%; margin: auto; }\
#rulesengine-donate form { height: 50px; }\
	');

	// *************************************************************************************************
	// Tools
	// *************************************************************************************************

	/**
	 * Convert a unix timestamp into date
	 */
	function _convertTimestampToLocaleString( timestamp ) {
		if ( typeof( timestamp ) === "undefined" ) {
			return "";
		}
		var t = new Date( parseInt( timestamp, 10 ) * 1000 );
		var localeString = t.toLocaleString();
		return localeString;
	}
	function _convertTimestampToIsoString( timestamp ) {
		if ( typeof( timestamp ) === "undefined" ) {
			return "";
		}
		var t = new Date( parseInt( timestamp, 10 ) * 1000 );
		var isoString = t.toISOString();
		return isoString;
	}

	// *************************************************************************************************
	// Rules
	// *************************************************************************************************

	/**
	 * Show rules tab
	 */
	function _showRules( deviceId ) {
		_deviceId = deviceId;
		try {
			if ( typeof( ALTUI_RulesEngine ) === "undefined" ) {
				api.setCpanelContent(
					'<div class="rulesengine-panel">'
				+		'<div class="rulesengine-error">'
				+			'The rules can just be viewed and displayed on ALTUI'
				+		'</div>'
				+	'</div>'
				);
			} else {
				var altuiid = $( ".altui-device-controlpanel" ).data( "altuiid" );
				if ( altuiid ) {
					ALTUI_RulesEngine.pageRules( altuiid );
				} else {
					console.error( "Can not retrieve the altuiid of the device" );
				}
			}
		} catch ( err ) {
			console.error( "Error in RulesEngine.showRules(): " + err );
		}
	}

	// *************************************************************************************************
	// Errors
	// *************************************************************************************************

	/**
	 * Show errors tab
	 */
	function _showErrors( deviceId ) {
		_deviceId = deviceId;
		try {
			api.setCpanelContent(
					'<div class="rulesengine-panel">'
				+		'<div id="rulesengine-errors">'
				+		'</div>'
				+	'</div>'
			);
			// Display the errors
			$.ajax( {
				url: Utils.getDataRequestURL() + "id=lr_RulesEngine&command=getErrors&output_format=json#",
				dataType: "json"
			} )
			.done( function( errors ) {
				if ( $.isArray( errors ) && ( errors.length > 0 ) ) {
					var html = '<table><tr><th>Date</th><th>Rule</th><th>Error</th></tr>';
					$.each( errors, function( i, error ) {
						html += '<tr>'
							+		'<td>' + _convertTimestampToLocaleString( error.timestamp ) + '</td>'
							+		'<td>' + ( error.ruleId ? '#' + error.ruleId : '' ) + '</td>'
							+		'<td>' + error.event + '</td>'
							+	'</tr>';
					} );
					html += '</table>';
					$("#rulesengine-errors").html( html );
				} else {
					$("#rulesengine-errors").html( "There's no error." );
				}
			} );
		} catch ( err ) {
			console.error( "Error in RulesEngine.showErrors(): " + err );
		}
	}

	// *************************************************************************************************
	// Donate
	// *************************************************************************************************

	function _showDonate( deviceId ) {
		var donateHtml = '\
<form action="https://www.paypal.com/cgi-bin/webscr" method="post" target="_blank">\
<input type="hidden" name="cmd" value="_s-xclick">\
<input type="hidden" name="encrypted" value="-----BEGIN PKCS7-----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-----END PKCS7-----\
">\
<input type="image" src="https://www.paypalobjects.com/en_US/FR/i/btn/btn_donateCC_LG.gif" border="0" name="submit" alt="PayPal - The safer, easier way to pay online!">\
<img alt="" border="0" src="https://www.paypalobjects.com/fr_FR/i/scr/pixel.gif" width="1" height="1">\
</form>';

		api.setCpanelContent(
				'<div id="rulesengine-donate">'
			+		'<span>This plugin is free but if you install and find it useful then a donation to support further development is greatly appreciated</span>'
			+		donateHtml
			+	'</div>'
		);
	}

	// *************************************************************************************************
	// Main
	// *************************************************************************************************

	myModule = {
		uuid: _uuid,
		showRules : _showRules,
		showErrors: _showErrors,
		showDonate: _showDonate
	};

	// UI5 compatibility
	if ( api.version === "UI5" ) {
		window[ "RulesEngine.showDonate" ] = _showDonate;
	}

	return myModule;

})( api, jQuery );
