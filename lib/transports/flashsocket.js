/**
 * Socket.IO client
 * 
 * @author Guillermo Rauch <guillermo@learnboost.com>
 * @license The MIT license.
 * @copyright Copyright (c) 2010 LearnBoost <dev@learnboost.com>
 */

io.Transport.flashsocket = io.Transport.websocket.extend({

	_onClose: function(){
		if (!this.base.connected){
			// something failed, we might be behind a proxy, so we'll try another transport
			this.base.options.transports.splice(io.util.Array.indexOf(this.base.options.transports, 'flashsocket'), 1);
			this.base.transport = this.base.getTransport();
			this.base.connect();
			return;
		}
		return this.__super__();
	}

});

io.Transport.flashsocket.check = function(){
	if (!('path' in io)) throw new Error('The `flashsocket` transport requires that you call io.setPath() with the path to the socket.io client dir.');
	if ('navigator' in window && 'plugins' in navigator && navigator.plugins['Shockwave Flash']){
		return !!navigator.plugins['Shockwave Flash'].description;
  }
	if ('ActiveXObject' in window) {
		try {
			return !!new ActiveXObject('ShockwaveFlash.ShockwaveFlash').GetVariable('$version');
		} catch (e) {}
	}
	return false;
};

io.Transport.flashsocket.xdomainCheck = function(){
	return true;
};