/**
 * Socket.IO client
 * 
 * @author Guillermo Rauch <guillermo@learnboost.com>
 * @license The MIT license.
 * @copyright Copyright (c) 2010 LearnBoost <dev@learnboost.com>
 */

this.io = {
	version: '0.6.1',
	
	setPath: function(path){
		if (window.console && console.error) console.error('io.setPath will be removed. Please set the variable WEB_SOCKET_SWF_LOCATION pointing to WebSocketMain.swf');
		this.path = /\/$/.test(path) ? path : path + '/';
    WEB_SOCKET_SWF_LOCATION = path + 'lib/vendor/web-socket-js/WebSocketMain.swf';
	}
};

if ('jQuery' in this) jQuery.io = this.io;

if (typeof window != 'undefined'){
  // WEB_SOCKET_SWF_LOCATION = (document.location.protocol == 'https:' ? 'https:' : 'http:') + '//cdn.socket.io/' + this.io.version + '/WebSocketMain.swf';
  if (typeof WEB_SOCKET_SWF_LOCATION === 'undefined')
    WEB_SOCKET_SWF_LOCATION = '/socket.io/lib/vendor/web-socket-js/WebSocketMain.swf';
}
