/**
 * Socket.IO client
 * 
 * @author Guillermo Rauch <guillermo@learnboost.com>
 * @license The MIT license.
 * @copyright Copyright (c) 2010 LearnBoost <dev@learnboost.com>
 */

(function(){
	
	var Flashsocket = io.Transport.flashsocket = function(){
		io.Transport.websocket.apply(this, arguments);
	};
	
	io.util.inherit(Flashsocket, io.Transport.websocket);
	
	Flashsocket.prototype.type = 'flashsocket';
	
	Flashsocket.prototype._onClose = function(){
		if (!this.base.connected){
			// something failed, we might be behind a proxy, so we'll try another transport
			this.base.options.transports.splice(io.util.indexOf(this.base.options.transports, 'flashsocket'), 1);
			this.base.transport = this.base.getTransport();
			this.base.connect();
			return;
		}
		return io.Transport.websocket.prototype._onClose.call(this);
	};
	
	Flashsocket.check = function(){
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
	
	Flashsocket.xdomainCheck = function(){
		return true;
	};
	
})();