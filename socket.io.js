/** Socket.IO 0.6.2 - Built with build.js */
/**
 * Socket.IO client
 * 
 * @author Guillermo Rauch <guillermo@learnboost.com>
 * @license The MIT license.
 * @copyright Copyright (c) 2010 LearnBoost <dev@learnboost.com>
 */

var io = this.io = {
	version: '0.6.2',
	
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

/**
 * Socket.IO client
 * 
 * @author Guillermo Rauch <guillermo@learnboost.com>
 * @license The MIT license.
 * @copyright Copyright (c) 2010 LearnBoost <dev@learnboost.com>
 */

(function(){
	var io = this.io;

	var _pageLoaded = false;

	io.util = {

		ios: false,

		load: function(fn){
			if (/loaded|complete/.test(document.readyState) || _pageLoaded) return fn();
			if ('attachEvent' in window){
				window.attachEvent('onload', fn);
			} else {
				window.addEventListener('load', fn, false);
			}
		},

		inherit: function(ctor, superCtor){
			// no support for `instanceof` for now
			for (var i in superCtor.prototype){
				ctor.prototype[i] = superCtor.prototype[i];
			}
		},

		indexOf: function(arr, item, from){
			for (var l = arr.length, i = (from < 0) ? Math.max(0, l + from) : from || 0; i < l; i++){
				if (arr[i] === item) return i;
			}
			return -1;
		},

		isArray: function(obj){
			return Object.prototype.toString.call(obj) === '[object Array]';
		},
		
    merge: function(target, additional){
      for (var i in additional)
        if (additional.hasOwnProperty(i))
          target[i] = additional[i];
    }

	};

	io.util.ios = /iphone|ipad/i.test(navigator.userAgent);
	io.util.android = /android/i.test(navigator.userAgent);
	io.util.opera = /opera/i.test(navigator.userAgent);

	io.util.load(function(){
		_pageLoaded = true;
	});

})();

/**
 * Socket.IO client
 * 
 * @author Guillermo Rauch <guillermo@learnboost.com>
 * @license The MIT license.
 * @copyright Copyright (c) 2010 LearnBoost <dev@learnboost.com>
 */

// abstract

(function(){
	var io = this.io;
	
	var frame = '~m~',
	
	stringify = function(message){
		if (Object.prototype.toString.call(message) == '[object Object]'){
			if (!('JSON' in window)){
				if ('console' in window && console.error) console.error('Trying to encode as JSON, but JSON.stringify is missing.');
				return '{ "$error": "Invalid message" }';
			}
			return '~j~' + JSON.stringify(message);
		} else {
			return String(message);
		}
	};
	
	Transport = io.Transport = function(base, options){
		this.base = base;
		this.options = {
			timeout: 15000 // based on heartbeat interval default
		};
		io.util.merge(this.options, options);
	};

	Transport.prototype.send = function(){
		throw new Error('Missing send() implementation');
	};

	Transport.prototype.connect = function(){
		throw new Error('Missing connect() implementation');
	};

	Transport.prototype.disconnect = function(){
		throw new Error('Missing disconnect() implementation');
	};
	
	Transport.prototype._encode = function(messages){
		var ret = '', message,
				messages = io.util.isArray(messages) ? messages : [messages];
		for (var i = 0, l = messages.length; i < l; i++){
			message = messages[i] === null || messages[i] === undefined ? '' : stringify(messages[i]);
			ret += frame + message.length + frame + message;
		}
		return ret;
	};
	
	Transport.prototype._decode = function(data){
		var messages = [], number, n;
		do {
			if (data.substr(0, 3) !== frame) return messages;
			data = data.substr(3);
			number = '', n = '';
			for (var i = 0, l = data.length; i < l; i++){
				n = Number(data.substr(i, 1));
				if (data.substr(i, 1) == n){
					number += n;
				} else {	
					data = data.substr(number.length + frame.length);
					number = Number(number);
					break;
				} 
			}
			messages.push(data.substr(0, number)); // here
			data = data.substr(number);
		} while(data !== '');
		return messages;
	};
	
	Transport.prototype._onData = function(data){
		this._setTimeout();
		var msgs = this._decode(data);
		if (msgs && msgs.length){
			for (var i = 0, l = msgs.length; i < l; i++){
				this._onMessage(msgs[i]);
			}
		}
	};
	
	Transport.prototype._setTimeout = function(){
		var self = this;
		if (this._timeout) clearTimeout(this._timeout);
		this._timeout = setTimeout(function(){
			self._onTimeout();
		}, this.options.timeout);
	};
	
	Transport.prototype._onTimeout = function(){
		this._onDisconnect();
	};
	
	Transport.prototype._onMessage = function(message){
		if (!this.sessionid){
			this.sessionid = message;
			this._onConnect();
		} else if (message.substr(0, 3) == '~h~'){
			this._onHeartbeat(message.substr(3));
		} else if (message.substr(0, 3) == '~j~'){
			this.base._onMessage(JSON.parse(message.substr(3)));
		} else {
			this.base._onMessage(message);
		}
	},
	
	Transport.prototype._onHeartbeat = function(heartbeat){
		this.send('~h~' + heartbeat); // echo
	};
	
	Transport.prototype._onConnect = function(){
		this.connected = true;
		this.connecting = false;
		this.base._onConnect();
		this._setTimeout();
	};

	Transport.prototype._onDisconnect = function(){
		this.connecting = false;
		this.connected = false;
		this.sessionid = null;
		this.base._onDisconnect();
	};

	Transport.prototype._prepareUrl = function(){
		return (this.base.options.secure ? 'https' : 'http') 
			+ '://' + this.base.host 
			+ ':' + this.base.options.port
			+ '/' + this.base.options.resource
			+ '/' + this.type
			+ (this.sessionid ? ('/' + this.sessionid) : '/');
	};

})();
/**
 * Socket.IO client
 * 
 * @author Guillermo Rauch <guillermo@learnboost.com>
 * @license The MIT license.
 * @copyright Copyright (c) 2010 LearnBoost <dev@learnboost.com>
 */

(function(){
	var io = this.io;
	
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

/**
 * Socket.IO client
 * 
 * @author Guillermo Rauch <guillermo@learnboost.com>
 * @license The MIT license.
 * @copyright Copyright (c) 2010 LearnBoost <dev@learnboost.com>
 */

(function(){
	var io = this.io;
	
	var WS = io.Transport.websocket = function(){
		io.Transport.apply(this, arguments);
	};
	
	io.util.inherit(WS, io.Transport);
	
	WS.prototype.type = 'websocket';
	
	WS.prototype.connect = function(){
		var self = this;
		this.socket = new WebSocket(this._prepareUrl());
		this.socket.onmessage = function(ev){ self._onData(ev.data); };
		this.socket.onclose = function(ev){ self._onClose(); };
    this.socket.onerror = function(e){ self._onError(e); };
		return this;
	};
	
	WS.prototype.send = function(data){
		if (this.socket) this.socket.send(this._encode(data));
		return this;
	};
	
	WS.prototype.disconnect = function(){
		if (this.socket) this.socket.close();
		return this;
	};
	
	WS.prototype._onClose = function(){
		this._onDisconnect();
		return this;
	};

  WS.prototype._onError = function(e){
    this.base.emit('error', [e]);
  };
	
	WS.prototype._prepareUrl = function(){
		return (this.base.options.secure ? 'wss' : 'ws') 
		+ '://' + this.base.host 
		+ ':' + this.base.options.port
		+ '/' + this.base.options.resource
		+ '/' + this.type
		+ (this.sessionid ? ('/' + this.sessionid) : '');
	};
	
	WS.check = function(){
		// we make sure WebSocket is not confounded with a previously loaded flash WebSocket
		return 'WebSocket' in window && WebSocket.prototype && ( WebSocket.prototype.send && !!WebSocket.prototype.send.toString().match(/native/i)) && typeof WebSocket !== "undefined";
	};

	WS.xdomainCheck = function(){
		return true;
	};
	
})();

/**
 * Socket.IO client
 * 
 * @author Guillermo Rauch <guillermo@learnboost.com>
 * @license The MIT license.
 * @copyright Copyright (c) 2010 LearnBoost <dev@learnboost.com>
 */

(function(){
	var io = this.io;
	
	var Flashsocket = io.Transport.flashsocket = function(){
		io.Transport.websocket.apply(this, arguments);
	};
	
	io.util.inherit(Flashsocket, io.Transport.websocket);
	
	Flashsocket.prototype.type = 'flashsocket';
	
	Flashsocket.prototype.connect = function(){
		var self = this, args = arguments;
		WebSocket.__addTask(function(){
			io.Transport.websocket.prototype.connect.apply(self, args);
		});
		return this;
	};
	
	Flashsocket.prototype.send = function(){
		var self = this, args = arguments;
		WebSocket.__addTask(function(){
			io.Transport.websocket.prototype.send.apply(self, args);
		});
		return this;
	};
	
	Flashsocket.check = function(){
		if (typeof WebSocket == 'undefined' || !('__addTask' in WebSocket)) return false;
		if (io.util.opera) return false; // opera is buggy with this transport
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
/**
 * Socket.IO client
 * 
 * @author Guillermo Rauch <guillermo@learnboost.com>
 * @license The MIT license.
 * @copyright Copyright (c) 2010 LearnBoost <dev@learnboost.com>
 */

(function(){
	var io = this.io;
	
	var HTMLFile = io.Transport.htmlfile = function(){
		io.Transport.XHR.apply(this, arguments);
	};
	
	io.util.inherit(HTMLFile, io.Transport.XHR);
	
	HTMLFile.prototype.type = 'htmlfile';
	
	HTMLFile.prototype._get = function(){
		var self = this;
		this._open();
		window.attachEvent('onunload', function(){ self._destroy(); });
	};
	
	HTMLFile.prototype._open = function(){
		this._doc = new ActiveXObject('htmlfile');
		this._doc.open();
		this._doc.write('<html></html>');
		this._doc.parentWindow.s = this;
		this._doc.close();

		var _iframeC = this._doc.createElement('div');
		this._doc.body.appendChild(_iframeC);
		this._iframe = this._doc.createElement('iframe');
		_iframeC.appendChild(this._iframe);
		this._iframe.src = this._prepareUrl() + '/' + (+ new Date);
	};
	
	HTMLFile.prototype._ = function(data, doc){
		this._onData(data);
		var script = doc.getElementsByTagName('script')[0];
		script.parentNode.removeChild(script);
	};

  HTMLFile.prototype._destroy = function(){
    if (this._iframe){
      this._iframe.src = 'about:blank';
      this._doc = null;
      CollectGarbage();
    }
  };
	
	HTMLFile.prototype.disconnect = function(){
		this._destroy();
		return io.Transport.XHR.prototype.disconnect.call(this);
	};
	
	HTMLFile.check = function(){
		if ('ActiveXObject' in window){
			try {
				var a = new ActiveXObject('htmlfile');
				return a && io.Transport.XHR.check();
			} catch(e){}
		}
		return false;
	};

	HTMLFile.xdomainCheck = function(){
		// we can probably do handling for sub-domains, we should test that it's cross domain but a subdomain here
		return false;
	};
	
})();
/**
 * Socket.IO client
 * 
 * @author Guillermo Rauch <guillermo@learnboost.com>
 * @license The MIT license.
 * @copyright Copyright (c) 2010 LearnBoost <dev@learnboost.com>
 */

(function(){
	var io = this.io;
	
	var XHRMultipart = io.Transport['xhr-multipart'] = function(){
		io.Transport.XHR.apply(this, arguments);
	};
	
	io.util.inherit(XHRMultipart, io.Transport.XHR);
	
	XHRMultipart.prototype.type = 'xhr-multipart';
	
	XHRMultipart.prototype._get = function(){
		var self = this;
		this._xhr = this._request('', 'GET', true);
		this._xhr.onreadystatechange = function(){
			if (self._xhr.readyState == 4) self._onData(self._xhr.responseText);
		};
		this._xhr.send(null);
	};
	
	XHRMultipart.check = function(){
		return 'XMLHttpRequest' in window && 'prototype' in XMLHttpRequest && 'multipart' in XMLHttpRequest.prototype;
	};

	XHRMultipart.xdomainCheck = function(){
		return true;
	};
	
})();

/**
 * Socket.IO client
 * 
 * @author Guillermo Rauch <guillermo@learnboost.com>
 * @license The MIT license.
 * @copyright Copyright (c) 2010 LearnBoost <dev@learnboost.com>
 */

(function(){
	var io = this.io;

	var empty = new Function(),

	XHRPolling = io.Transport['xhr-polling'] = function(){
		io.Transport.XHR.apply(this, arguments);
	};

	io.util.inherit(XHRPolling, io.Transport.XHR);

	XHRPolling.prototype.type = 'xhr-polling';

	XHRPolling.prototype.connect = function(){
		if (io.util.ios || io.util.android){
			var self = this;
			io.util.load(function(){
				setTimeout(function(){
					io.Transport.XHR.prototype.connect.call(self);
				}, 10);
			});
		} else {
			io.Transport.XHR.prototype.connect.call(this);
		}
	};

	XHRPolling.prototype._get = function(){
		var self = this;
		this._xhr = this._request(+ new Date, 'GET');
    this._xhr.onreadystatechange = function(){
      var status;
      if (self._xhr.readyState == 4){
        self._xhr.onreadystatechange = empty;
        try { status = self._xhr.status; } catch(e){}
        if (status == 200){
          self._onData(self._xhr.responseText);
          self._get();
        } else {
          self._onDisconnect();
        }
      }
    };
		this._xhr.send(null);
	};

	XHRPolling.check = function(){
		return io.Transport.XHR.check();
	};

	XHRPolling.xdomainCheck = function(){
		return io.Transport.XHR.xdomainCheck();
	};

})();

/**
 * Socket.IO client
 * 
 * @author Guillermo Rauch <guillermo@learnboost.com>
 * @license The MIT license.
 * @copyright Copyright (c) 2010 LearnBoost <dev@learnboost.com>
 */

(function(){
	var io = this.io;
	
	io.JSONP = [];
	
	JSONPPolling = io.Transport['jsonp-polling'] = function(){
		io.Transport.XHR.apply(this, arguments);
		this._insertAt = document.getElementsByTagName('script')[0];
		this._index = io.JSONP.length;
		io.JSONP.push(this);
	};
	
	io.util.inherit(JSONPPolling, io.Transport['xhr-polling']);
	
	JSONPPolling.prototype.type = 'jsonp-polling';
	
	JSONPPolling.prototype._send = function(data){
		var self = this;
		if (!('_form' in this)){
			var form = document.createElement('FORM'),
				area = document.createElement('TEXTAREA'),
				id = this._iframeId = 'socket_io_iframe_' + this._index,
				iframe;
	
			form.style.position = 'absolute';
			form.style.top = '-1000px';
			form.style.left = '-1000px';
			form.target = id;
			form.method = 'POST';
			form.action = this._prepareUrl() + '/' + (+new Date) + '/' + this._index;
			area.name = 'data';
			form.appendChild(area);
			this._insertAt.parentNode.insertBefore(form, this._insertAt);
			document.body.appendChild(form);
	
			this._form = form;
			this._area = area;
		}
	
		function complete(){
			initIframe();
			self._posting = false;
			self._checkSend();
		};
	
		function initIframe(){
			if (self._iframe){
				self._form.removeChild(self._iframe);
			} 
	
			try {
				// ie6 dynamic iframes with target="" support (thanks Chris Lambacher)
				iframe = document.createElement('<iframe name="'+ self._iframeId +'">');
			} catch(e){
				iframe = document.createElement('iframe');
				iframe.name = self._iframeId;
			}
	
			iframe.id = self._iframeId;
	
			self._form.appendChild(iframe);
			self._iframe = iframe;
		};
	
		initIframe();
	
		this._posting = true;
		this._area.value = data;
	
		try {
			this._form.submit();
		} catch(e){}
	
		if (this._iframe.attachEvent){
			iframe.onreadystatechange = function(){
				if (self._iframe.readyState == 'complete') complete();
			};
		} else {
			this._iframe.onload = complete;
		}
	};
	
	JSONPPolling.prototype._get = function(){
		var self = this,
				script = document.createElement('SCRIPT');
		if (this._script){
			this._script.parentNode.removeChild(this._script);
			this._script = null;
		}
		script.async = true;
		script.src = this._prepareUrl() + '/' + (+new Date) + '/' + this._index;
		script.onerror = function(){
			self._onDisconnect();
		};
		this._insertAt.parentNode.insertBefore(script, this._insertAt);
		this._script = script;
	};
	
	JSONPPolling.prototype._ = function(){
		this._onData.apply(this, arguments);
		this._get();
		return this;
	};
	
	JSONPPolling.check = function(){
		return true;
	};
	
	JSONPPolling.xdomainCheck = function(){
		return true;
	};
})();
/**
 * Socket.IO client
 * 
 * @author Guillermo Rauch <guillermo@learnboost.com>
 * @license The MIT license.
 * @copyright Copyright (c) 2010 LearnBoost <dev@learnboost.com>
 */

(function(){
	var io = this.io;
	
	var Socket = io.Socket = function(host, options){
		this.host = host || document.domain;
		this.options = {
			secure: false,
			document: document,
			port: document.location.port || 80,
			resource: 'socket.io',
			transports: ['websocket', 'flashsocket', 'htmlfile', 'xhr-multipart', 'xhr-polling', 'jsonp-polling'],
			transportOptions: {
				'xhr-polling': {
					timeout: 25000 // based on polling duration default
				},
				'jsonp-polling': {
					timeout: 25000
				}
			},
			connectTimeout: 5000,
			reconnect: true,
			reconnectionDelay: 500,
			maxReconnectionAttempts: 10,
			tryTransportsOnConnectTimeout: true,
			rememberTransport: true
		};
		io.util.merge(this.options, options);
		this.connected = false;
		this.connecting = false;
		this._events = {};
		this.transport = this.getTransport();
		if (!this.transport && 'console' in window) console.error('No transport available');
	};
	
	Socket.prototype.getTransport = function(override){
		var transports = override || this.options.transports, match;
		if (this.options.rememberTransport && !override){
			match = this.options.document.cookie.match('(?:^|;)\\s*socketio=([^;]*)');
			if (match){
				this._rememberedTransport = true;
				transports = [decodeURIComponent(match[1])];
			}
		} 
		for (var i = 0, transport; transport = transports[i]; i++){
			if (io.Transport[transport] 
				&& io.Transport[transport].check() 
				&& (!this._isXDomain() || io.Transport[transport].xdomainCheck())){
				return new io.Transport[transport](this, this.options.transportOptions[transport] || {});
			}
		}
		return null;
	};
	
	Socket.prototype.connect = function(){
		if (this.transport && !this.connected){
			if (this.connecting) this.disconnect(true);
			this.connecting = true;
			this.emit('connecting', [this.transport.type]);
			this.transport.connect();
			if (this.options.connectTimeout){
				var self = this;
				this.connectTimeoutTimer = setTimeout(function(){
					if (!self.connected){
						self.disconnect(true);
						if (self.options.tryTransportsOnConnectTimeout && !self._rememberedTransport){
							if(!self._remainingTransports) self._remainingTransports = self.options.transports.slice(0);
							var transports = self._remainingTransports;
							while(transports.length > 0 && transports.splice(0,1)[0] != self.transport.type){}
							if(transports.length){
								self.transport = self.getTransport(transports);
								self.connect();
							}
						}
						if(!self._remainingTransports || self._remainingTransports.length == 0) self.emit('connect_failed');
					}
					if(self._remainingTransports && self._remainingTransports.length == 0) delete self._remainingTransports;
				}, this.options.connectTimeout);
			}
		}
		return this;
	};
	
	Socket.prototype.send = function(data){
		if (!this.transport || !this.transport.connected) return this._queue(data);
		this.transport.send(data);
		return this;
	};
	
	Socket.prototype.disconnect = function(reconnect){
    if (this.connectTimeoutTimer) clearTimeout(this.connectTimeoutTimer);
		if (!reconnect) this.options.reconnect = false;
		this.transport.disconnect();
		return this;
	};
	
	Socket.prototype.on = function(name, fn){
		if (!(name in this._events)) this._events[name] = [];
		this._events[name].push(fn);
		return this;
	};
	
  Socket.prototype.emit = function(name, args){
    if (name in this._events){
      var events = this._events[name].concat();
      for (var i = 0, ii = events.length; i < ii; i++)
        events[i].apply(this, args === undefined ? [] : args);
    }
    return this;
  };

	Socket.prototype.removeEvent = function(name, fn){
		if (name in this._events){
			for (var a = 0, l = this._events[name].length; a < l; a++)
				if (this._events[name][a] == fn) this._events[name].splice(a, 1);		
		}
		return this;
	};
	
	Socket.prototype._queue = function(message){
		if (!('_queueStack' in this)) this._queueStack = [];
		this._queueStack.push(message);
		return this;
	};
	
	Socket.prototype._doQueue = function(){
		if (!('_queueStack' in this) || !this._queueStack.length) return this;
		this.transport.send(this._queueStack);
		this._queueStack = [];
		return this;
	};
	
	Socket.prototype._isXDomain = function(){
    var locPort = window.location.port || 80;
		return this.host !== document.domain || this.options.port != locPort;
	};
	
	Socket.prototype._onConnect = function(){
		this.connected = true;
		this.connecting = false;
		this._doQueue();
		if (this.options.rememberTransport) this.options.document.cookie = 'socketio=' + encodeURIComponent(this.transport.type);
		this.emit('connect');
	};
	
	Socket.prototype._onMessage = function(data){
		this.emit('message', [data]);
	};
	
	Socket.prototype._onDisconnect = function(){
		var wasConnected = this.connected;
		this.connected = false;
		this.connecting = false;
		this._queueStack = [];
		if (wasConnected){
			this.emit('disconnect');
			if (this.options.reconnect && !this.reconnecting) this._onReconnect();
		}
	};
	
	Socket.prototype._onReconnect = function(){
		this.reconnecting = true;
		this.reconnectionAttempts = 0;
		this.reconnectionDelay = this.options.reconnectionDelay;
		
		var self = this
			, tryTransportsOnConnectTimeout = this.options.tryTransportsOnConnectTimeout
			, rememberTransport = this.options.rememberTransport;
		
		function reset(){
			if(self.connected) self.emit('reconnect',[self.transport.type,self.reconnectionAttempts]);
			self.removeEvent('connect_failed', maybeReconnect).removeEvent('connect', maybeReconnect);
			delete self.reconnecting;
			delete self.reconnectionAttempts;
			delete self.reconnectionDelay;
			delete self.reconnectionTimer;
			delete self.redoTransports;
			self.options.tryTransportsOnConnectTimeout = tryTransportsOnConnectTimeout;
			self.options.rememberTransport = rememberTransport;
			
			return;
		};
		
		function maybeReconnect(){
			if (!self.reconnecting) return;
			if (!self.connected){
				if (self.connecting && self.reconnecting) return self.reconnectionTimer = setTimeout(maybeReconnect, 1000);
				
				if (self.reconnectionAttempts++ >= self.options.maxReconnectionAttempts){
					if (!self.redoTransports){
						self.on('connect_failed', maybeReconnect);
						self.options.tryTransportsOnConnectTimeout = true;
						self.transport = self.getTransport(self.options.transports); // overwrite with all enabled transports
						self.redoTransports = true;
						self.connect();
					} else {
						self.emit('reconnect_failed');
						reset();
					}
				} else {
					self.reconnectionDelay *= 2; // exponential backoff
					self.connect();
					self.emit('reconnecting', [self.reconnectionDelay,self.reconnectionAttempts]);
					self.reconnectionTimer = setTimeout(maybeReconnect, self.reconnectionDelay);
				}
			} else {
				reset();
			}
		};
		this.options.tryTransportsOnConnectTimeout = false;
		this.reconnectionTimer = setTimeout(maybeReconnect, this.reconnectionDelay);
		
		this.on('connect', maybeReconnect);
	};

  Socket.prototype.fire = Socket.prototype.emit;
	Socket.prototype.addListener = Socket.prototype.addEvent = Socket.prototype.addEventListener = Socket.prototype.on;
	Socket.prototype.removeListener = Socket.prototype.removeEventListener = Socket.prototype.removeEvent;
	
})();
/*	SWFObject v2.2 <http://code.google.com/p/swfobject/> 
	is released under the MIT License <http://www.opensource.org/licenses/mit-license.php> 
*/
var swfobject=function(){var D="undefined",r="object",S="Shockwave Flash",W="ShockwaveFlash.ShockwaveFlash",q="application/x-shockwave-flash",R="SWFObjectExprInst",x="onreadystatechange",O=window,j=document,t=navigator,T=false,U=[h],o=[],N=[],I=[],l,Q,E,B,J=false,a=false,n,G,m=true,M=function(){var aa=typeof j.getElementById!=D&&typeof j.getElementsByTagName!=D&&typeof j.createElement!=D,ah=t.userAgent.toLowerCase(),Y=t.platform.toLowerCase(),ae=Y?/win/.test(Y):/win/.test(ah),ac=Y?/mac/.test(Y):/mac/.test(ah),af=/webkit/.test(ah)?parseFloat(ah.replace(/^.*webkit\/(\d+(\.\d+)?).*$/,"$1")):false,X=!+"\v1",ag=[0,0,0],ab=null;if(typeof t.plugins!=D&&typeof t.plugins[S]==r){ab=t.plugins[S].description;if(ab&&!(typeof t.mimeTypes!=D&&t.mimeTypes[q]&&!t.mimeTypes[q].enabledPlugin)){T=true;X=false;ab=ab.replace(/^.*\s+(\S+\s+\S+$)/,"$1");ag[0]=parseInt(ab.replace(/^(.*)\..*$/,"$1"),10);ag[1]=parseInt(ab.replace(/^.*\.(.*)\s.*$/,"$1"),10);ag[2]=/[a-zA-Z]/.test(ab)?parseInt(ab.replace(/^.*[a-zA-Z]+(.*)$/,"$1"),10):0}}else{if(typeof O.ActiveXObject!=D){try{var ad=new ActiveXObject(W);if(ad){ab=ad.GetVariable("$version");if(ab){X=true;ab=ab.split(" ")[1].split(",");ag=[parseInt(ab[0],10),parseInt(ab[1],10),parseInt(ab[2],10)]}}}catch(Z){}}}return{w3:aa,pv:ag,wk:af,ie:X,win:ae,mac:ac}}(),k=function(){if(!M.w3){return}if((typeof j.readyState!=D&&j.readyState=="complete")||(typeof j.readyState==D&&(j.getElementsByTagName("body")[0]||j.body))){f()}if(!J){if(typeof j.addEventListener!=D){j.addEventListener("DOMContentLoaded",f,false)}if(M.ie&&M.win){j.attachEvent(x,function(){if(j.readyState=="complete"){j.detachEvent(x,arguments.callee);f()}});if(O==top){(function(){if(J){return}try{j.documentElement.doScroll("left")}catch(X){setTimeout(arguments.callee,0);return}f()})()}}if(M.wk){(function(){if(J){return}if(!/loaded|complete/.test(j.readyState)){setTimeout(arguments.callee,0);return}f()})()}s(f)}}();function f(){if(J){return}try{var Z=j.getElementsByTagName("body")[0].appendChild(C("span"));Z.parentNode.removeChild(Z)}catch(aa){return}J=true;var X=U.length;for(var Y=0;Y<X;Y++){U[Y]()}}function K(X){if(J){X()}else{U[U.length]=X}}function s(Y){if(typeof O.addEventListener!=D){O.addEventListener("load",Y,false)}else{if(typeof j.addEventListener!=D){j.addEventListener("load",Y,false)}else{if(typeof O.attachEvent!=D){i(O,"onload",Y)}else{if(typeof O.onload=="function"){var X=O.onload;O.onload=function(){X();Y()}}else{O.onload=Y}}}}}function h(){if(T){V()}else{H()}}function V(){var X=j.getElementsByTagName("body")[0];var aa=C(r);aa.setAttribute("type",q);var Z=X.appendChild(aa);if(Z){var Y=0;(function(){if(typeof Z.GetVariable!=D){var ab=Z.GetVariable("$version");if(ab){ab=ab.split(" ")[1].split(",");M.pv=[parseInt(ab[0],10),parseInt(ab[1],10),parseInt(ab[2],10)]}}else{if(Y<10){Y++;setTimeout(arguments.callee,10);return}}X.removeChild(aa);Z=null;H()})()}else{H()}}function H(){var ag=o.length;if(ag>0){for(var af=0;af<ag;af++){var Y=o[af].id;var ab=o[af].callbackFn;var aa={success:false,id:Y};if(M.pv[0]>0){var ae=c(Y);if(ae){if(F(o[af].swfVersion)&&!(M.wk&&M.wk<312)){w(Y,true);if(ab){aa.success=true;aa.ref=z(Y);ab(aa)}}else{if(o[af].expressInstall&&A()){var ai={};ai.data=o[af].expressInstall;ai.width=ae.getAttribute("width")||"0";ai.height=ae.getAttribute("height")||"0";if(ae.getAttribute("class")){ai.styleclass=ae.getAttribute("class")}if(ae.getAttribute("align")){ai.align=ae.getAttribute("align")}var ah={};var X=ae.getElementsByTagName("param");var ac=X.length;for(var ad=0;ad<ac;ad++){if(X[ad].getAttribute("name").toLowerCase()!="movie"){ah[X[ad].getAttribute("name")]=X[ad].getAttribute("value")}}P(ai,ah,Y,ab)}else{p(ae);if(ab){ab(aa)}}}}}else{w(Y,true);if(ab){var Z=z(Y);if(Z&&typeof Z.SetVariable!=D){aa.success=true;aa.ref=Z}ab(aa)}}}}}function z(aa){var X=null;var Y=c(aa);if(Y&&Y.nodeName=="OBJECT"){if(typeof Y.SetVariable!=D){X=Y}else{var Z=Y.getElementsByTagName(r)[0];if(Z){X=Z}}}return X}function A(){return !a&&F("6.0.65")&&(M.win||M.mac)&&!(M.wk&&M.wk<312)}function P(aa,ab,X,Z){a=true;E=Z||null;B={success:false,id:X};var ae=c(X);if(ae){if(ae.nodeName=="OBJECT"){l=g(ae);Q=null}else{l=ae;Q=X}aa.id=R;if(typeof aa.width==D||(!/%$/.test(aa.width)&&parseInt(aa.width,10)<310)){aa.width="310"}if(typeof aa.height==D||(!/%$/.test(aa.height)&&parseInt(aa.height,10)<137)){aa.height="137"}j.title=j.title.slice(0,47)+" - Flash Player Installation";var ad=M.ie&&M.win?"ActiveX":"PlugIn",ac="MMredirectURL="+O.location.toString().replace(/&/g,"%26")+"&MMplayerType="+ad+"&MMdoctitle="+j.title;if(typeof ab.flashvars!=D){ab.flashvars+="&"+ac}else{ab.flashvars=ac}if(M.ie&&M.win&&ae.readyState!=4){var Y=C("div");X+="SWFObjectNew";Y.setAttribute("id",X);ae.parentNode.insertBefore(Y,ae);ae.style.display="none";(function(){if(ae.readyState==4){ae.parentNode.removeChild(ae)}else{setTimeout(arguments.callee,10)}})()}u(aa,ab,X)}}function p(Y){if(M.ie&&M.win&&Y.readyState!=4){var X=C("div");Y.parentNode.insertBefore(X,Y);X.parentNode.replaceChild(g(Y),X);Y.style.display="none";(function(){if(Y.readyState==4){Y.parentNode.removeChild(Y)}else{setTimeout(arguments.callee,10)}})()}else{Y.parentNode.replaceChild(g(Y),Y)}}function g(ab){var aa=C("div");if(M.win&&M.ie){aa.innerHTML=ab.innerHTML}else{var Y=ab.getElementsByTagName(r)[0];if(Y){var ad=Y.childNodes;if(ad){var X=ad.length;for(var Z=0;Z<X;Z++){if(!(ad[Z].nodeType==1&&ad[Z].nodeName=="PARAM")&&!(ad[Z].nodeType==8)){aa.appendChild(ad[Z].cloneNode(true))}}}}}return aa}function u(ai,ag,Y){var X,aa=c(Y);if(M.wk&&M.wk<312){return X}if(aa){if(typeof ai.id==D){ai.id=Y}if(M.ie&&M.win){var ah="";for(var ae in ai){if(ai[ae]!=Object.prototype[ae]){if(ae.toLowerCase()=="data"){ag.movie=ai[ae]}else{if(ae.toLowerCase()=="styleclass"){ah+=' class="'+ai[ae]+'"'}else{if(ae.toLowerCase()!="classid"){ah+=" "+ae+'="'+ai[ae]+'"'}}}}}var af="";for(var ad in ag){if(ag[ad]!=Object.prototype[ad]){af+='<param name="'+ad+'" value="'+ag[ad]+'" />'}}aa.outerHTML='<object classid="clsid:D27CDB6E-AE6D-11cf-96B8-444553540000"'+ah+">"+af+"</object>";N[N.length]=ai.id;X=c(ai.id)}else{var Z=C(r);Z.setAttribute("type",q);for(var ac in ai){if(ai[ac]!=Object.prototype[ac]){if(ac.toLowerCase()=="styleclass"){Z.setAttribute("class",ai[ac])}else{if(ac.toLowerCase()!="classid"){Z.setAttribute(ac,ai[ac])}}}}for(var ab in ag){if(ag[ab]!=Object.prototype[ab]&&ab.toLowerCase()!="movie"){e(Z,ab,ag[ab])}}aa.parentNode.replaceChild(Z,aa);X=Z}}return X}function e(Z,X,Y){var aa=C("param");aa.setAttribute("name",X);aa.setAttribute("value",Y);Z.appendChild(aa)}function y(Y){var X=c(Y);if(X&&X.nodeName=="OBJECT"){if(M.ie&&M.win){X.style.display="none";(function(){if(X.readyState==4){b(Y)}else{setTimeout(arguments.callee,10)}})()}else{X.parentNode.removeChild(X)}}}function b(Z){var Y=c(Z);if(Y){for(var X in Y){if(typeof Y[X]=="function"){Y[X]=null}}Y.parentNode.removeChild(Y)}}function c(Z){var X=null;try{X=j.getElementById(Z)}catch(Y){}return X}function C(X){return j.createElement(X)}function i(Z,X,Y){Z.attachEvent(X,Y);I[I.length]=[Z,X,Y]}function F(Z){var Y=M.pv,X=Z.split(".");X[0]=parseInt(X[0],10);X[1]=parseInt(X[1],10)||0;X[2]=parseInt(X[2],10)||0;return(Y[0]>X[0]||(Y[0]==X[0]&&Y[1]>X[1])||(Y[0]==X[0]&&Y[1]==X[1]&&Y[2]>=X[2]))?true:false}function v(ac,Y,ad,ab){if(M.ie&&M.mac){return}var aa=j.getElementsByTagName("head")[0];if(!aa){return}var X=(ad&&typeof ad=="string")?ad:"screen";if(ab){n=null;G=null}if(!n||G!=X){var Z=C("style");Z.setAttribute("type","text/css");Z.setAttribute("media",X);n=aa.appendChild(Z);if(M.ie&&M.win&&typeof j.styleSheets!=D&&j.styleSheets.length>0){n=j.styleSheets[j.styleSheets.length-1]}G=X}if(M.ie&&M.win){if(n&&typeof n.addRule==r){n.addRule(ac,Y)}}else{if(n&&typeof j.createTextNode!=D){n.appendChild(j.createTextNode(ac+" {"+Y+"}"))}}}function w(Z,X){if(!m){return}var Y=X?"visible":"hidden";if(J&&c(Z)){c(Z).style.visibility=Y}else{v("#"+Z,"visibility:"+Y)}}function L(Y){var Z=/[\\\"<>\.;]/;var X=Z.exec(Y)!=null;return X&&typeof encodeURIComponent!=D?encodeURIComponent(Y):Y}var d=function(){if(M.ie&&M.win){window.attachEvent("onunload",function(){var ac=I.length;for(var ab=0;ab<ac;ab++){I[ab][0].detachEvent(I[ab][1],I[ab][2])}var Z=N.length;for(var aa=0;aa<Z;aa++){y(N[aa])}for(var Y in M){M[Y]=null}M=null;for(var X in swfobject){swfobject[X]=null}swfobject=null})}}();return{registerObject:function(ab,X,aa,Z){if(M.w3&&ab&&X){var Y={};Y.id=ab;Y.swfVersion=X;Y.expressInstall=aa;Y.callbackFn=Z;o[o.length]=Y;w(ab,false)}else{if(Z){Z({success:false,id:ab})}}},getObjectById:function(X){if(M.w3){return z(X)}},embedSWF:function(ab,ah,ae,ag,Y,aa,Z,ad,af,ac){var X={success:false,id:ah};if(M.w3&&!(M.wk&&M.wk<312)&&ab&&ah&&ae&&ag&&Y){w(ah,false);K(function(){ae+="";ag+="";var aj={};if(af&&typeof af===r){for(var al in af){aj[al]=af[al]}}aj.data=ab;aj.width=ae;aj.height=ag;var am={};if(ad&&typeof ad===r){for(var ak in ad){am[ak]=ad[ak]}}if(Z&&typeof Z===r){for(var ai in Z){if(typeof am.flashvars!=D){am.flashvars+="&"+ai+"="+Z[ai]}else{am.flashvars=ai+"="+Z[ai]}}}if(F(Y)){var an=u(aj,am,ah);if(aj.id==ah){w(ah,true)}X.success=true;X.ref=an}else{if(aa&&A()){aj.data=aa;P(aj,am,ah,ac);return}else{w(ah,true)}}if(ac){ac(X)}})}else{if(ac){ac(X)}}},switchOffAutoHideShow:function(){m=false},ua:M,getFlashPlayerVersion:function(){return{major:M.pv[0],minor:M.pv[1],release:M.pv[2]}},hasFlashPlayerVersion:F,createSWF:function(Z,Y,X){if(M.w3){return u(Z,Y,X)}else{return undefined}},showExpressInstall:function(Z,aa,X,Y){if(M.w3&&A()){P(Z,aa,X,Y)}},removeSWF:function(X){if(M.w3){y(X)}},createCSS:function(aa,Z,Y,X){if(M.w3){v(aa,Z,Y,X)}},addDomLoadEvent:K,addLoadEvent:s,getQueryParamValue:function(aa){var Z=j.location.search||j.location.hash;if(Z){if(/\?/.test(Z)){Z=Z.split("?")[1]}if(aa==null){return L(Z)}var Y=Z.split("&");for(var X=0;X<Y.length;X++){if(Y[X].substring(0,Y[X].indexOf("="))==aa){return L(Y[X].substring((Y[X].indexOf("=")+1)))}}}return""},expressInstallCallback:function(){if(a){var X=c(R);if(X&&l){X.parentNode.replaceChild(l,X);if(Q){w(Q,true);if(M.ie&&M.win){l.style.display="block"}}if(E){E(B)}}a=false}}}}();
// Copyright: Hiroshi Ichikawa <http://gimite.net/en/>
// License: New BSD License
// Reference: http://dev.w3.org/html5/websockets/
// Reference: http://tools.ietf.org/html/draft-hixie-thewebsocketprotocol

(function() {
  
  if (window.WebSocket) return;

  var console = window.console;
  if (!console || !console.log || !console.error) {
    console = {log: function(){ }, error: function(){ }};
  }
  
  if (!swfobject.hasFlashPlayerVersion("10.0.0")) {
    console.error("Flash Player >= 10.0.0 is required.");
    return;
  }
  if (location.protocol == "file:") {
    console.error(
      "WARNING: web-socket-js doesn't work in file:///... URL " +
      "unless you set Flash Security Settings properly. " +
      "Open the page via Web server i.e. http://...");
  }

  /**
   * This class represents a faux web socket.
   * @param {string} url
   * @param {string} protocol
   * @param {string} proxyHost
   * @param {int} proxyPort
   * @param {string} headers
   */
  WebSocket = function(url, protocol, proxyHost, proxyPort, headers) {
    var self = this;
    self.__id = WebSocket.__nextId++;
    WebSocket.__instances[self.__id] = self;
    self.readyState = WebSocket.CONNECTING;
    self.bufferedAmount = 0;
    // Uses setTimeout() to make sure __createFlash() runs after the caller sets ws.onopen etc.
    // Otherwise, when onopen fires immediately, onopen is called before it is set.
    setTimeout(function() {
      WebSocket.__addTask(function() {
        WebSocket.__flash.create(
            self.__id, url, protocol, proxyHost || null, proxyPort || 0, headers || null);
      });
    }, 0);
  };

  /**
   * Send data to the web socket.
   * @param {string} data  The data to send to the socket.
   * @return {boolean}  True for success, false for failure.
   */
  WebSocket.prototype.send = function(data) {
    if (this.readyState == WebSocket.CONNECTING) {
      throw "INVALID_STATE_ERR: Web Socket connection has not been established";
    }
    // We use encodeURIComponent() here, because FABridge doesn't work if
    // the argument includes some characters. We don't use escape() here
    // because of this:
    // https://developer.mozilla.org/en/Core_JavaScript_1.5_Guide/Functions#escape_and_unescape_Functions
    // But it looks decodeURIComponent(encodeURIComponent(s)) doesn't
    // preserve all Unicode characters either e.g. "\uffff" in Firefox.
    // Note by wtritch: Hopefully this will not be necessary using ExternalInterface.  Will require
    // additional testing.
    var result = WebSocket.__flash.send(this.__id, encodeURIComponent(data));
    if (result < 0) { // success
      return true;
    } else {
      this.bufferedAmount += result;
      return false;
    }
  };

  /**
   * Close this web socket gracefully.
   */
  WebSocket.prototype.close = function() {
    if (this.readyState == WebSocket.CLOSED || this.readyState == WebSocket.CLOSING) {
      return;
    }
    this.readyState = WebSocket.CLOSING;
    WebSocket.__flash.close(this.__id);
  };

  /**
   * Implementation of {@link <a href="http://www.w3.org/TR/DOM-Level-2-Events/events.html#Events-registration">DOM 2 EventTarget Interface</a>}
   *
   * @param {string} type
   * @param {function} listener
   * @param {boolean} useCapture !NB Not implemented yet
   * @return void
   */
  WebSocket.prototype.addEventListener = function(type, listener, useCapture) {
    if (!('__events' in this)) {
      this.__events = {};
    }
    if (!(type in this.__events)) {
      this.__events[type] = [];
      if ('function' == typeof this['on' + type]) {
        this.__events[type].defaultHandler = this['on' + type];
        this['on' + type] = this.__createEventHandler(this, type);
      }
    }
    this.__events[type].push(listener);
  };

  /**
   * Implementation of {@link <a href="http://www.w3.org/TR/DOM-Level-2-Events/events.html#Events-registration">DOM 2 EventTarget Interface</a>}
   *
   * @param {string} type
   * @param {function} listener
   * @param {boolean} useCapture NB! Not implemented yet
   * @return void
   */
  WebSocket.prototype.removeEventListener = function(type, listener, useCapture) {
    if (!('__events' in this)) {
      this.__events = {};
    }
    if (!(type in this.__events)) return;
    for (var i = this.__events.length; i > -1; --i) {
      if (listener === this.__events[type][i]) {
        this.__events[type].splice(i, 1);
        break;
      }
    }
  };

  /**
   * Implementation of {@link <a href="http://www.w3.org/TR/DOM-Level-2-Events/events.html#Events-registration">DOM 2 EventTarget Interface</a>}
   *
   * @param {WebSocketEvent} event
   * @return void
   */
  WebSocket.prototype.dispatchEvent = function(event) {
    if (!('__events' in this)) throw 'UNSPECIFIED_EVENT_TYPE_ERR';
    if (!(event.type in this.__events)) throw 'UNSPECIFIED_EVENT_TYPE_ERR';
  
    for (var i = 0, l = this.__events[event.type].length; i < l; ++ i) {
      this.__events[event.type][i](event);
      if (event.cancelBubble) break;
    }
  
    if (false !== event.returnValue &&
      'function' == typeof this.__events[event.type].defaultHandler)
    {
      this.__events[event.type].defaultHandler(event);
    }
  };

  /**
   * Handle an event from flash.  Do any websocket-specific
   * handling before passing the event off to the event handlers.
   * @param {Object} event
   */
  WebSocket.prototype.__handleEvent = function(event) {
    if ("readyState" in event) {
      this.readyState = event.readyState;
    }
  
    try {
      if (event.type == "open") {
        this.onopen && this.onopen();
      } else if (event.type == "close") {
        this.onclose && this.onclose();
      } else if (event.type == "error") {
        this.onerror && this.onerror(event);
      } else if (event.type == "message") {
        if (this.onmessage) {
          var data = decodeURIComponent(event.message);
          var e;
          if (window.MessageEvent && !window.opera) {
            e = document.createEvent("MessageEvent");
            e.initMessageEvent("message", false, false, data, null, null, window, null);
          } else {
            // IE and Opera, the latter one truncates the data parameter after any 0x00 bytes.
            e = {data: data};
          }
          this.onmessage(e);
        }
        
      } else {
        throw "unknown event type: " + event.type;
      }
    } catch (e) {
      console.error(e.toString());
    }
  };
  
  /**
   * @param {object} object
   * @param {string} type
   */
  WebSocket.prototype.__createEventHandler = function(object, type) {
    return function(data) {
      var event = new WebSocketEvent();
      event.initEvent(type, true, true);
      event.target = event.currentTarget = object;
      for (var key in data) {
        event[key] = data[key];
      }
      object.dispatchEvent(event, arguments);
    };
  };

  /**
   * Define the WebSocket readyState enumeration.
   */
  WebSocket.CONNECTING = 0;
  WebSocket.OPEN = 1;
  WebSocket.CLOSING = 2;
  WebSocket.CLOSED = 3;

  WebSocket.__flash = null;
  WebSocket.__instances = {};
  WebSocket.__tasks = [];
  WebSocket.__nextId = 0;
  
  /**
   * Loads WebSocketMain.swf and creates WebSocketMain object in Flash.
   */
  WebSocket.__initialize = function() {
    if (WebSocket.__flash) return;
    
    if (WebSocket.__swfLocation) {
      // For backword compatibility.
      window.WEB_SOCKET_SWF_LOCATION = WebSocket.__swfLocation;
    }
    if (!window.WEB_SOCKET_SWF_LOCATION) {
      console.error("[WebSocket] set WEB_SOCKET_SWF_LOCATION to location of WebSocketMain.swf");
      return;
    }
    var container = document.createElement("div");
    container.id = "webSocketContainer";
    // Hides Flash box. We cannot use display: none or visibility: hidden because it prevents
    // Flash from loading at least in IE. So we move it out of the screen at (-100, -100).
    // But this even doesn't work with Flash Lite (e.g. in Droid Incredible). So with Flash
    // Lite, we put it at (0, 0). This shows 1x1 box visible at left-top corner but this is
    // the best we can do as far as we know now.
    container.style.position = "absolute";
    if (WebSocket.__isFlashLite()) {
      container.style.left = "0px";
      container.style.top = "0px";
    } else {
      container.style.left = "-100px";
      container.style.top = "-100px";
    }
    var holder = document.createElement("div");
    holder.id = "webSocketFlash";
    container.appendChild(holder);
    document.body.appendChild(container);
    // See this article for hasPriority:
    // http://help.adobe.com/en_US/as3/mobile/WS4bebcd66a74275c36cfb8137124318eebc6-7ffd.html
    swfobject.embedSWF(
      WEB_SOCKET_SWF_LOCATION,
      "webSocketFlash",
      "1" /* width */,
      "1" /* height */,
      "10.0.0" /* SWF version */,
      null,
      null,
      {hasPriority: true, swliveconnect : true, allowScriptAccess: "always"},
      null,
      function(e) {
        if (!e.success) {
          console.error("[WebSocket] swfobject.embedSWF failed");
        }
      });
  };
  
  /**
   * Load a new flash security policy file.
   * @param {string} url
   */
  WebSocket.loadFlashPolicyFile = function(url){
    WebSocket.__addTask(function() {
      WebSocket.__flash.loadManualPolicyFile(url);
    });
  };

  /**
   * Called by flash to notify js that it's fully loaded and ready
   * for communication.
   */
  WebSocket.__onFlashInitialized = function() {
    // We need to set a timeout here to avoid round-trip calls
    // to flash during the initialization process.
    setTimeout(function() {
      WebSocket.__flash = document.getElementById("webSocketFlash");
      WebSocket.__flash.setCallerUrl(location.href);
      WebSocket.__flash.setDebug(!!window.WEB_SOCKET_DEBUG);
      for (var i = 0; i < WebSocket.__tasks.length; ++i) {
        WebSocket.__tasks[i]();
      }
      WebSocket.__tasks = [];
    }, 0);
  };
  
  /**
   * Called by flash to dispatch an event to a web socket.
   * @param {object} eventObj  A web socket event dispatched from flash.
   */
  WebSocket.__onFlashEvent = function() {
    setTimeout(function() {
      // Gets events using receiveEvents() instead of getting it from event object
      // of Flash event. This is to make sure to keep message order.
      // It seems sometimes Flash events don't arrive in the same order as they are sent.
      var events = WebSocket.__flash.receiveEvents();
      for (var i = 0; i < events.length; ++i) {
        WebSocket.__instances[events[i].webSocketId].__handleEvent(events[i]);
      }
    }, 0);
    return true;
  };
  
  // called from Flash
  WebSocket.__log = function(message) {
    console.log(decodeURIComponent(message));
  };
  
  // called from Flash
  WebSocket.__error = function(message) {
    console.error(decodeURIComponent(message));
  };
  
  WebSocket.__addTask = function(task) {
    if (WebSocket.__flash) {
      task();
    } else {
      WebSocket.__tasks.push(task);
    }
  };
  
  /**
   * Test if the browser is running flash lite.
   * @return {boolean} True if flash lite is running, false otherwise.
   */
  WebSocket.__isFlashLite = function() {
    if (!window.navigator || !window.navigator.mimeTypes) {
      return false;
    }
    var mimeType = window.navigator.mimeTypes["application/x-shockwave-flash"];
    if (!mimeType || !mimeType.enabledPlugin || !mimeType.enabledPlugin.filename) {
      return false;
    }
    return mimeType.enabledPlugin.filename.match(/flashlite/i) ? true : false;
  };
  
  /**
   * Basic implementation of {@link <a href="http://www.w3.org/TR/DOM-Level-2-Events/events.html#Events-interface">DOM 2 EventInterface</a>}
   *
   * @class
   * @constructor
   */
  function WebSocketEvent(){}
  
  /**
   *
   * @type boolean
   */
  WebSocketEvent.prototype.cancelable = true;
  
  /**
  *
  * @type boolean
  */
  WebSocketEvent.prototype.cancelBubble = false;
  
  /**
  *
  * @return void
  */
  WebSocketEvent.prototype.preventDefault = function() {
    if (this.cancelable) {
      this.returnValue = false;
    }
  };
  
  /**
  *
  * @return void
  */
  WebSocketEvent.prototype.stopPropagation = function() {
    this.cancelBubble = true;
  };

  /**
  *
  * @param {string} eventTypeArg
  * @param {boolean} canBubbleArg
  * @param {boolean} cancelableArg
  * @return void
  */
  WebSocketEvent.prototype.initEvent = function(eventTypeArg, canBubbleArg, cancelableArg) {
    this.type = eventTypeArg;
    this.cancelable = cancelableArg;
    this.timeStamp = new Date();
  };

  if (!window.WEB_SOCKET_DISABLE_AUTO_INITIALIZATION) {
    if (window.addEventListener) {
      window.addEventListener("load", function(){
        WebSocket.__initialize();
      }, false);
    } else {
      window.attachEvent("onload", function(){
        WebSocket.__initialize();
      });
    }
  }
  
})();

