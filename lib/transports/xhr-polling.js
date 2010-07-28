/**
 * Socket.IO client
 * 
 * @author Guillermo Rauch <guillermo@learnboost.com>
 * @license The MIT license.
 * @copyright Copyright (c) 2010 LearnBoost <dev@learnboost.com>
 */

(function(){
	
	var empty = new Function(),
	
	XHRPolling = io.Transport['xhr-polling'] = function(){
		io.Transport.XHR.apply(this, arguments);
	};
	
	io.util.inherit(XHRPolling, io.Transport.XHR);
	
	XHRPolling.prototype.type = 'xhr-polling';
	
	XHRPolling.prototype._get = function(){
		var self = this;
		this._xhr = this._request(+ new Date, 'GET');
		if ('onload' in this._xhr){
			this._xhr.onload = function(){
				if (this.responseText.length) self._onData(this.responseText);
				self.connect();
			};
		} else {
			this._xhr.onreadystatechange = function(){
				var status;
				if (self._xhr.readyState == 4){
					self._xhr.onreadystatechange = empty;
					try { status = self._xhr.status; } catch(e){}
					if (status == 200){
						if (self._xhr.responseText.length) self._onData(self._xhr.responseText);
						self.connect();
					}
				}
			};
		}
		this._xhr.send();
	};
	
	XHRPolling.check = function(){
		return io.Transport.XHR.check();
	};
	
	XHRPolling.xdomainCheck = function(){
		return 'XDomainRequest' in window || 'XMLHttpRequest' in window;
	};
	
})();