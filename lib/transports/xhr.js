/**
 * Socket.IO client
 * 
 * @author Guillermo Rauch <guillermo@learnboost.com>
 * @license The MIT license.
 * @copyright Copyright (c) 2010 LearnBoost <dev@learnboost.com>
 */

(function(){
	
	var empty = new Function,
	    
	XMLHttpRequestCORS = (function(){
		if (!('XMLHttpRequest' in window)) return false;
		// CORS feature detection
		var a = new XMLHttpRequest();
		return a.withCredentials != undefined;
	})(),
	
	request = function(xdomain){
		if ('XDomainRequest' in window && xdomain) return new XDomainRequest();
		if ('XMLHttpRequest' in window && (!xdomain || XMLHttpRequestCORS)) return new XMLHttpRequest();
		if (!xdomain){
			try {
				var a = new ActiveXObject('MSXML2.XMLHTTP');
				return a;
			} catch(e){}
		
			try {
				var b = new ActiveXObject('Microsoft.XMLHTTP');
				return b;
			} catch(e){}
		}
		return false;
	},
	
	XHR = io.Transport.XHR = function(){
		io.Transport.apply(this, arguments);
		this._sendBuffer = [];
	};
	
	io.util.inherit(XHR, io.Transport);
	
	XHR.prototype.connect = function(){
		this._get();
		return this;
	};
	
	XHR.prototype._checkSend = function(){
		if (!this._posting && this._sendBuffer.length){
			var encoded = this._encode(this._sendBuffer);
			this._sendBuffer = [];
			this._send(encoded);
		}
	};
	
	XHR.prototype.send = function(data){
		if (io.util.isArray(data)){
			this._sendBuffer.push.apply(this._sendBuffer, data);
		} else {
			this._sendBuffer.push(data);
		}
		this._checkSend();
		return this;
	};
	
	XHR.prototype._send = function(data){
		var self = this;
		this._posting = true;
		this._sendXhr = this._request('send', 'POST');
		this._sendXhr.onreadystatechange = function(){
			var status;
			if (self._sendXhr.readyState == 4){
				self._sendXhr.onreadystatechange = empty;
				try { status = self._sendXhr.status; } catch(e){}
				self._posting = false;
				if (status == 200){
					self._checkSend();
				} else {
					self._onDisconnect();
				}
			}
		};
		this._sendXhr.send('data=' + encodeURIComponent(data));
	};
	
	XHR.prototype.disconnect = function(){
		// send disconnection signal
		this._onDisconnect();
		return this;
	};
	
	XHR.prototype._onDisconnect = function(){
		if (this._xhr){
			this._xhr.onreadystatechange = empty;
      try {
        this._xhr.abort();
      } catch(e){}
			this._xhr = null;
		}
		if (this._sendXhr){
      this._sendXhr.onreadystatechange = empty;
      try {
        this._sendXhr.abort();
      } catch(e){}
			this._sendXhr = null;
		}
		this._sendBuffer = [];
		io.Transport.prototype._onDisconnect.call(this);
	};
	
	XHR.prototype._request = function(url, method, multipart){
		var req = request(this.base._isXDomain());
		if (multipart) req.multipart = true;
		req.open(method || 'GET', this._prepareUrl() + (url ? '/' + url : ''));
		if (method == 'POST' && 'setRequestHeader' in req){
			req.setRequestHeader('Content-type', 'application/x-www-form-urlencoded; charset=utf-8');
		}
		return req;
	};
	
	XHR.check = function(xdomain){
		try {
			if (request(xdomain)) return true;
		} catch(e){}
		return false;
	};
	
	XHR.xdomainCheck = function(){
		return XHR.check(true);
	};
	
	XHR.request = request;
	
})();
