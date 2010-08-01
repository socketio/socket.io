/**
 * Socket.IO client
 * 
 * @author Guillermo Rauch <guillermo@learnboost.com>
 * @license The MIT license.
 * @copyright Copyright (c) 2010 LearnBoost <dev@learnboost.com>
 */

this.io = {
	version: '0.5.3',
	
	setPath: function(path){
		this.path = /\/$/.test(path) ? path : path + '/';
		
		// this is temporary until we get a fix for injecting Flash WebSocket javascript files dynamically,
		// as io.js shouldn't be aware of specific transports.
		if ('WebSocket' in window){
			WebSocket.__swfLocation = path + 'lib/vendor/web-socket-js/WebSocketMain.swf';
		}
	}
};

if ('jQuery' in this) jQuery.io = this.io;