/** Socket.IO 0.1.4 - Built with build.js */
/**
 * Socket.IO client
 * 
 * @author Guillermo Rauch <guillermo@rosepad.com>
 * @license The MIT license.
 * @copyright Copyright (c) 2009 RosePad <dev@rosepad.com>
 */

this.io = {
	version: '0.1.4',

	setPath: function(path){
		this.path = /\/$/.test(path) ? path : path + '/';
		
		// this is temporary until we get a fix for injecting Flash WebSocket javascript files dynamically, 
		// as io.js shouldn't be aware of specific transports.
		WebSocket.__swfLocation = path + 'lib/vendor/web-socket-js/WebSocketMain.swf';
	}
};

if ('jQuery' in this) jQuery.io = this.io;
/**
 * Socket.IO client
 * 
 * @author Guillermo Rauch <guillermo@rosepad.com>
 * @license The MIT license.
 * @copyright Copyright (c) 2009 RosePad <dev@rosepad.com>
 */

io.util = {};
// Based on Core.js from MooTools (MIT)
// Copyright (c) 2006-2009 Valerio Proietti, <http://mad4milk.net/>

(function(){

	var object = io.util.Object = {

		clone: function(item){
			var clone;
			if (item instanceof Array){
				clone = [];
				for (var i = 0; i < item.length; i++) clone[i] = object.clone(item[i]);
				return clone;
			} else if (typeof item == 'object') {
				clone = {};
				for (var key in object) clone[key] = object.clone(object[key]);
				return clone;
			} else {
				return item;
			}
		},

		merge: function(source, k, v){
			if (typeof k == 'string') return mergeOne(source, k, v);
			for (var i = 1, l = arguments.length; i < l; i++){
				var object = arguments[i];
				for (var key in object) mergeOne(source, key, object[key]);
			}
			return source;
		}

	},

	mergeOne = function(source, key, current){
		if (current instanceof Array){
			source[key] = object.clone(current);
		} else if (typeof current == 'object'){
			if (typeof source[key] == 'object') object.merge(source[key], current);
			else source[key] = object.clone(current);
		} else {
			source[key] = current;
		}
		return source;
	};
  
})();
// Methods from Array.js from MooTools (MIT)
// Copyright (c) 2006-2009 Valerio Proietti, <http://mad4milk.net/>

(function(){

	var array = io.util.Array = {

		include: function(arr, item){
			if (!array.contains(arr, item)) arr.push(item);
			return arr;
		},

		each: function(arr, fn, bind){
			for (var i = 0, l = arr.length; i < l; i++) fn.call(bind, arr[i], i, arr);
		},

		contains: function(arr, item, from){
			return array.indexOf(arr, item, from) != -1;
		},

		indexOf: function(arr, item, from){
			for (var l = arr.length, i = (from < 0) ? Math.max(0, l + from) : from || 0; i < l; i++){
				if (arr[i] === item) return i;
			}
			return -1;
		}

	};

})();
// Based on Mixin.js from MooTools (MIT)
// Copyright (c) 2006-2009 Valerio Proietti, <http://mad4milk.net/>

io.util.Options = {
	
	options: {},
	
	setOption: function(key, value){
		io.util.Object.merge(this.options, key, value);
		return this;
	},
	
	setOptions: function(options){
		for (var key in options) this.setOption(key, options[key]);
		if (this.addEvent){
			for (var i in this.options){
				if (!(/^on[A-Z]/).test(i) || typeof this.options[i] != 'function') return;
				this.addEvent(i, this.options[i]);
				this.options[i] = null;
			}
		} 
		return this;
	}
	
};
// Based on Mixin.js from MooTools (MIT)
// Copyright (c) 2006-2009 Valerio Proietti, <http://mad4milk.net/>

io.util.Events = (function(){
	var array = io.util.Array,

	eventsOf = function(object, type){
		type = type.replace(/^on([A-Z])/, function(full, first){
			return first.toLowerCase();
		});
		var events = object.$events;
		return events[type] || (events[type] = []);
	},

	removeEventsOfType = function(object, type){
		array.each(eventsOf(object, type), function(fn){
			object.removeEvent(type, fn);
		});
	};

	return {
		$events: {},

		addEvent: function(type, fn){
			array.include(eventsOf(this, type), fn);
			return this;
		},

		addEvents: function(events){
			for (var name in events) this.addEvent(name, events[name]);
			return this;
		},

		fireEvent: function(type, args){
			args = [].concat(args);
			array.each(eventsOf(this, type), function(fn){
				fn.apply(this, args);
			}, this);
			return this;
		},

		fireEvents: function(){
			for (var i = 0; i < arguments.length; i++) this.fireEvent(arguments[i]);
			return this;
		},

		removeEvent: function(type, fn){
			var events = eventsOf(this, type), index = events.indexOf(fn);
			if (index != -1) delete events[index];

			return this;
		},

		removeEvents: function(option){
			if (option === null){
				var events = this.$events;
				for (var type in events) removeEventsOfType(this, type);
			} else {
				switch (typeof option){
					case 'string': removeEventsOfType(this, option); break;
					case 'object': for (var name in option) this.removeEvent(name, option[name]); break;
				}
			}  		
			return this;
		}
	};
})();
// Based on JSON.js from MooTools (MIT)
// Copyright (c) 2006-2009 Valerio Proietti, <http://mad4milk.net/>

