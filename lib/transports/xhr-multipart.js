/**
 * Socket.IO client
 * 
 * @author Guillermo Rauch <guillermo@learnboost.com>
 * @license The MIT license.
 * @copyright Copyright (c) 2010 LearnBoost <dev@learnboost.com>
 */

(function(){
	
	var XHRMultipart = io.Transport['xhr-multipart'] = function(){
		io.Transport.XHR.call(this);
	};
	
	XHRMultipart.prototype.type = 'xhr-multipart';
	
	XHRMultipart.prototype.connect = function(){
		var self = this;
		this._xhr = this._request('', 'GET', true);
		this._xhr.onreadystatechange = function(){
			if (self._xhr.readyState == 3) self._onData(self._xhr.responseText);
		};
		this._xhr.send();
	};
	
	XHRMultipart.check = function(){
		return 'XMLHttpRequest' in window && 'multipart' in XMLHttpRequest.prototype;
	};

	XHRMultipart.xdomainCheck = function(){
		return true;
	};
	
})();