(function(){

	var array = io.util.Array,
	special = {'\b': '\\b', '\t': '\\t', '\n': '\\n', '\f': '\\f', '\r': '\\r', '"' : '\\"', '\\': '\\\\'},    
	json = io.util.JSON = {},

	escape = function(chr){
		return special[chr] || '\\u' + ('0000' + a.charCodeAt(0).toString(16)).slice(-4);
	},

	isSecure = function(string){
		string = string.replace(/\\(?:["\\\/bfnrt]|u[0-9a-fA-F]{4})/g, '@').
		replace(/"[^"\\\n\r]*"|true|false|null|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?/g, ']').
		replace(/(?:^|:|,)(?:\s*\[)+/g, '');

		return (/^[\],:{}\s]*$/).test(string);
	};

	json.encode = function(obj){
	  if (JSON.stringify) return JSON.stringify(obj);
		if (obj && obj.toJSON) obj = obj.toJSON();

		if (obj === null){
			return 'null';
		}

		if (obj instanceof Array){
			return '[' + array.map(obj, json.encode) + ']';
		}

		switch (typeof obj){
			case 'string':
			return '"' + obj.replace(/[\x00-\x1f\\"]/g, escape) + '"';
			case 'object':
			var string = [];
			for (var key in obj){
				var json = json.encode(obj[key]);
				if (json) string.push(json.encode(key) + ':' + json);
			}
			return '{' + string + '}';
			case 'number': 
			case 'boolean': 
			return '' + obj;
		}

		return null;
	};

	json.decode = function(string, secure){
		if (!string || typeof(string) != 'string') return null;

		if (secure || json.secure){
			if (JSON.parse) return JSON.parse(string);
			if (!isSecure(string)) throw new Error('io.util.JSON could not decode the input; security is enabled and the value is not secure.');
		}

		return eval('(' + string + ')');
	};

})();
// OO - Class - Copyright TJ Holowaychuk <tj@vision-media.ca> (MIT Licensed)
// Based on http://ejohn.org/blog/simple-javascript-inheritance/
// which is based on implementations by Prototype / base2

(function(){

  var global = this, initialize = true
  var referencesSuper = /xyz/.test(function(){ xyz }) ? /\b__super__\b/ : /.*/

  /**
   * Shortcut for ioClass.extend()
   *
   * @param  {hash} props
   * @return {function}
   * @api public
   */

  ioClass = function(props){
    if (this == global)
      return ioClass.extend(props)  
  }
  
  // --- Version
  
  ioClass.version = '1.2.0'
  
  /**
   * Create a new ioClass.
   *
   *   User = ioClass({
   *     init: function(name){
   *       this.name = name
   *     }
   *   })
   *
   * ioClasses may be subioClassed using the .extend() method, and
   * the associated superioClass method via this.__super__().
   *
   *   Admin = User.extend({
   *     init: function(name, password) {
   *       this.__super__(name)
   *       // or this.__super__.apply(this, arguments)
   *       this.password = password
   *     }
   *   })
   *
   * @param  {hash} props
   * @return {function}
   * @api public
   */
  
  ioClass.extend = function(props) {
    var __super__ = this.prototype
    
    initialize = false
    var prototype = new this
    initialize = true

    function ioClass() {
      if (initialize && this.init)
        this.init.apply(this, arguments)
    }
    
    function extend(props) {
      for (var key in props)
        if (props.hasOwnProperty(key))
          ioClass[key] = props[key]
    }
    
    ioClass.include = function(props) {
      for (var name in props)
        if (name == 'include')
          if (props[name] instanceof Array)
            for (var i = 0, len = props[name].length; i < len; ++i)
              ioClass.include(props[name][i])
          else
            ioClass.include(props[name])
        else if (name == 'extend')
          if (props[name] instanceof Array)
            for (var i = 0, len = props[name].length; i < len; ++i)
              extend(props[name][i])
          else
            extend(props[name])
        else if (props.hasOwnProperty(name))
          prototype[name] = 
            typeof props[name] == 'function' &&
            typeof __super__[name] == 'function' &&
            referencesSuper.test(props[name]) ?
              (function(name, fn){
                return function() {
                  this.__super__ = __super__[name]
                  return fn.apply(this, arguments)
                }
              })(name, props[name])
            : props[name]
    }
    
    ioClass.include(props)
    ioClass.prototype = prototype
    ioClass.constructor = ioClass
    ioClass.extend = arguments.callee
    
    return ioClass
  }

})();
/**
 * Socket.IO client
 * 
 * @author Guillermo Rauch <guillermo@rosepad.com>
 * @license The MIT license.
 * @copyright Copyright (c) 2009 RosePad <dev@rosepad.com>
 */

(function(){
	
	var json = io.util.JSON;
	
	// abstract
	io.Transport = ioClass({

		include: [io.util.Events, io.util.Options],

		init: function(base, options){
			this.base = base;
			this.setOptions(options);
		},

		send: function(){
			throw new Error('Missing send() implementation');  
		},

		connect: function(){
			throw new Error('Missing connect() implementation');  
		},

		disconnect: function(){
			throw new Error('Missing disconnect() implementation');  
		},

		_onData: function(data){
			try {
				var msgs = json.decode(data);
			} catch(e){}
			if (msgs && msgs.messages){
			  for (var i = 0, l = msgs.messages.length; i < l; i++){
					this._onMessage(msgs.messages[i]);	
				}
			}
		},

		_onMessage: function(message){
			if (!('sessionid' in this)){
				try {
					var obj = json.decode(message);
				} catch(e){}
				if (obj && obj.sessionid){
					this.sessionid = obj.sessionid;
					this._onConnect();
				}				
			} else {	
				this.base._onMessage(message);
			}		
		},

		_onConnect: function(){
			this.connected = true;
			this.base._onConnect();
		},

		_onDisconnect: function(){
			if (!this.connected) return;
			this.connected = false;
			this.base._onDisconnect();
		},

		_prepareUrl: function(){
			return (this.base.options.secure ? 'https' : 'http') 
				+ '://' + this.base.host 
				+ ':' + this.base.options.port
				+ '/' + this.base.options.resource
				+ '/' + this.type
				+ (this.sessionid ? ('/' + this.sessionid) : '');
		}

	});
	
})();
/**
 * Socket.IO client
 * 
 * @author Guillermo Rauch <guillermo@rosepad.com>
 * @license The MIT license.
 * @copyright Copyright (c) 2009 RosePad <dev@rosepad.com>
 */

(function(){
  
	var empty = new Function;

	io.Transport.XHR = io.Transport.extend({

		connect: function(){
			this._get();
		},

		send: function(data){
			this._sendXhr = this._request('send', 'POST');
			this._sendXhr.send('data=' + encodeURIComponent(data));
		},

		disconnect: function(){
			if (this._xhr){
				this._xhr.onreadystatechange = empty;
				this._xhr.abort();
			}            
			if (this._sendXhr) this._sendXhr.abort();
			this._onClose();
			this._onDisconnect();
		},

		_request: function(url, method, multipart){
			var req = request();
			if (multipart) req.multipart = true;
			req.open(method || 'GET', this._prepareUrl() + (url ? '/' + url : ''));
			if (method == 'POST'){
				req.setRequestHeader('Content-type', 'application/x-www-form-urlencoded; charset=utf-8');
			}
			return req;
		}

	});

	var request = io.Transport.XHR.request = function(){
		if ('XMLHttpRequest' in window) return new XMLHttpRequest();

		try {
			var a = new ActiveXObject('MSXML2.XMLHTTP');
			return a;
		} catch(e){}

		try {
			var b = new ActiveXObject('Microsoft.XMLHTTP');
			return b;      
		} catch(e){}

		return false;
	};

	io.Transport.XHR.check = function(){
		try {
			if (request()) return true;
		} catch(e){}
		return false;
	};

})();
/**
 * Socket.IO client
 * 
 * @author Guillermo Rauch <guillermo@rosepad.com>
 * @license The MIT license.
 * @copyright Copyright (c) 2009 RosePad <dev@rosepad.com>
 */

io.Transport.websocket = io.Transport.extend({

	type: 'websocket',

	connect: function(){
		var self = this;
		this.socket = new WebSocket(this._prepareUrl());
		this.socket.onmessage = function(ev){ self._onData(ev.data); };
		this.socket.onclose = function(ev){ self._onClose(); };
		return this;      
	},

	send: function(data){
		this.socket.send(data);
		return this;
	},

	disconnect: function(){
		this.socket.close();
		return this;      
	},

	_onClose: function(){
		this._onDisconnect();
	},

	_prepareUrl: function(){
		return (this.base.options.secure ? 'wss' : 'ws') 
		+ '://' + this.base.host 
		+ ':' + this.base.options.port
		+ '/' + this.base.options.resource
		+ '/' + this.type
		+ (this.sessionid ? ('/' + this.sessionid) : '');
	}

});

io.Transport.websocket.check = function(){
	// we make sure WebSocket is not confounded with a previously loaded flash WebSocket
	return 'WebSocket' in window && !('__initialize' in WebSocket);
};
/**
 * Socket.IO client
 * 
 * @author Guillermo Rauch <guillermo@rosepad.com>
 * @license The MIT license.
 * @copyright Copyright (c) 2009 RosePad <dev@rosepad.com>
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
  
	if ('navigator' in window && navigator.plugins){
		return !! navigator.plugins['Shockwave Flash'].description;
	} 

	if ('ActiveXObject' in window){
		try {
			return !! new ActiveXObject('ShockwaveFlash.ShockwaveFlash').GetVariable('$version');
		} catch (e){}      
	}

	return false;
};
/**
 * Socket.IO client
 * 
 * @author Guillermo Rauch <guillermo@rosepad.com>
 * @license The MIT license.
 * @copyright Copyright (c) 2009 RosePad <dev@rosepad.com>
 */

(function(){  
	var empty = new Function, request = io.Transport.XHR.request;

	io.Transport['htmlfile'] = io.Transport.extend({

		type: 'htmlfile',

		connect: function(){
			var self = this;

			this._doc = new ActiveXObject("htmlfile");
			this._doc.open();
			this._doc.write('<html><script>document.domain="'+ document.domain +'"</script></html>');
			this._doc.close();      

			this.iframe = this.doc.createElement('div');
			this._doc.body.appendChild(iframe);
			iframe.innerHTML = '<iframe src="'+ this._prepareUrl() +'"></iframe>';

			this.doc.parentWindow.callback = function(data){ self._onData(data); };      
			window.attachEvent('onunload', function(){ self._destroy(); });
		},

		send: function(data){      
			this._sendXhr = request();
			this._sendXhr.open('POST', this._prepareUrl() + '/send');      
			this._sendXhr.setRequestHeader('Content-type', 'application/x-www-form-urlencoded; charset=utf-8');        
			this._sendXhr.send('data=' + encodeURIComponent(data));
		},

		disconnect: function(){
			this._destroy();
			if (this._sendXhr) this._sendXhr.abort();	
			this._onClose();
			this._onDisconnect();
		},

		_destroy: function(){
			this._doc = null;
			CollectGarbage();
		},

		_onData: function(ev){
			console.log(ev.data);
		}

	});

	io.Transport['htmlfile'].check = function(){
		return false; // temporary to trigger xhr-polling in IE until testing is complete
		if ('ActiveXObject' in window){
			try {
				var a = new ActiveXObject('htmlfile');
				return true;
			} catch(e){}
		}
		return false;
	};

})();
/**
 * Socket.IO client
 * 
 * @author Guillermo Rauch <guillermo@rosepad.com>
 * @license The MIT license.
 * @copyright Copyright (c) 2009 RosePad <dev@rosepad.com>
 */

// only Opera's implementation

(function(){  
	var empty = new Function, request = io.Transport.XHR.request;

	io.Transport['server-events'] = io.Transport.extend({

		type: 'server-events',

		connect: function(){
			var self = this;
			this.source = document.createElement('event-source');
			this.source.setAttribute('src', this._prepareUrl());
			this.source.addEventListener('socket.io', function(ev){ self_onData(ev.data); }, false);
		},

		send: function(data){      
			this._sendXhr = request();
			this._sendXhr.open('POST', this._prepareUrl() + '/send');
			this._sendXhr.setRequestHeader('Content-type', 'application/x-www-form-urlencoded; charset=utf-8');
			this._sendXhr.send('data=' + encodeURIComponent(data));
		},

		disconnect: function(){
			this.source.removeEventSource(this.source.getAttribute('src'));
			this.source.setAttribute('src', '');
			this.source = null;
			if (this._sendXhr) this._sendXhr.abort();
			this._onDisconnect();
		},

		_onData: function(data){
			this._onMessage(data);
		}

	});

	io.Transport['server-events'].check = function(){
		return 'addEventStream' in window;
	};

})();
/**
 * Socket.IO client
 * 
 * @author Guillermo Rauch <guillermo@rosepad.com>
 * @license The MIT license.
 * @copyright Copyright (c) 2009 RosePad <dev@rosepad.com>
 */

io.Transport['xhr-multipart'] = io.Transport.XHR.extend({

	type: 'xhr-multipart',

	connect: function(){
		var self = this;
		this._xhr = this._request('', 'GET', true);
		this._xhr.onreadystatechange = function(){
			if (self._xhr.readyState == 3) self._onData(self._xhr.responseText);
		};
		this._xhr.send();
	}

});

io.Transport['xhr-multipart'].check = function(){
	return 'XMLHttpRequest' in window && 'multipart' in XMLHttpRequest.prototype;
};
/**
 * Socket.IO client
 * 
 * @author Guillermo Rauch <guillermo@rosepad.com>
 * @license The MIT license.
 * @copyright Copyright (c) 2009 RosePad <dev@rosepad.com>
 */

(function(){

	var empty = new Function();

	io.Transport['xhr-polling'] = io.Transport.XHR.extend({

		type: 'xhr-polling',

		connect: function(){
			var self = this;
			this._xhr = this._request('', 'GET');
			this._xhr.onreadystatechange = function(){
				if (self._xhr.status == 200 && self._xhr.readyState == 4){
					if (self._xhr.responseText.length) self._onData(self._xhr.responseText);
					self._xhr.onreadystatechange = empty;
					self.connect();
				}
			};
			this._xhr.send();
		}

	});

	io.Transport['xhr-polling'].check = function(){
		return io.Transport.XHR.check();
	};

})();
/**
 * Socket.IO client
 * 
 * @author Guillermo Rauch <guillermo@rosepad.com>
 * @license The MIT license.
 * @copyright Copyright (c) 2009 RosePad <dev@rosepad.com>
 */

(function(){
  
  var json = io.util.JSON;
  
  io.Socket = ioClass({

  	include: [io.util.Events, io.util.Options],

  	options: {
  		secure: false,
  		document: document,
  		port: document.location.port || 80,
  		resource: 'socket.io',
  		transports: ['websocket', 'server-events', 'flashsocket', 'htmlfile', 'xhr-multipart', 'xhr-polling'],
  		transportOptions: {},
  		rememberTransport: true
  	},

  	init: function(host, options){
  		this.host = host || document.domain;
  		this.setOptions(options);
  		this.connected = false;
  		this.connecting = false;
  		this.transport = this.getTransport();
  		if (!this.transport && 'console' in window) console.error('No transport available');
  	},

  	getTransport: function(){
  		var transports = this.options.transports, match;
  		if (this.options.rememberTransport){
  			match = this.options.document.cookie.match('(?:^|;)\\s*socket\.io=([^;]*)');
  			if (match) transports = [decodeURIComponent(match[1])];
  		} 
  		for (var i = 0; transport = transports[i]; i++){
  			if (io.Transport[transport] && io.Transport[transport].check()){
  				return new io.Transport[transport](this, this.options.transportOptions[transport] || {});
  			}
  		}
  		return null;
  	},

  	connect: function(){
  		if (this.transport && !this.connected && !this.connecting){
  			this.connecting = true;
  			this.transport.connect();
  		}      
  		return this;
  	},

  	send: function(data){
  		if (!this.transport || !this.transport.connected) return this._queue(data);
  		this.transport.send(json.encode([data]));
  		return this;
  	},

  	disconnect: function(){
  		this.transport.disconnect();
  		return this;
  	},

  	_queue: function(message){
  		if (!('_queueStack' in this)) this._queueStack = [];
  		this._queueStack.push(message);
  		return this;
  	},

  	_doQueue: function(){    
  		if (!('_queueStack' in this) || !this._queueStack.length) return this;
  		this.transport.send(json.encode([].concat(this._queueStack)));
  		this._queueStack = [];
  		return this;
  	},

  	_onConnect: function(){
  		this.connected = true;
  		this.connecting = false;
  		this._doQueue();
  		if (this.options.rememberTransport) this.options.document.cookie = 'socket.io=' + encodeURIComponent(this.transport.type);
  		this.fireEvent('connect');
  	},

  	_onMessage: function(data){
  		this.fireEvent('message', data);
  	},

  	_onDisconnect: function(){
  		this.fireEvent('disconnect');
  	}

  });
  
})();
/*	SWFObject v2.2 <http://code.google.com/p/swfobject/> 
	is released under the MIT License <http://www.opensource.org/licenses/mit-license.php> 
*/
var swfobject=function(){var D="undefined",r="object",S="Shockwave Flash",W="ShockwaveFlash.ShockwaveFlash",q="application/x-shockwave-flash",R="SWFObjectExprInst",x="onreadystatechange",O=window,j=document,t=navigator,T=false,U=[h],o=[],N=[],I=[],l,Q,E,B,J=false,a=false,n,G,m=true,M=function(){var aa=typeof j.getElementById!=D&&typeof j.getElementsByTagName!=D&&typeof j.createElement!=D,ah=t.userAgent.toLowerCase(),Y=t.platform.toLowerCase(),ae=Y?/win/.test(Y):/win/.test(ah),ac=Y?/mac/.test(Y):/mac/.test(ah),af=/webkit/.test(ah)?parseFloat(ah.replace(/^.*webkit\/(\d+(\.\d+)?).*$/,"$1")):false,X=!+"\v1",ag=[0,0,0],ab=null;if(typeof t.plugins!=D&&typeof t.plugins[S]==r){ab=t.plugins[S].description;if(ab&&!(typeof t.mimeTypes!=D&&t.mimeTypes[q]&&!t.mimeTypes[q].enabledPlugin)){T=true;X=false;ab=ab.replace(/^.*\s+(\S+\s+\S+$)/,"$1");ag[0]=parseInt(ab.replace(/^(.*)\..*$/,"$1"),10);ag[1]=parseInt(ab.replace(/^.*\.(.*)\s.*$/,"$1"),10);ag[2]=/[a-zA-Z]/.test(ab)?parseInt(ab.replace(/^.*[a-zA-Z]+(.*)$/,"$1"),10):0}}else{if(typeof O.ActiveXObject!=D){try{var ad=new ActiveXObject(W);if(ad){ab=ad.GetVariable("$version");if(ab){X=true;ab=ab.split(" ")[1].split(",");ag=[parseInt(ab[0],10),parseInt(ab[1],10),parseInt(ab[2],10)]}}}catch(Z){}}}return{w3:aa,pv:ag,wk:af,ie:X,win:ae,mac:ac}}(),k=function(){if(!M.w3){return}if((typeof j.readyState!=D&&j.readyState=="complete")||(typeof j.readyState==D&&(j.getElementsByTagName("body")[0]||j.body))){f()}if(!J){if(typeof j.addEventListener!=D){j.addEventListener("DOMContentLoaded",f,false)}if(M.ie&&M.win){j.attachEvent(x,function(){if(j.readyState=="complete"){j.detachEvent(x,arguments.callee);f()}});if(O==top){(function(){if(J){return}try{j.documentElement.doScroll("left")}catch(X){setTimeout(arguments.callee,0);return}f()})()}}if(M.wk){(function(){if(J){return}if(!/loaded|complete/.test(j.readyState)){setTimeout(arguments.callee,0);return}f()})()}s(f)}}();function f(){if(J){return}try{var Z=j.getElementsByTagName("body")[0].appendChild(C("span"));Z.parentNode.removeChild(Z)}catch(aa){return}J=true;var X=U.length;for(var Y=0;Y<X;Y++){U[Y]()}}function K(X){if(J){X()}else{U[U.length]=X}}function s(Y){if(typeof O.addEventListener!=D){O.addEventListener("load",Y,false)}else{if(typeof j.addEventListener!=D){j.addEventListener("load",Y,false)}else{if(typeof O.attachEvent!=D){i(O,"onload",Y)}else{if(typeof O.onload=="function"){var X=O.onload;O.onload=function(){X();Y()}}else{O.onload=Y}}}}}function h(){if(T){V()}else{H()}}function V(){var X=j.getElementsByTagName("body")[0];var aa=C(r);aa.setAttribute("type",q);var Z=X.appendChild(aa);if(Z){var Y=0;(function(){if(typeof Z.GetVariable!=D){var ab=Z.GetVariable("$version");if(ab){ab=ab.split(" ")[1].split(",");M.pv=[parseInt(ab[0],10),parseInt(ab[1],10),parseInt(ab[2],10)]}}else{if(Y<10){Y++;setTimeout(arguments.callee,10);return}}X.removeChild(aa);Z=null;H()})()}else{H()}}function H(){var ag=o.length;if(ag>0){for(var af=0;af<ag;af++){var Y=o[af].id;var ab=o[af].callbackFn;var aa={success:false,id:Y};if(M.pv[0]>0){var ae=c(Y);if(ae){if(F(o[af].swfVersion)&&!(M.wk&&M.wk<312)){w(Y,true);if(ab){aa.success=true;aa.ref=z(Y);ab(aa)}}else{if(o[af].expressInstall&&A()){var ai={};ai.data=o[af].expressInstall;ai.width=ae.getAttribute("width")||"0";ai.height=ae.getAttribute("height")||"0";if(ae.getAttribute("class")){ai.styleclass=ae.getAttribute("class")}if(ae.getAttribute("align")){ai.align=ae.getAttribute("align")}var ah={};var X=ae.getElementsByTagName("param");var ac=X.length;for(var ad=0;ad<ac;ad++){if(X[ad].getAttribute("name").toLowerCase()!="movie"){ah[X[ad].getAttribute("name")]=X[ad].getAttribute("value")}}P(ai,ah,Y,ab)}else{p(ae);if(ab){ab(aa)}}}}}else{w(Y,true);if(ab){var Z=z(Y);if(Z&&typeof Z.SetVariable!=D){aa.success=true;aa.ref=Z}ab(aa)}}}}}function z(aa){var X=null;var Y=c(aa);if(Y&&Y.nodeName=="OBJECT"){if(typeof Y.SetVariable!=D){X=Y}else{var Z=Y.getElementsByTagName(r)[0];if(Z){X=Z}}}return X}function A(){return !a&&F("6.0.65")&&(M.win||M.mac)&&!(M.wk&&M.wk<312)}function P(aa,ab,X,Z){a=true;E=Z||null;B={success:false,id:X};var ae=c(X);if(ae){if(ae.nodeName=="OBJECT"){l=g(ae);Q=null}else{l=ae;Q=X}aa.id=R;if(typeof aa.width==D||(!/%$/.test(aa.width)&&parseInt(aa.width,10)<310)){aa.width="310"}if(typeof aa.height==D||(!/%$/.test(aa.height)&&parseInt(aa.height,10)<137)){aa.height="137"}j.title=j.title.slice(0,47)+" - Flash Player Installation";var ad=M.ie&&M.win?"ActiveX":"PlugIn",ac="MMredirectURL="+O.location.toString().replace(/&/g,"%26")+"&MMplayerType="+ad+"&MMdoctitle="+j.title;if(typeof ab.flashvars!=D){ab.flashvars+="&"+ac}else{ab.flashvars=ac}if(M.ie&&M.win&&ae.readyState!=4){var Y=C("div");X+="SWFObjectNew";Y.setAttribute("id",X);ae.parentNode.insertBefore(Y,ae);ae.style.display="none";(function(){if(ae.readyState==4){ae.parentNode.removeChild(ae)}else{setTimeout(arguments.callee,10)}})()}u(aa,ab,X)}}function p(Y){if(M.ie&&M.win&&Y.readyState!=4){var X=C("div");Y.parentNode.insertBefore(X,Y);X.parentNode.replaceChild(g(Y),X);Y.style.display="none";(function(){if(Y.readyState==4){Y.parentNode.removeChild(Y)}else{setTimeout(arguments.callee,10)}})()}else{Y.parentNode.replaceChild(g(Y),Y)}}function g(ab){var aa=C("div");if(M.win&&M.ie){aa.innerHTML=ab.innerHTML}else{var Y=ab.getElementsByTagName(r)[0];if(Y){var ad=Y.childNodes;if(ad){var X=ad.length;for(var Z=0;Z<X;Z++){if(!(ad[Z].nodeType==1&&ad[Z].nodeName=="PARAM")&&!(ad[Z].nodeType==8)){aa.appendChild(ad[Z].cloneNode(true))}}}}}return aa}function u(ai,ag,Y){var X,aa=c(Y);if(M.wk&&M.wk<312){return X}if(aa){if(typeof ai.id==D){ai.id=Y}if(M.ie&&M.win){var ah="";for(var ae in ai){if(ai[ae]!=Object.prototype[ae]){if(ae.toLowerCase()=="data"){ag.movie=ai[ae]}else{if(ae.toLowerCase()=="styleclass"){ah+=' class="'+ai[ae]+'"'}else{if(ae.toLowerCase()!="classid"){ah+=" "+ae+'="'+ai[ae]+'"'}}}}}var af="";for(var ad in ag){if(ag[ad]!=Object.prototype[ad]){af+='<param name="'+ad+'" value="'+ag[ad]+'" />'}}aa.outerHTML='<object classid="clsid:D27CDB6E-AE6D-11cf-96B8-444553540000"'+ah+">"+af+"</object>";N[N.length]=ai.id;X=c(ai.id)}else{var Z=C(r);Z.setAttribute("type",q);for(var ac in ai){if(ai[ac]!=Object.prototype[ac]){if(ac.toLowerCase()=="styleclass"){Z.setAttribute("class",ai[ac])}else{if(ac.toLowerCase()!="classid"){Z.setAttribute(ac,ai[ac])}}}}for(var ab in ag){if(ag[ab]!=Object.prototype[ab]&&ab.toLowerCase()!="movie"){e(Z,ab,ag[ab])}}aa.parentNode.replaceChild(Z,aa);X=Z}}return X}function e(Z,X,Y){var aa=C("param");aa.setAttribute("name",X);aa.setAttribute("value",Y);Z.appendChild(aa)}function y(Y){var X=c(Y);if(X&&X.nodeName=="OBJECT"){if(M.ie&&M.win){X.style.display="none";(function(){if(X.readyState==4){b(Y)}else{setTimeout(arguments.callee,10)}})()}else{X.parentNode.removeChild(X)}}}function b(Z){var Y=c(Z);if(Y){for(var X in Y){if(typeof Y[X]=="function"){Y[X]=null}}Y.parentNode.removeChild(Y)}}function c(Z){var X=null;try{X=j.getElementById(Z)}catch(Y){}return X}function C(X){return j.createElement(X)}function i(Z,X,Y){Z.attachEvent(X,Y);I[I.length]=[Z,X,Y]}function F(Z){var Y=M.pv,X=Z.split(".");X[0]=parseInt(X[0],10);X[1]=parseInt(X[1],10)||0;X[2]=parseInt(X[2],10)||0;return(Y[0]>X[0]||(Y[0]==X[0]&&Y[1]>X[1])||(Y[0]==X[0]&&Y[1]==X[1]&&Y[2]>=X[2]))?true:false}function v(ac,Y,ad,ab){if(M.ie&&M.mac){return}var aa=j.getElementsByTagName("head")[0];if(!aa){return}var X=(ad&&typeof ad=="string")?ad:"screen";if(ab){n=null;G=null}if(!n||G!=X){var Z=C("style");Z.setAttribute("type","text/css");Z.setAttribute("media",X);n=aa.appendChild(Z);if(M.ie&&M.win&&typeof j.styleSheets!=D&&j.styleSheets.length>0){n=j.styleSheets[j.styleSheets.length-1]}G=X}if(M.ie&&M.win){if(n&&typeof n.addRule==r){n.addRule(ac,Y)}}else{if(n&&typeof j.createTextNode!=D){n.appendChild(j.createTextNode(ac+" {"+Y+"}"))}}}function w(Z,X){if(!m){return}var Y=X?"visible":"hidden";if(J&&c(Z)){c(Z).style.visibility=Y}else{v("#"+Z,"visibility:"+Y)}}function L(Y){var Z=/[\\\"<>\.;]/;var X=Z.exec(Y)!=null;return X&&typeof encodeURIComponent!=D?encodeURIComponent(Y):Y}var d=function(){if(M.ie&&M.win){window.attachEvent("onunload",function(){var ac=I.length;for(var ab=0;ab<ac;ab++){I[ab][0].detachEvent(I[ab][1],I[ab][2])}var Z=N.length;for(var aa=0;aa<Z;aa++){y(N[aa])}for(var Y in M){M[Y]=null}M=null;for(var X in swfobject){swfobject[X]=null}swfobject=null})}}();return{registerObject:function(ab,X,aa,Z){if(M.w3&&ab&&X){var Y={};Y.id=ab;Y.swfVersion=X;Y.expressInstall=aa;Y.callbackFn=Z;o[o.length]=Y;w(ab,false)}else{if(Z){Z({success:false,id:ab})}}},getObjectById:function(X){if(M.w3){return z(X)}},embedSWF:function(ab,ah,ae,ag,Y,aa,Z,ad,af,ac){var X={success:false,id:ah};if(M.w3&&!(M.wk&&M.wk<312)&&ab&&ah&&ae&&ag&&Y){w(ah,false);K(function(){ae+="";ag+="";var aj={};if(af&&typeof af===r){for(var al in af){aj[al]=af[al]}}aj.data=ab;aj.width=ae;aj.height=ag;var am={};if(ad&&typeof ad===r){for(var ak in ad){am[ak]=ad[ak]}}if(Z&&typeof Z===r){for(var ai in Z){if(typeof am.flashvars!=D){am.flashvars+="&"+ai+"="+Z[ai]}else{am.flashvars=ai+"="+Z[ai]}}}if(F(Y)){var an=u(aj,am,ah);if(aj.id==ah){w(ah,true)}X.success=true;X.ref=an}else{if(aa&&A()){aj.data=aa;P(aj,am,ah,ac);return}else{w(ah,true)}}if(ac){ac(X)}})}else{if(ac){ac(X)}}},switchOffAutoHideShow:function(){m=false},ua:M,getFlashPlayerVersion:function(){return{major:M.pv[0],minor:M.pv[1],release:M.pv[2]}},hasFlashPlayerVersion:F,createSWF:function(Z,Y,X){if(M.w3){return u(Z,Y,X)}else{return undefined}},showExpressInstall:function(Z,aa,X,Y){if(M.w3&&A()){P(Z,aa,X,Y)}},removeSWF:function(X){if(M.w3){y(X)}},createCSS:function(aa,Z,Y,X){if(M.w3){v(aa,Z,Y,X)}},addDomLoadEvent:K,addLoadEvent:s,getQueryParamValue:function(aa){var Z=j.location.search||j.location.hash;if(Z){if(/\?/.test(Z)){Z=Z.split("?")[1]}if(aa==null){return L(Z)}var Y=Z.split("&");for(var X=0;X<Y.length;X++){if(Y[X].substring(0,Y[X].indexOf("="))==aa){return L(Y[X].substring((Y[X].indexOf("=")+1)))}}}return""},expressInstallCallback:function(){if(a){var X=c(R);if(X&&l){X.parentNode.replaceChild(l,X);if(Q){w(Q,true);if(M.ie&&M.win){l.style.display="block"}}if(E){E(B)}}a=false}}}}();
/*
/*
Copyright 2006 Adobe Systems Incorporated

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"),
to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense,
and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

 The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.


THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE
OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

*/


/*
 * The Bridge class, responsible for navigating AS instances
 */
function FABridge(target,bridgeName)
{
    this.target = target;
    this.remoteTypeCache = {};
    this.remoteInstanceCache = {};
    this.remoteFunctionCache = {};
    this.localFunctionCache = {};
    this.bridgeID = FABridge.nextBridgeID++;
    this.name = bridgeName;
    this.nextLocalFuncID = 0;
    FABridge.instances[this.name] = this;
    FABridge.idMap[this.bridgeID] = this;

    return this;
}

// type codes for packed values
FABridge.TYPE_ASINSTANCE =  1;
FABridge.TYPE_ASFUNCTION =  2;

FABridge.TYPE_JSFUNCTION =  3;
FABridge.TYPE_ANONYMOUS =   4;

FABridge.initCallbacks = {};
FABridge.userTypes = {};

FABridge.addToUserTypes = function()
{
	for (var i = 0; i < arguments.length; i++)
	{
		FABridge.userTypes[arguments[i]] = {
			'typeName': arguments[i], 
			'enriched': false
		};
	}
}

FABridge.argsToArray = function(args)
{
    var result = [];
    for (var i = 0; i < args.length; i++)
    {
        result[i] = args[i];
    }
    return result;
}

function instanceFactory(objID)
{
    this.fb_instance_id = objID;
    return this;
}

function FABridge__invokeJSFunction(args)
{  
    var funcID = args[0];
    var throughArgs = args.concat();//FABridge.argsToArray(arguments);
    throughArgs.shift();
   
    var bridge = FABridge.extractBridgeFromID(funcID);
    return bridge.invokeLocalFunction(funcID, throughArgs);
}

FABridge.addInitializationCallback = function(bridgeName, callback)
{
    var inst = FABridge.instances[bridgeName];
    if (inst != undefined)
    {
        callback.call(inst);
        return;
    }

    var callbackList = FABridge.initCallbacks[bridgeName];
    if(callbackList == null)
    {
        FABridge.initCallbacks[bridgeName] = callbackList = [];
    }

    callbackList.push(callback);
}

// updated for changes to SWFObject2
function FABridge__bridgeInitialized(bridgeName) {
    var objects = document.getElementsByTagName("object");
    var ol = objects.length;
    var activeObjects = [];
    if (ol > 0) {
		for (var i = 0; i < ol; i++) {
			if (typeof objects[i].SetVariable != "undefined") {
				activeObjects[activeObjects.length] = objects[i];
			}
		}
	}
    var embeds = document.getElementsByTagName("embed");
    var el = embeds.length;
    var activeEmbeds = [];
    if (el > 0) {
		for (var j = 0; j < el; j++) {
			if (typeof embeds[j].SetVariable != "undefined") {
            	activeEmbeds[activeEmbeds.length] = embeds[j];
            }
        }
    }
    var aol = activeObjects.length;
    var ael = activeEmbeds.length;
    var searchStr = "bridgeName="+ bridgeName;
    if ((aol == 1 && !ael) || (aol == 1 && ael == 1)) {
    	FABridge.attachBridge(activeObjects[0], bridgeName);	 
    }
    else if (ael == 1 && !aol) {
    	FABridge.attachBridge(activeEmbeds[0], bridgeName);
        }
    else {
                var flash_found = false;
		if (aol > 1) {
			for (var k = 0; k < aol; k++) {
				 var params = activeObjects[k].childNodes;
				 for (var l = 0; l < params.length; l++) {
					var param = params[l];
					if (param.nodeType == 1 && param.tagName.toLowerCase() == "param" && param["name"].toLowerCase() == "flashvars" && param["value"].indexOf(searchStr) >= 0) {
						FABridge.attachBridge(activeObjects[k], bridgeName);
                            flash_found = true;
                            break;
                        }
                    }
                if (flash_found) {
                    break;
                }
            }
        }
		if (!flash_found && ael > 1) {
			for (var m = 0; m < ael; m++) {
				var flashVars = activeEmbeds[m].attributes.getNamedItem("flashVars").nodeValue;
				if (flashVars.indexOf(searchStr) >= 0) {
					FABridge.attachBridge(activeEmbeds[m], bridgeName);
					break;
    }
            }
        }
    }
    return true;
}

// used to track multiple bridge instances, since callbacks from AS are global across the page.

FABridge.nextBridgeID = 0;
FABridge.instances = {};
FABridge.idMap = {};
FABridge.refCount = 0;

FABridge.extractBridgeFromID = function(id)
{
    var bridgeID = (id >> 16);
    return FABridge.idMap[bridgeID];
}

FABridge.attachBridge = function(instance, bridgeName)
{
    var newBridgeInstance = new FABridge(instance, bridgeName);

    FABridge[bridgeName] = newBridgeInstance;

/*  FABridge[bridgeName] = function() {
        return newBridgeInstance.root();
    }
*/
    var callbacks = FABridge.initCallbacks[bridgeName];
    if (callbacks == null)
    {
        return;
    }
    for (var i = 0; i < callbacks.length; i++)
    {
        callbacks[i].call(newBridgeInstance);
    }
    delete FABridge.initCallbacks[bridgeName]
}

// some methods can't be proxied.  You can use the explicit get,set, and call methods if necessary.

FABridge.blockedMethods =
{
    toString: true,
    get: true,
    set: true,
    call: true
};

FABridge.prototype =
{


// bootstrapping

    root: function()
    {
        return this.deserialize(this.target.getRoot());
    },
//clears all of the AS objects in the cache maps
    releaseASObjects: function()
    {
        return this.target.releaseASObjects();
    },
//clears a specific object in AS from the type maps
    releaseNamedASObject: function(value)
    {
        if(typeof(value) != "object")
        {
            return false;
        }
        else
        {
            var ret =  this.target.releaseNamedASObject(value.fb_instance_id);
            return ret;
        }
    },
//create a new AS Object
    create: function(className)
    {
        return this.deserialize(this.target.create(className));
    },


    // utilities

    makeID: function(token)
    {
        return (this.bridgeID << 16) + token;
    },


    // low level access to the flash object

//get a named property from an AS object
    getPropertyFromAS: function(objRef, propName)
    {
        if (FABridge.refCount > 0)
        {
            throw new Error("You are trying to call recursively into the Flash Player which is not allowed. In most cases the JavaScript setTimeout function, can be used as a workaround.");
        }
        else
        {
            FABridge.refCount++;
            retVal = this.target.getPropFromAS(objRef, propName);
            retVal = this.handleError(retVal);
            FABridge.refCount--;
            return retVal;
        }
    },
//set a named property on an AS object
    setPropertyInAS: function(objRef,propName, value)
    {
        if (FABridge.refCount > 0)
        {
            throw new Error("You are trying to call recursively into the Flash Player which is not allowed. In most cases the JavaScript setTimeout function, can be used as a workaround.");
        }
        else
        {
            FABridge.refCount++;
            retVal = this.target.setPropInAS(objRef,propName, this.serialize(value));
            retVal = this.handleError(retVal);
            FABridge.refCount--;
            return retVal;
        }
    },

//call an AS function
    callASFunction: function(funcID, args)
    {
        if (FABridge.refCount > 0)
        {
            throw new Error("You are trying to call recursively into the Flash Player which is not allowed. In most cases the JavaScript setTimeout function, can be used as a workaround.");
        }
        else
        {
            FABridge.refCount++;
            retVal = this.target.invokeASFunction(funcID, this.serialize(args));
            retVal = this.handleError(retVal);
            FABridge.refCount--;
            return retVal;
        }
    },
//call a method on an AS object
    callASMethod: function(objID, funcName, args)
    {
        if (FABridge.refCount > 0)
        {
            throw new Error("You are trying to call recursively into the Flash Player which is not allowed. In most cases the JavaScript setTimeout function, can be used as a workaround.");
        }
        else
        {
            FABridge.refCount++;
            args = this.serialize(args);
            retVal = this.target.invokeASMethod(objID, funcName, args);
            retVal = this.handleError(retVal);
            FABridge.refCount--;
            return retVal;
        }
    },

    // responders to remote calls from flash

    //callback from flash that executes a local JS function
    //used mostly when setting js functions as callbacks on events
    invokeLocalFunction: function(funcID, args)
    {
        var result;
        var func = this.localFunctionCache[funcID];

        if(func != undefined)
        {
            result = this.serialize(func.apply(null, this.deserialize(args)));
        }

        return result;
    },

    // Object Types and Proxies
	
    // accepts an object reference, returns a type object matching the obj reference.
    getTypeFromName: function(objTypeName)
    {
        return this.remoteTypeCache[objTypeName];
    },
    //create an AS proxy for the given object ID and type
    createProxy: function(objID, typeName)
    {
        var objType = this.getTypeFromName(typeName);
	        instanceFactory.prototype = objType;
	        var instance = new instanceFactory(objID);
        this.remoteInstanceCache[objID] = instance;
        return instance;
    },
    //return the proxy associated with the given object ID
    getProxy: function(objID)
    {
        return this.remoteInstanceCache[objID];
    },

    // accepts a type structure, returns a constructed type
    addTypeDataToCache: function(typeData)
    {
        newType = new ASProxy(this, typeData.name);
        var accessors = typeData.accessors;
        for (var i = 0; i < accessors.length; i++)
        {
            this.addPropertyToType(newType, accessors[i]);
        }

        var methods = typeData.methods;
        for (var i = 0; i < methods.length; i++)
        {
            if (FABridge.blockedMethods[methods[i]] == undefined)
            {
                this.addMethodToType(newType, methods[i]);
            }
        }


        this.remoteTypeCache[newType.typeName] = newType;
        return newType;
    },

    //add a property to a typename; used to define the properties that can be called on an AS proxied object
    addPropertyToType: function(ty, propName)
    {
        var c = propName.charAt(0);
        var setterName;
        var getterName;
        if(c >= "a" && c <= "z")
        {
            getterName = "get" + c.toUpperCase() + propName.substr(1);
            setterName = "set" + c.toUpperCase() + propName.substr(1);
        }
        else
        {
            getterName = "get" + propName;
            setterName = "set" + propName;
        }
        ty[setterName] = function(val)
        {
            this.bridge.setPropertyInAS(this.fb_instance_id, propName, val);
        }
        ty[getterName] = function()
        {
            return this.bridge.deserialize(this.bridge.getPropertyFromAS(this.fb_instance_id, propName));
        }
    },

    //add a method to a typename; used to define the methods that can be callefd on an AS proxied object
    addMethodToType: function(ty, methodName)
    {
        ty[methodName] = function()
        {
            return this.bridge.deserialize(this.bridge.callASMethod(this.fb_instance_id, methodName, FABridge.argsToArray(arguments)));
        }
    },

    // Function Proxies

    //returns the AS proxy for the specified function ID
    getFunctionProxy: function(funcID)
    {
        var bridge = this;
        if (this.remoteFunctionCache[funcID] == null)
        {
            this.remoteFunctionCache[funcID] = function()
            {
                bridge.callASFunction(funcID, FABridge.argsToArray(arguments));
            }
        }
        return this.remoteFunctionCache[funcID];
    },
    
    //reutrns the ID of the given function; if it doesnt exist it is created and added to the local cache
    getFunctionID: function(func)
    {
        if (func.__bridge_id__ == undefined)
        {
            func.__bridge_id__ = this.makeID(this.nextLocalFuncID++);
            this.localFunctionCache[func.__bridge_id__] = func;
        }
        return func.__bridge_id__;
    },

    // serialization / deserialization

    serialize: function(value)
    {
        var result = {};

        var t = typeof(value);
        //primitives are kept as such
        if (t == "number" || t == "string" || t == "boolean" || t == null || t == undefined)
        {
            result = value;
        }
        else if (value instanceof Array)
        {
            //arrays are serializesd recursively
            result = [];
            for (var i = 0; i < value.length; i++)
            {
                result[i] = this.serialize(value[i]);
            }
        }
        else if (t == "function")
        {
            //js functions are assigned an ID and stored in the local cache 
            result.type = FABridge.TYPE_JSFUNCTION;
            result.value = this.getFunctionID(value);
        }
        else if (value instanceof ASProxy)
        {
            result.type = FABridge.TYPE_ASINSTANCE;
            result.value = value.fb_instance_id;
        }
        else
        {
            result.type = FABridge.TYPE_ANONYMOUS;
            result.value = value;
        }

        return result;
    },

    //on deserialization we always check the return for the specific error code that is used to marshall NPE's into JS errors
    // the unpacking is done by returning the value on each pachet for objects/arrays 
    deserialize: function(packedValue)
    {

        var result;

        var t = typeof(packedValue);
        if (t == "number" || t == "string" || t == "boolean" || packedValue == null || packedValue == undefined)
        {
            result = this.handleError(packedValue);
        }
        else if (packedValue instanceof Array)
        {
            result = [];
            for (var i = 0; i < packedValue.length; i++)
            {
                result[i] = this.deserialize(packedValue[i]);
            }
        }
        else if (t == "object")
        {
            for(var i = 0; i < packedValue.newTypes.length; i++)
            {
                this.addTypeDataToCache(packedValue.newTypes[i]);
            }
            for (var aRefID in packedValue.newRefs)
            {
                this.createProxy(aRefID, packedValue.newRefs[aRefID]);
            }
            if (packedValue.type == FABridge.TYPE_PRIMITIVE)
            {
                result = packedValue.value;
            }
            else if (packedValue.type == FABridge.TYPE_ASFUNCTION)
            {
                result = this.getFunctionProxy(packedValue.value);
            }
            else if (packedValue.type == FABridge.TYPE_ASINSTANCE)
            {
                result = this.getProxy(packedValue.value);
            }
            else if (packedValue.type == FABridge.TYPE_ANONYMOUS)
            {
                result = packedValue.value;
            }
        }
        return result;
    },
    //increases the reference count for the given object
    addRef: function(obj)
    {
        this.target.incRef(obj.fb_instance_id);
    },
    //decrease the reference count for the given object and release it if needed
    release:function(obj)
    {
        this.target.releaseRef(obj.fb_instance_id);
    },

    // check the given value for the components of the hard-coded error code : __FLASHERROR
    // used to marshall NPE's into flash
    
    handleError: function(value)
    {
        if (typeof(value)=="string" && value.indexOf("__FLASHERROR")==0)
        {
            var myErrorMessage = value.split("||");
            if(FABridge.refCount > 0 )
            {
                FABridge.refCount--;
            }
            throw new Error(myErrorMessage[1]);
            return value;
        }
        else
        {
            return value;
        }   
    }
};

// The root ASProxy class that facades a flash object

ASProxy = function(bridge, typeName)
{
    this.bridge = bridge;
    this.typeName = typeName;
    return this;
};
//methods available on each ASProxy object
ASProxy.prototype =
{
    get: function(propName)
    {
        return this.bridge.deserialize(this.bridge.getPropertyFromAS(this.fb_instance_id, propName));
    },

    set: function(propName, value)
    {
        this.bridge.setPropertyInAS(this.fb_instance_id, propName, value);
    },

    call: function(funcName, args)
    {
        this.bridge.callASMethod(this.fb_instance_id, funcName, args);
    }, 
    
    addRef: function() {
        this.bridge.addRef(this);
    }, 
    
    release: function() {
        this.bridge.release(this);
    }
};

// Copyright: Hiroshi Ichikawa <http://gimite.net/en/>
// Lincense: New BSD Lincense
// Reference: http://dev.w3.org/html5/websockets/
// Reference: http://tools.ietf.org/html/draft-hixie-thewebsocketprotocol

if (!window.WebSocket) {

  if (!window.console) console = {log: function(){ }, error: function(){ }};

  WebSocket = function(url, protocol, proxyHost, proxyPort, headers) {
    var self = this;
    self.readyState = WebSocket.CONNECTING;
    self.bufferedAmount = 0;
    WebSocket.__addTask(function() {
      self.__flash =
        WebSocket.__flash.create(url, protocol, proxyHost || null, proxyPort || 0, headers || null);

      self.__flash.addEventListener("open", function(fe) {
        try {
          if (self.onopen) self.onopen();
        } catch (e) {
          console.error(e.toString());
        }
      });

      self.__flash.addEventListener("close", function(fe) {
        try {
          if (self.onopen) self.onclose();
        } catch (e) {
          console.error(e.toString());
        }
      });

      self.__flash.addEventListener("message", function(fe) {
        var data = decodeURIComponent(fe.getData());
        try {
          if (self.onmessage) {
            var e;
            if (window.MessageEvent) {
              e = document.createEvent("MessageEvent");
              e.initMessageEvent("message", false, false, data, null, null, window);
            } else { // IE
              e = {data: data};
            }
            self.onmessage(e);
          }
        } catch (e) {
          console.error(e.toString());
        }
      });

      self.__flash.addEventListener("stateChange", function(fe) {
        try {
          self.readyState = fe.getReadyState();
          self.bufferedAmount = fe.getBufferedAmount();
        } catch (e) {
          console.error(e.toString());
        }
      });

      //console.log("[WebSocket] Flash object is ready");
    });
  }

  WebSocket.prototype.send = function(data) {
    if (!this.__flash || this.readyState == WebSocket.CONNECTING) {
      throw "INVALID_STATE_ERR: Web Socket connection has not been established";
    }
    var result = this.__flash.send(data);
    if (result < 0) { // success
      return true;
    } else {
      this.bufferedAmount = result;
      return false;
    }
  };

  WebSocket.prototype.close = function() {
    if (!this.__flash) return;
    if (this.readyState != WebSocket.OPEN) return;
    this.__flash.close();
    // Sets/calls them manually here because Flash WebSocketConnection.close cannot fire events
    // which causes weird error:
    // > You are trying to call recursively into the Flash Player which is not allowed.
    this.readyState = WebSocket.CLOSED;
    if (this.onclose) this.onclose();
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
        this['on' + type] = WebSocket_FireEvent(this, type);
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
   *
   * @param {object} object
   * @param {string} type
   */
  function WebSocket_FireEvent(object, type) {
    return function(data) {
      var event = new WebSocketEvent();
      event.initEvent(type, true, true);
      event.target = event.currentTarget = object;
      for (var key in data) {
        event[key] = data[key];
      }
      object.dispatchEvent(event, arguments);
    };
  }

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


  WebSocket.CONNECTING = 0;
  WebSocket.OPEN = 1;
  WebSocket.CLOSED = 2;

  WebSocket.__tasks = [];

  WebSocket.__initialize = function() {
    if (!WebSocket.__swfLocation) {
      console.error("[WebSocket] set WebSocket.__swfLocation to location of WebSocketMain.swf");
      return;
    }
    var container = document.createElement("div");
    container.id = "webSocketContainer";
    // Puts the Flash out of the window. Note that we cannot use display: none or visibility: hidden
    // here because it prevents Flash from loading at least in IE.
    container.style.position = "absolute";
    container.style.left = "-100px";
    container.style.top = "-100px";
    var holder = document.createElement("div");
    holder.id = "webSocketFlash";
    container.appendChild(holder);
    document.body.appendChild(container);
    swfobject.embedSWF(
      WebSocket.__swfLocation, "webSocketFlash", "10", "10", "9.0.0",
      null, {bridgeName: "webSocket"}, null, null,
      function(e) {
        if (!e.success) console.error("[WebSocket] swfobject.embedSWF failed");
      }
    );
    FABridge.addInitializationCallback("webSocket", function() {
      try {
        //console.log("[WebSocket] FABridge initializad");
        WebSocket.__flash = FABridge.webSocket.root();
        WebSocket.__flash.setCallerUrl(location.href);
        for (var i = 0; i < WebSocket.__tasks.length; ++i) {
          WebSocket.__tasks[i]();
        }
        WebSocket.__tasks = [];
      } catch (e) {
        console.error("[WebSocket] " + e.toString());
      }
    });
  };

  WebSocket.__addTask = function(task) {
    if (WebSocket.__flash) {
      task();
    } else {
      WebSocket.__tasks.push(task);
    }
  }

  // called from Flash
  function webSocketLog(message) {
    console.log(decodeURIComponent(message));
  }

  // called from Flash
  function webSocketError(message) {
    console.error(decodeURIComponent(message));
  }

  if (window.addEventListener) {
    window.addEventListener("load", WebSocket.__initialize, false);
  } else {
    window.attachEvent("onload", WebSocket.__initialize);
  }
}

