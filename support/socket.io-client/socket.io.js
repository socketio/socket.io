/** Socket.IO 0.6.3 - Built with build.js */
/**
 * socket.io-node-client
 * Copyright(c) 2011 LearnBoost <dev@learnboost.com>
 * MIT Licensed
 */

/**
 * @namespace
 */
var io = this.io = {
  
  /**
   * Library version.
   */
  version: '0.6.3',
  
  /**
   * Updates the location of the WebSocketMain.swf file that is required for the Flashsocket transport.
   * This should only be needed if you want to load in the WebSocketMainInsecure.swf or if you want to
   * host the .swf file on a other server.
   *
   * @static
   * @deprecated Set the variable `WEB_SOCKET_SWF_LOCATION` pointing to WebSocketMain.swf
   * @param {String} path The path of the .swf file
   * @api public
   */
  setPath: function(path){
    if (window.console && console.error) console.error('io.setPath will be removed. Please set the variable WEB_SOCKET_SWF_LOCATION pointing to WebSocketMain.swf');
    this.path = /\/$/.test(path) ? path : path + '/';
    WEB_SOCKET_SWF_LOCATION = path + 'lib/vendor/web-socket-js/WebSocketMain.swf';
  }
};

/**
 * Expose Socket.IO in jQuery
 */
if ('jQuery' in this) jQuery.io = this.io;

/**
 * Default path to the .swf file.
 */
if (typeof window != 'undefined'){
  // WEB_SOCKET_SWF_LOCATION = (document.location.protocol == 'https:' ? 'https:' : 'http:') + '//cdn.socket.io/' + this.io.version + '/WebSocketMain.swf';
  if (typeof WEB_SOCKET_SWF_LOCATION === 'undefined')
    WEB_SOCKET_SWF_LOCATION = '/socket.io/lib/vendor/web-socket-js/WebSocketMain.swf';
}

/**
 * socket.io-node-client
 * Copyright(c) 2011 LearnBoost <dev@learnboost.com>
 * MIT Licensed
 */

(function(){
  var io = this.io,
  
  /**
   * Set when the `onload` event is executed on the page. This variable is used by
   * `io.util.load` to detect if we need to execute the function immediately or add
   * it to a onload listener.
   *
   * @type {Boolean}
   * @api private
   */
  pageLoaded = false;
  
  /**
   * @namespace
   */
  io.util = {
    /**
     * Executes the given function when the page is loaded.
     *
     * Example:
     *
     *     io.util.load(function(){ console.log('page loaded') });
     *
     * @param {Function} fn
     * @api public
     */
    load: function(fn){
      if (/loaded|complete/.test(document.readyState) || pageLoaded) return fn();
      if ('attachEvent' in window){
        window.attachEvent('onload', fn);
      } else {
        window.addEventListener('load', fn, false);
      }
    },
    
    /**
     * Defers the function untill it's the function can be executed without
     * blocking the load process. This is especially needed for WebKit based
     * browsers. If a long running connection is made before the onload event
     * a loading indicator spinner will be present at all times untill a
     * reconnect has been made.
     *
     * @param {Function} fn
     * @api public
     */
    defer: function(fn){
      if (!io.util.webkit) return fn();
      io.util.load(function(){
        setTimeout(fn,100);
      });
    },
    
    /**
     * Inherit the prototype methods from one constructor into another.
     *
     * Example:
     *
     *     function foo(){};
     *     foo.prototype.hello = function(){ console.log( this.words )};
     *     
     *     function bar(){
     *       this.words = "Hello world";
     *     };
     *     
     *     io.util.inherit(bar,foo);
     *     var person = new bar();
     *     person.hello();
     *     // => "Hello World"
     *
     * @param {Constructor} ctor The constructor that needs to inherit the methods.
     * @param {Constructor} superCtor The constructor to inherit from.
     * @api public
     */
    inherit: function(ctor, superCtor){
      // no support for `instanceof` for now
      for (var i in superCtor.prototype){
        ctor.prototype[i] = superCtor.prototype[i];
      }
    },
    
    /**
     * Finds the index of item in a given Array.
     *
     * Example:
     *
     *     var data = ['socket',2,3,4,'socket',5,6,7,'io'];
     *     io.util.indexOf(data,'socket',1);
     *     // => 4
     *
     * @param {Array} arr The array
     * @param item The item that we need to find
     * @param {Integer} from Starting point
     * @api public
     */
    indexOf: function(arr, item, from){
      for (var l = arr.length, i = (from < 0) ? Math.max(0, l + from) : from || 0; i < l; i++){
        if (arr[i] === item) return i;
      }
      return -1;
    },
    
    /**
     * Checks if the given object is an Array.
     *
     * Example:
     *
     *     io.util.isArray([]);
     *     // => true
     *     io.util.isArray({});
     *    // => false
     *
     * @param obj
     * @api public
     */
    isArray: function(obj){
      return Object.prototype.toString.call(obj) === '[object Array]';
    },
    
    /**
     * Merges the properties of two objects.
     *
     * Example:
     *
     *     var a = {foo:'bar'}
     *       , b = {bar:'baz'};
     *     
     *     io.util.merge(a,b);
     *     // => {foo:'bar',bar:'baz'}
     *
     * @param {Object} target The object that receives the keys
     * @param {Object} additional The object that supplies the keys
     * @api public
     */
    merge: function(target, additional){
      for (var i in additional)
        if (additional.hasOwnProperty(i))
          target[i] = additional[i];
    }
  };
  
  /**
   * Detect the Webkit platform based on the userAgent string.
   * This includes Mobile Webkit.
   *
   * @type {Boolean}
   * @api public
   */
  io.util.webkit = /webkit/i.test(navigator.userAgent);
  
  io.util.load(function(){
    pageLoaded = true;
  });

})();
/**
 * socket.io-node-client
 * Copyright(c) 2011 LearnBoost <dev@learnboost.com>
 * MIT Licensed
 */

(function(){
  var io = this.io,
  
  /**
   * Message frame for encoding and decoding responses from the Socket.IO server.
   *
   * @const
   * @type {String}
   */
  frame = '~m~',
  
  /**
   * Transforms the message to a string. If the message is an {Object} we will convert it to
   * a string and prefix it with the `~j~` flag to indicate that message is JSON encoded.
   *
   * Example:
   *
   *     stringify({foo:"bar"});
   *     // => "~j~{"foo":"bar"}"
   *
   * @param {String|Array|Object} message The messages that needs to be transformed to a string.
   * @throws {Error} When the JSON.stringify implementation is missing in the browser.
   * @returns {String} Message.
   * @api private
   */
  stringify = function(message){
    if (Object.prototype.toString.call(message) == '[object Object]'){
      if (!('JSON' in window)){
        var error = 'Socket.IO Error: Trying to encode as JSON, but JSON.stringify is missing.';
        if ('console' in window && console.error){
          console.error(error);
        } else {
          throw new Error(error);
        }
        return '{ "$error": "'+ error +'" }';
      }
      return '~j~' + JSON.stringify(message);
    } else {
      return String(message);
    }
  },
  
  /**
   * This is the transport template for all supported transport methods. It provides the
   * basic functionality to create a working transport for Socket.IO.
   *
   * Options:
   *   - `timeout`  Transport shutdown timeout in milliseconds, based on the heartbeat interval.
   *
   * Example:
   *
   *     var transport = io.Transport.mytransport = function(){
   *       io.Transport.apply(this, arguments);
   *     };
   *     io.util.inherit(transport, io.Transport);
   *     
   *     ... // more code here
   *     
   *     // connect with your new transport
   *     var socket = new io.Socket(null,{transports:['mytransport']});
   *
   * @constructor
   * @param {Object} base The reference to io.Socket.
   * @param {Object} options The transport options.
   * @property {io.Socket|Object} base The reference to io.Socket.
   * @property {Object} options The transport options, these are used to overwrite the default options
   * @property {String} sessionid The sessionid of the established connection, this is only available a connection is established
   * @property {Boolean} connected The connection has been established.
   * @property {Boolean} connecting We are still connecting to the server.
   * @api public
   */
  Transport = io.Transport = function(base, options){
    this.base = base;
    this.options = {
      timeout: 15000 // based on heartbeat interval default
    };
    io.util.merge(this.options, options);
  };

  /**
   * Send the message to the connected Socket.IO server.
   *
   * @throws {Error} When the io.Transport is inherited, it should override this method.
   * @api public
   */
  Transport.prototype.send = function(){
    throw new Error('Missing send() implementation');
  };
  
  /**
   * Establish a connection with the Socket.IO server..
   *
   * @throws {Error} When the io.Transport is inherited, it should override this method.
   * @api public
   */
  Transport.prototype.connect = function(){
    throw new Error('Missing connect() implementation');
  };

  /**
   * Disconnect the established connection.
   *
   * @throws {Error} When the io.Transport is inherited, it should override this method.
   * @api private
   */
  Transport.prototype.disconnect = function(){
    throw new Error('Missing disconnect() implementation');
  };
  
  /**
   * Encode the message by adding the `frame` to each message. This allows
   * the client so send multiple messages with only one request.
   *
   * @param {String|Array} messages Messages that need to be encoded.
   * @returns {String} Encoded message.
   * @api private
   */
  Transport.prototype.encode = function(messages){
    var ret = '', message;
    messages = io.util.isArray(messages) ? messages : [messages];
    for (var i = 0, l = messages.length; i < l; i++){
      message = messages[i] === null || messages[i] === undefined ? '' : stringify(messages[i]);
      ret += frame + message.length + frame + message;
    }
    return ret;
  };
  
  /**
   * Decoded the response from the Socket.IO server, as the server could send multiple
   * messages in one response.
   *
   * @param (String} data The response from the server that requires decoding
   * @returns {Array} Decoded messages.
   * @api private
   */
  Transport.prototype.decode = function(data){
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
  
  /**
   * Handles the response from the server. When a new response is received
   * it will automatically update the timeout, decode the message and
   * forwards the response to the onMessage function for further processing.
   *
   * @param {String} data Response from the server.
   * @api private
   */
  Transport.prototype.onData = function(data){
    this.setTimeout();
    var msgs = this.decode(data);
    if (msgs && msgs.length){
      for (var i = 0, l = msgs.length; i < l; i++){
        this.onMessage(msgs[i]);
      }
    }
  };
  
  /**
   * All the transports have a dedicated timeout to detect if
   * the connection is still alive. We clear the existing timer
   * and set new one each time this function is called. When the
   * timeout does occur it will call the `onTimeout` method.
   *
   * @api private
   */
  Transport.prototype.setTimeout = function(){
    var self = this;
    if (this.timeout) clearTimeout(this.timeout);
    this.timeout = setTimeout(function(){
      self.onTimeout();
    }, this.options.timeout);
  };
  
  /**
   * Disconnect from the Socket.IO server when a timeout occurs.
   * 
   * @api private
   */
  Transport.prototype.onTimeout = function(){
    this.onDisconnect();
  };
  
  /**
   * After the response from the server has been parsed to individual
   * messages we need to decode them using the the Socket.IO message
   * protocol: <https://github.com/learnboost/socket.io-node/>.
   *
   * When a message is received we check if a session id has been set,
   * if the session id is missing we can assume that the received message
   * contains the sessionid of the connection.
   
   * When a message is prefixed with `~h~` we dispatch it our heartbeat
   * processing method `onHeartbeat` with the content of the heartbeat.
   *
   * When the message is prefixed with `~j~` we can assume that the contents
   * of the message is JSON encoded, so we parse the message and notify
   * the base of the new message.
   *
   * If none of the above, we consider it just a plain text message and
   * notify the base of the new message.
   *
   * @param {String} message A decoded message from the server.
   * @api private
   */
  Transport.prototype.onMessage = function(message){
    if (!this.sessionid){
      this.sessionid = message;
      this.onConnect();
    } else if (message.substr(0, 3) == '~h~'){
      this.onHeartbeat(message.substr(3));
    } else if (message.substr(0, 3) == '~j~'){
      this.base.onMessage(JSON.parse(message.substr(3)));
    } else {
      this.base.onMessage(message);
    }
  },
  
  /**
   * Send the received heartbeat message back to server. So the server
   * knows we are still connected.
   *
   * @param {String} heartbeat Heartbeat response from the server.
   * @api private
   */
  Transport.prototype.onHeartbeat = function(heartbeat){
    this.send('~h~' + heartbeat); // echo
  };
  
  /**
   * Notifies the base when a connection to the Socket.IO server has
   * been established. And it starts the connection `timeout` timer.
   *
   * @api private
   */
  Transport.prototype.onConnect = function(){
    this.connected = true;
    this.connecting = false;
    this.base.onConnect();
    this.setTimeout();
  };
  
  /**
   * Notifies the base when the connection with the Socket.IO server
   * has been disconnected.
   *
   * @api private
   */
  Transport.prototype.onDisconnect = function(){
    this.connecting = false;
    this.connected = false;
    this.sessionid = null;
    this.base.onDisconnect();
  };
  
  /**
   * Generates a connection url based on the Socket.IO URL Protocol.
   * See <https://github.com/learnboost/socket.io-node/> for more details.
   *
   * @returns {String} Connection url
   * @api private
   */
  Transport.prototype.prepareUrl = function(){
    return (this.base.options.secure ? 'https' : 'http') 
      + '://' + this.base.host 
      + ':' + this.base.options.port
      + '/' + this.base.options.resource
      + '/' + this.type
      + (this.sessionid ? ('/' + this.sessionid) : '/');
  };

})();
/**
 * socket.io-node-client
 * Copyright(c) 2011 LearnBoost <dev@learnboost.com>
 * MIT Licensed
 */

(function(){
  var io = this.io,
  
  /**
   * A small stub function that will be used to reduce memory leaks.
   *
   * @type {Function}
   * @api private
   */
  empty = new Function,
  
  /**
   * We preform a small feature detection to see if `Cross Origin Resource Sharing`
   * is supported in the `XMLHttpRequest` object, so we can use it for cross domain requests.
   *
   * @type {Boolean}
   * @api private
   */ 
  XMLHttpRequestCORS = (function(){
    if (!('XMLHttpRequest' in window)) return false;
    // CORS feature detection
    var a = new XMLHttpRequest();
    return a.withCredentials != undefined;
  })(),
  
  /**
   * Generates the correct `XMLHttpRequest` for regular and cross domain requests.
   *
   * @param {Boolean} [xdomain] Create a request that can be used cross domain.
   * @returns {XMLHttpRequest|false} If we can create a XMLHttpRequest we will return that.
   * @api private
   */
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
  
  /**
   * This is the base for XHR based transports, the `XHR-Polling` and the `XHR-multipart` 
   * transports will extend this class.
   *
   * @constructor
   * @extends {io.Transport}
   * @property {Array} sendBuffer Used to queue up messages so they can be send as one request.
   * @api public
   */
  XHR = io.Transport.XHR = function(){
    io.Transport.apply(this, arguments);
    this.sendBuffer = [];
  };
  
  io.util.inherit(XHR, io.Transport);
  
  /**
   * Establish a connection
   *
   * @returns {Transport}
   * @api public
   */
  XHR.prototype.connect = function(){
    this.get();
    return this;
  };
  
  /**
   * Check if we need to send data to the Socket.IO server, if we have data in our buffer
   * we encode it and forward it to the sendIORequest method.
   *
   * @api private
   */
  XHR.prototype.checkSend = function(){
    if (!this.posting && this.sendBuffer.length){
      var encoded = this.encode(this.sendBuffer);
      this.sendBuffer = [];
      this.sendIORequest(encoded);
    }
  };
  
  /**
   * Send data to the Socket.IO server.
   *
   * @param data The message
   * @returns {Transport}
   * @api public
   */
  XHR.prototype.send = function(data){
    if (io.util.isArray(data)){
      this.sendBuffer.push.apply(this.sendBuffer, data);
    } else {
      this.sendBuffer.push(data);
    }
    this.checkSend();
    return this;
  };
  
  /**
   * Posts a encoded message to the Socket.IO server.
   *
   * @param {String} data A encoded message.
   * @api private
   */
  XHR.prototype.sendIORequest = function(data){
    var self = this;
    this.posting = true;
    this.sendXHR = this.request('send', 'POST');
    this.sendXHR.onreadystatechange = function(){
      var status;
      if (self.sendXHR.readyState == 4){
        self.sendXHR.onreadystatechange = empty;
        try { status = self.sendXHR.status; } catch(e){}
        self.posting = false;
        if (status == 200){
          self.checkSend();
        } else {
          self.onDisconnect();
        }
      }
    };
    this.sendXHR.send('data=' + encodeURIComponent(data));
  };
  
  /**
   * Disconnect the established connection.
   *
   * @returns {Transport}.
   * @api public
   */
  XHR.prototype.disconnect = function(){
    // send disconnection signal
    this.onDisconnect();
    return this;
  };
  
  /**
   * Handle the disconnect request.
   *
   * @api private
   */
  XHR.prototype.onDisconnect = function(){
    if (this.xhr){
      this.xhr.onreadystatechange = empty;
      try {
        this.xhr.abort();
      } catch(e){}
      this.xhr = null;
    }
    if (this.sendXHR){
      this.sendXHR.onreadystatechange = empty;
      try {
        this.sendXHR.abort();
      } catch(e){}
      this.sendXHR = null;
    }
    this.sendBuffer = [];
    io.Transport.prototype.onDisconnect.call(this);
  };
  
  /**
   * Generates a configured XHR request
   *
   * @param {String} url The url that needs to be requested.
   * @param {String} method The method the request should use.
   * @param {Boolean} multipart Do a multipart XHR request
   * @returns {XMLHttpRequest}
   * @api private
   */
  XHR.prototype.request = function(url, method, multipart){
    var req = request(this.base.isXDomain());
    if (multipart) req.multipart = true;
    req.open(method || 'GET', this.prepareUrl() + (url ? '/' + url : ''));
    if (method == 'POST' && 'setRequestHeader' in req){
      req.setRequestHeader('Content-type', 'application/x-www-form-urlencoded; charset=utf-8');
    }
    return req;
  };
  
  /**
   * Check if the XHR transports are supported
   *
   * @param {Boolean} xdomain Check if we support cross domain requests.
   * @returns {Boolean}
   * @api public
   */
  XHR.check = function(xdomain){
    try {
      if (request(xdomain)) return true;
    } catch(e){}
    return false;
  };
  
  /**
   * Check if the XHR transport supports corss domain requests.
   * 
   * @returns {Boolean}
   * @api public
   */
  XHR.xdomainCheck = function(){
    return XHR.check(true);
  };
  
  XHR.request = request;
  
})();

/**
 * socket.io-node-client
 * Copyright(c) 2011 LearnBoost <dev@learnboost.com>
 * MIT Licensed
 */

(function(){
  var io = this.io,
  
  /**
   * The WebSocket transport uses the HTML5 WebSocket API to establish an persistent
   * connection with the Socket.IO server. This transport will also be inherited by the
   * FlashSocket fallback as it provides a API compatible polyfill for the WebSockets.
   *
   * @constructor
   * @extends {io.Transport}
   * @api public
   */
  WS = io.Transport.websocket = function(){
    io.Transport.apply(this, arguments);
  };
  
  io.util.inherit(WS, io.Transport);
  
  /**
   * The transport type, you use this to identify which transport was chosen.
   *
   * @type {String}
   * @api public
   */
  WS.prototype.type = 'websocket';
  
  /**
   * Initializes a new `WebSocket` connection with the Socket.IO server. We attach
   * all the appropriate listeners to handle the responses from the server.
   *
   * @returns {Transport}
   * @api public
   */
  WS.prototype.connect = function(){
    var self = this;
    this.socket = new WebSocket(this.prepareUrl());
    this.socket.onmessage = function(ev){ self.onData(ev.data); };
    this.socket.onclose = function(ev){ self.onDisconnect(); };
    this.socket.onerror = function(e){ self.onError(e); };
    return this;
  };
  
  /**
   * Send a message to the Socket.IO server. The message will automatically be encoded
   * in the correct message format.
   *
   * @returns {Transport}
   * @api public
   */
  WS.prototype.send = function(data){
    if (this.socket) this.socket.send(this.encode(data));
    return this;
  };
  
  /**
   * Disconnect the established `WebSocket` connection.
   *
   * @returns {Transport}
   * @api public
   */
  WS.prototype.disconnect = function(){
    if (this.socket) this.socket.close();
    return this;
  };
  
  /**
   * Handle the errors that `WebSocket` might be giving when we
   * are attempting to connect or send messages.
   *
   * @param {Error} e The error.
   * @api private
   */
  WS.prototype.onError = function(e){
    this.base.emit('error', [e]);
  };
  
  /**
   * Generate a `WebSocket` compatible URL based on the options
   * the user supplied in our Socket.IO base.
   *
   * @returns {String} Connection url
   * @api private
   */
  WS.prototype.prepareUrl = function(){
    return (this.base.options.secure ? 'wss' : 'ws') 
    + '://' + this.base.host 
    + ':' + this.base.options.port
    + '/' + this.base.options.resource
    + '/' + this.type
    + (this.sessionid ? ('/' + this.sessionid) : '');
  };
  
  /**
   * Checks if the browser has support for native `WebSockets` and that
   * it's not the polyfill created for the FlashSocket transport.
   *
   * @return {Boolean}
   * @api public
   */
  WS.check = function(){
    // we make sure WebSocket is not confounded with a previously loaded flash WebSocket
    return 'WebSocket' in window && WebSocket.prototype && ( WebSocket.prototype.send && !!WebSocket.prototype.send.toString().match(/native/i)) && typeof WebSocket !== "undefined";
  };
  
  /**
   * Check if the `WebSocket` transport support cross domain communications.
   *
   * @returns {Boolean}
   * @api public
   */
  WS.xdomainCheck = function(){
    return true;
  };
  
})();

/**
 * socket.io-node-client
 * Copyright(c) 2011 LearnBoost <dev@learnboost.com>
 * MIT Licensed
 */

(function(){
  var io = this.io,
  
  /**
   * The Flashsocket transport. This is a API wrapper for the HTML5 WebSocket specification.
   * It uses a .swf file to communicate with the server. If you want to serve the .swf file
   * from a other server than where the Socket.IO script is coming from you need to use the
   * insecure version of the .swf. More information about this can be found on the github page.
   *
   * @constructor
   * @extends {io.Transport.websocket}
   * @api public
   */
  Flashsocket = io.Transport.flashsocket = function(){
    io.Transport.websocket.apply(this, arguments);
  };
  
  io.util.inherit(Flashsocket, io.Transport.websocket);
  
  /**
   * The transport type, you use this to identify which transport was chosen.
   *
   * @type {String}
   * @api public
   */
  Flashsocket.prototype.type = 'flashsocket';
  
  /**
   * Disconnect the established `Flashsocket` connection. This is done by adding a new
   * task to the Flashsocket. The rest will be handled off by the `WebSocket` transport.
   *
   * @returns {Transport}
   * @api public
   */
  Flashsocket.prototype.connect = function(){
    var self = this, args = arguments;
    WebSocket.__addTask(function(){
      io.Transport.websocket.prototype.connect.apply(self, args);
    });
    return this;
  };
  
  /**
   * Sends a message to the Socket.IO server. This is done by adding a new
   * task to the Flashsocket. The rest will be handled off by the `WebSocket` transport.
   *
   * @returns {Transport}
   * @api public
   */
  Flashsocket.prototype.send = function(){
    var self = this, args = arguments;
    WebSocket.__addTask(function(){
      io.Transport.websocket.prototype.send.apply(self, args);
    });
    return this;
  };
  
  /**
   * Check if the Flashsocket transport is supported as it requires that the Adobe Flash Player
   * plugin version `10.0.0` or greater is installed. And also check if the polyfill is correctly
   * loaded.
   *
   * @returns {Boolean}
   * @api public
   */
  Flashsocket.check = function(){
    if (typeof WebSocket == 'undefined' || !('__addTask' in WebSocket) || !swfobject) return false;
    return swfobject.hasFlashPlayerVersion("10.0.0");
  };
  
  /**
   * Check if the Flashsocket transport can be used as cross domain / cross origin transport.
   * Because we can't see which type (secure or insecure) of .swf is used we will just return true.
   *
   * @returns {Boolean}
   * @api public
   */
  Flashsocket.xdomainCheck = function(){
    return true;
  };
  
})();
/**
 * socket.io-node-client
 * Copyright(c) 2011 LearnBoost <dev@learnboost.com>
 * MIT Licensed
 */

(function(){
  var io = this.io,
  
  /**
   * The HTMLFile transport creates a `forever iframe` based transport
   * for Internet Explorer. Regular forever iframe implementations will 
   * continuously trigger the browsers buzy indicators. If the forever iframe
   * is created inside a `htmlfile` these indicators will not be trigged.
   *
   * @constructor
   * @extends {io.Transport.XHR}
   * @api public
   */
  HTMLFile = io.Transport.htmlfile = function(){
    io.Transport.XHR.apply(this, arguments);
  };
  
  io.util.inherit(HTMLFile, io.Transport.XHR);
  
  /**
   * The transport type, you use this to identify which transport was chosen.
   *
   * @type {String}
   * @api public
   */
  HTMLFile.prototype.type = 'htmlfile';
  
  /**
   * Starts the HTMLFile data stream for incoming messages. And registers a
   * onunload event listener so the HTMLFile will be destroyed.
   *
   * @api private
   */
  HTMLFile.prototype.get = function(){
    var self = this;
    this.open();
    window.attachEvent('onunload', function(){ self.destroy(); });
  };
  
  /**
   * Creates a new ActiveX `htmlfile` with a forever loading iframe
   * that can be used to listen to messages. Inside the generated
   * `htmlfile` a reference will be made to the HTMLFile transport.
   *
   * @api private
   */
  HTMLFile.prototype.open = function(){
    this.doc = new ActiveXObject('htmlfile');
    this.doc.open();
    this.doc.write('<html></html>');
    this.doc.parentWindow.s = this;
    this.doc.close();
    
    var iframeC = this.doc.createElement('div');
    this.doc.body.appendChild(iframeC);
    this.iframe = this.doc.createElement('iframe');
    iframeC.appendChild(this.iframe);
    this.iframe.src = this.prepareUrl() + '/' + (+ new Date);
  };
  
  /**
   * The Socket.IO server will write script tags inside the forever
   * iframe, this function will be used as callback for the incoming
   * information.
   *
   * @param {String} data The message
   * @param {document} doc Reference to the context
   * @api private
   */
  HTMLFile.prototype._ = function(data, doc){
    this.onData(data);
    var script = doc.getElementsByTagName('script')[0];
    script.parentNode.removeChild(script);
  };
  
  /**
   * Destroy the established connection, iframe and `htmlfile`.
   * And calls the `CollectGarbage` function of Internet Explorer
   * to release the memory.
   *
   * @api private
   */
  HTMLFile.prototype.destroy = function(){
    if (this.iframe){
      try {
        this.iframe.src = 'about:blank';
      } catch(e){}
      this.doc = null;
      CollectGarbage();
    }
  };
  
  /**
   * Disconnects the established connection.
   *
   * @returns {Transport} Chaining.
   * @api public
   */
  HTMLFile.prototype.disconnect = function(){
    this.destroy();
    return io.Transport.XHR.prototype.disconnect.call(this);
  };
  
  /**
   * Checks if the browser supports this transport. The browser
   * must have an `ActiveXObject` implementation.
   *
   * @return {Boolean}
   * @api public
   */
  HTMLFile.check = function(){
    if ('ActiveXObject' in window){
      try {
        var a = new ActiveXObject('htmlfile');
        return a && io.Transport.XHR.check();
      } catch(e){}
    }
    return false;
  };
  
  /**
   * Check if cross domain requests are supported.
   *
   * @returns {Boolean}
   * @api public
   */
  HTMLFile.xdomainCheck = function(){
    // we can probably do handling for sub-domains, we should test that it's cross domain but a subdomain here
    return false;
  };
  
})();
/**
 * socket.io-node-client
 * Copyright(c) 2011 LearnBoost <dev@learnboost.com>
 * MIT Licensed
 */

(function(){
  var io = this.io,
  
  /**
   * The XHR-Multipart transport uses the a multipart XHR connection to
   * stream in the data from the Socket.IO server
   *
   * @constructor
   * @extends {io.Transport.XHR}
   * @api public
   */
  XHRMultipart = io.Transport['xhr-multipart'] = function(){
    io.Transport.XHR.apply(this, arguments);
  };
  
  io.util.inherit(XHRMultipart, io.Transport.XHR);
  
   /**
   * The transport type, you use this to identify which transport was chosen.
   *
   * @type {String}
   * @api public
   */
  XHRMultipart.prototype.type = 'xhr-multipart';
  
  /**
   * Starts the multipart stream for incomming messages.
   *
   * @api private
   */
  XHRMultipart.prototype.get = function(){
    var self = this;
    this.xhr = this.request('', 'GET', true);
    this.xhr.onreadystatechange = function(){
      if (self.xhr.readyState == 4) self.onData(self.xhr.responseText);
    };
    this.xhr.send(null);
  };
  
  /**
   * Checks if browser supports this transport.
   *
   * @return {Boolean}
   * @api public
   */
  XHRMultipart.check = function(){
    return 'XMLHttpRequest' in window && 'prototype' in XMLHttpRequest && 'multipart' in XMLHttpRequest.prototype;
  };
  
  /**
   * Check if cross domain requests are supported.
   *
   * @returns {Boolean}
   * @api public
   */
  XHRMultipart.xdomainCheck = function(){
    return true;
  };
  
})();
/**
 * socket.io-node-client
 * Copyright(c) 2011 LearnBoost <dev@learnboost.com>
 * MIT Licensed
 */

(function(){
  var io = this.io,
  
  /**
   * A small stub function that will be used to reduce memory leaks.
   *
   * @type {Function}
   * @api private
   */
  empty = new Function(),
  
  /**
   * The XHR-polling transport uses long polling XHR requests to create a
   * "persistent" connection with the server.
   *
   * @constructor
   * @extends {io.Transport.XHR}
   * @api public
   */
  XHRPolling = io.Transport['xhr-polling'] = function(){
    io.Transport.XHR.apply(this, arguments);
  };
  
  io.util.inherit(XHRPolling, io.Transport.XHR);
  
  /**
   * The transport type, you use this to identify which transport was chosen.
   *
   * @type {string}
   * @api public
   */
  XHRPolling.prototype.type = 'xhr-polling';
  
  /** 
   * Establish a connection, for iPhone and Android this will be done once the page
   * is loaded.
   *
   * @returns {Transport} Chaining.
   * @api public
   */
  XHRPolling.prototype.connect = function(){
    var self = this;
    io.util.defer(function(){ io.Transport.XHR.prototype.connect.call(self) });
    return false;
  };
  
   /**
   * Starts a XHR request to wait for incoming messages.
   *
   * @api private
   */
  XHRPolling.prototype.get = function(){
    var self = this;
    this.xhr = this.request(+ new Date, 'GET');
    this.xhr.onreadystatechange = function(){
      var status;
      if (self.xhr.readyState == 4){
        self.xhr.onreadystatechange = empty;
        try { status = self.xhr.status; } catch(e){}
        if (status == 200){
          self.onData(self.xhr.responseText);
          self.get();
        } else {
          self.onDisconnect();
        }
      }
    };
    this.xhr.send(null);
  };
  
  /**
   * Checks if browser supports this transport.
   *
   * @return {Boolean}
   * @api public
   */
  XHRPolling.check = function(){
    return io.Transport.XHR.check();
  };
  
  /**
   * Check if cross domain requests are supported
   *
   * @returns {Boolean}
   * @api public
   */
  XHRPolling.xdomainCheck = function(){
    return io.Transport.XHR.xdomainCheck();
  };

})();

/**
 * socket.io-node-client
 * Copyright(c) 2011 LearnBoost <dev@learnboost.com>
 * MIT Licensed
 */

(function(){
  var io = this.io,
  
  /**
   * The JSONP transport creates an persistent connection by dynamically
   * inserting a script tag in the page. This script tag will receive the
   * information of the Socket.IO server. When new information is received
   * it creates a new script tag for the new data stream.
   *
   * @constructor
   * @extends {io.Transport.xhr-polling}
   * @api public
   */
  JSONPPolling = io.Transport['jsonp-polling'] = function(){
    io.Transport.XHR.apply(this, arguments);
    this.insertAt = document.getElementsByTagName('script')[0];
    this.index = io.JSONP.length;
    io.JSONP.push(this);
  };
  
  io.util.inherit(JSONPPolling, io.Transport['xhr-polling']);
  
  /**
   * A list of all JSONPolling transports, this is used for by
   * the Socket.IO server to distribute the callbacks.
   *
   * @type {Array}
   * @api private
   */
  io.JSONP = [];
  
  /**
   * The transport type, you use this to identify which transport was chosen.
   *
   * @type {String}
   * @api public
   */
  JSONPPolling.prototype.type = 'jsonp-polling';
  
  /**
   * Posts a encoded message to the Socket.IO server using an iframe.
   * The iframe is used because script tags can create POST based requests.
   * The iframe is positioned outside of the view so the user does not
   * notice it's existence.
   *
   * @param {String} data A encoded message.
   * @api private
   */
  JSONPPolling.prototype.sendIORequest = function(data){
    var self = this;
    if (!('form' in this)){
      var form = document.createElement('FORM'),
        area = document.createElement('TEXTAREA'),
        id = this.iframeId = 'socket_io_iframe_' + this.index,
        iframe;
  
      form.style.position = 'absolute';
      form.style.top = '-1000px';
      form.style.left = '-1000px';
      form.target = id;
      form.method = 'POST';
      form.action = this.prepareUrl() + '/' + (+new Date) + '/' + this.index;
      area.name = 'data';
      form.appendChild(area);
      this.insertAt.parentNode.insertBefore(form, this.insertAt);
      document.body.appendChild(form);
  
      this.form = form;
      this.area = area;
    }
  
    function complete(){
      initIframe();
      self.posting = false;
      self.checkSend();
    };
  
    function initIframe(){
      if (self.iframe){
        self.form.removeChild(self.iframe);
      }
  
      try {
        // ie6 dynamic iframes with target="" support (thanks Chris Lambacher)
        iframe = document.createElement('<iframe name="'+ self.iframeId +'">');
      } catch(e){
        iframe = document.createElement('iframe');
        iframe.name = self.iframeId;
      }
  
      iframe.id = self.iframeId;
  
      self.form.appendChild(iframe);
      self.iframe = iframe;
    };
  
    initIframe();
  
    this.posting = true;
    this.area.value = data;
  
    try {
      this.form.submit();
    } catch(e){}
  
    if (this.iframe.attachEvent){
      iframe.onreadystatechange = function(){
        if (self.iframe.readyState == 'complete') complete();
      };
    } else {
      this.iframe.onload = complete;
    }
  };
  
  /**
   * Creates a new JSONP poll that can be used to listen
   * for messages from the Socket.IO server.
   *
   * @api private
   */
  JSONPPolling.prototype.get = function(){
    var self = this,
        script = document.createElement('SCRIPT');
    if (this.script){
      this.script.parentNode.removeChild(this.script);
      this.script = null;
    }
    script.async = true;
    script.src = this.prepareUrl() + '/' + (+new Date) + '/' + this.index;
    script.onerror = function(){
      self.onDisconnect();
    };
    this.insertAt.parentNode.insertBefore(script, this.insertAt);
    this.script = script;
  };
  
  /**
   * Callback function for the incoming message stream from the Socket.IO server.
   *
   * @param {String} data The message
   * @param {document} doc Reference to the context
   * @api private
   */
  JSONPPolling.prototype._ = function(){
    this.onData.apply(this, arguments);
    this.get();
    return this;
  };
  
  /**
   * Checks if browser supports this transport.
   *
   * @return {Boolean}
   * @api public
   */
  JSONPPolling.check = function(){
    return true;
  };
  
  /**
   * Check if cross domain requests are supported
   *
   * @returns {Boolean}
   * @api public
   */
  JSONPPolling.xdomainCheck = function(){
    return true;
  };
})();
/**
 * socket.io-node-client
 * Copyright(c) 2011 LearnBoost <dev@learnboost.com>
 * MIT Licensed
 */

(function(){
  var io = this.io;
  
  /**
   * Create a new `Socket.IO client` which can establish a persisted
   * connection with a Socket.IO enabled server.
   *
   * Options:
   *   - `secure`  Use secure connections, defaulting to false.
   *   - `document`  Reference to the document object to retrieve and set cookies, defaulting to document.
   *   - `port`  The port where the Socket.IO server listening on, defaulting to location.port.
   *   - `resource`  The path or namespace on the server where the Socket.IO requests are intercepted, defaulting to 'socket.io'.
   *   - `transports`  A ordered list with the available transports, defaulting to all transports.
   *   - `transportOption`  A {Object} containing the options for each transport. The key of the object should reflect
   *      name of the transport and the value a {Object} with the options.
   *   - `connectTimeout`  The duration in milliseconds that a transport has to establish a working connection, defaulting to 5000.
   *   - `tryTransportsOnConnectTimeout`  Should we attempt other transport methods when the connectTimeout occurs, defaulting to true.
   *   - `reconnect`  Should reconnection happen automatically, defaulting to true.
   *   - `reconnectionDelay`  The delay in milliseconds before we attempt to establish a working connection. This value will
   *      increase automatically using a exponential back off algorithm. Defaulting to 500.
   *   - `maxReconnectionAttempts`  Number of attempts we should make before seizing the reconnect operation, defaulting to 10.
   *   - `rememberTransport` Should the successfully connected transport be remembered in a cookie, defaulting to true.
   *
   * Examples:
   *
   * Create client with the default settings.
   *
   *     var socket = new io.Socket();
   *     socket.connect();
   *     socket.on('message', function(msg){
   *       console.log('Received message: ' + msg );
   *     });
   *     socket.on('connect', function(){
   *       socket.send('Hello from client');
   *     });
   *
   * Create a connection with server on a different port and host.
   *
   *     var socket = new io.Socket('http://example.com',{port:1337});
   *
   * @constructor
   * @exports Socket as io.Socket
   * @param {String} [host] The host where the Socket.IO server is located, it defaults to the host that runs the page.
   * @param {Objects} [options] The options that will configure the Socket.IO client. 
   * @property {String} host The supplied host arguments or the host that page runs.
   * @property {Object} options The passed options combined with the defaults.
   * @property {Boolean} connected Whether the socket is connected or not.
   * @property {Boolean} connecting Whether the socket is connecting or not.
   * @property {Boolean} reconnecting Whether the socket is reconnecting or not.
   * @property {Object} transport The selected transport instance.
   * @api public
   */
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
      tryTransportsOnConnectTimeout: true,
      reconnect: true,
      reconnectionDelay: 500,
      maxReconnectionAttempts: 10,
      rememberTransport: true
    };
    io.util.merge(this.options, options);
    this.connected = false;
    this.connecting = false;
    this.reconnecting = false;
    this.events = {};
    this.transport = this.getTransport();
    if (!this.transport && 'console' in window) console.error('No transport available');
  };
  
  /**
   * Find an available transport based on the options supplied in the constructor. For example if the
   * `rememberTransport` option was set we will only connect with the previous successfully connected transport.
   * The supplied transports can be overruled if the `override` argument is supplied.
   *
   * Example:
   *
   * Override the existing transports.
   *
   *     var socket = new io.Socket();
   *     socket.getTransport(['jsonp-polling','websocket']);
   *     // returns the json-polling transport because it's availabe in all browsers.
   *
   * @param {Array} [override] A ordered list with transports that should be used instead of the options.transports.
   * @returns {Null|Transport} The available transport.
   * @api private
   */
  Socket.prototype.getTransport = function(override){
    var transports = override || this.options.transports, match;
    if (this.options.rememberTransport && !override){
      match = this.options.document.cookie.match('(?:^|;)\\s*socketio=([^;]*)');
      if (match){
        this.rememberedTransport = true;
        transports = [decodeURIComponent(match[1])];
      }
    } 
    for (var i = 0, transport; transport = transports[i]; i++){
      if (io.Transport[transport] 
        && io.Transport[transport].check() 
        && (!this.isXDomain() || io.Transport[transport].xdomainCheck())){
        return new io.Transport[transport](this, this.options.transportOptions[transport] || {});
      }
    }
    return null;
  };
  
  /**
   * Establish a new connection with the Socket.IO server. This is done using the selected transport by the
   * getTransport method. If the `connectTimeout` and the `tryTransportsOnConnectTimeout` options are set
   * the client will keep trying to connect to the server using a different transports when the timeout occurs.
   *
   * Example:
   *
   * Create a Socket.IO client with a connect callback (We assume we have the WebSocket transport avaliable).
   *
   *     var socket = new io.Socket();
   *     socket.connect(function(transport){
   *       console.log("Connected to server using the " + socket.transport.type + " transport.");
   *     });
   *     // => "Connected to server using the WebSocket transport."
   *
   * @param {Function} [fn] Callback.
   * @returns {io.Socket}
   * @api public
   */
  Socket.prototype.connect = function(fn){
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
            if (self.options.tryTransportsOnConnectTimeout && !self.rememberedTransport){
              if(!self.remainingTransports) self.remainingTransports = self.options.transports.slice(0);
              var transports = self.remainingTransports;
              while(transports.length > 0 && transports.splice(0,1)[0] != self.transport.type){}
              if(transports.length){
                self.transport = self.getTransport(transports);
                self.connect();
              }
            }
            if(!self.remainingTransports || self.remainingTransports.length == 0) self.emit('connect_failed');
          }
          if(self.remainingTransports && self.remainingTransports.length == 0) delete self.remainingTransports;
        }, this.options.connectTimeout);
      }
    }
    if (fn && typeof fn == 'function') this.once('connect',fn);
    return this;
  };
  
  /**
   * Sends the data to the Socket.IO server. If there isn't a connection to the server
   * the data will be forwarded to the queue.
   *
   * @param {Mixed} data The data that needs to be send to the Socket.IO server.
   * @returns {io.Socket}
   * @api public
   */
  Socket.prototype.send = function(data){
    if (!this.transport || !this.transport.connected) return this.queue(data);
    this.transport.send(data);
    return this;
  };
  
  /**
   * Disconnect the established connect.
   *
   * @param {Boolean} [soft] A soft disconnect will keep the reconnect settings enabled.
   * @returns {io.Socket}
   * @api public
   */
  Socket.prototype.disconnect = function(soft){
    if (this.connectTimeoutTimer) clearTimeout(this.connectTimeoutTimer);
    if (!soft) this.options.reconnect = false;
    this.transport.disconnect();
    return this;
  };
  
  /**
   * Adds a new eventListener for the given event.
   *
   * Example:
   *
   *     var socket = new io.Socket();
   *     socket.on("connect", function(transport){
   *       console.log("Connected to server using the " + socket.transport.type + " transport.");
   *     });
   *     // => "Connected to server using the WebSocket transport."
   *
   * @param {String} name The name of the event.
   * @param {Function} fn The function that is called once the event is emitted.
   * @returns {io.Socket}
   * @api public
   */
  Socket.prototype.on = function(name, fn){
    if (!(name in this.events)) this.events[name] = [];
    this.events[name].push(fn);
    return this;
  };
  
  /**
   * Adds a one time listener, the listener will be removed after the event is emitted.
   *
   * Example:
   *
   *     var socket = new io.Socket();
   *     socket.once("custom:event", function(){
   *       console.log("I should only log once.");
   *     });
   *     socket.emit("custom:event");
   *     socket.emit("custom:event");
   *     // => "I should only log once."
   *
   * @param {String} name The name of the event.
   * @param {Function} fn The function that is called once the event is emitted.
   * @returns {io.Socket}
   * @api public
   */
  Socket.prototype.once = function(name, fn){
    var self = this
      , once = function(){
        self.removeEvent(name, once);
        fn.apply(self, arguments);
      };
    once.ref = fn;
    self.on(name, once);
    return this;
  };
  
  /**
   * Emit a event to all listeners.
   *
   * Example:
   *
   *     var socket = new io.Socket();
   *     socket.on("custom:event", function(){
   *       console.log("Emitted a custom:event");
   *     });
   *     socket.emit("custom:event");
   *     // => "Emitted a custom:event"
   *
   * @param {String} name The name of the event.
   * @param {Array} args Arguments for the event.
   * @returns {io.Socket}
   * @api private
   */
  Socket.prototype.emit = function(name, args){
    if (name in this.events){
      var events = this.events[name].concat();
      for (var i = 0, ii = events.length; i < ii; i++)
        events[i].apply(this, args === undefined ? [] : args);
    }
    return this;
  };

  /**
   * Removes a event listener from the listener array for the specified event.
   *
   * Example:
   *
   *     var socket = new io.Socket()
   *       , event = function(){};
   *     socket.on("connect", event);
   *     socket.removeEvent("connect", event);
   *
   * @param {String} name The name of the event.
   * @param {Function} fn The function that is called once the event is emitted.
   * @returns {io.Socket}
   * @api public
   */
  Socket.prototype.removeEvent = function(name, fn){
    if (name in this.events){
      for (var a = 0, l = this.events[name].length; a < l; a++)
        if (this.events[name][a] == fn || this.events[name][a].ref && this.events[name][a].ref == fn) this.events[name].splice(a, 1);    
    }
    return this;
  };
  
  /**
   * Queues messages when there isn't a active connection available. Once a connection has been
   * established you should call the `doQueue` method to send the queued messages to the server.
   *
   * @param {Mixed} message The message that was originally send to the `send` method.
   * @returns {io.Socket}
   * @api private
   */
  Socket.prototype.queue = function(message){
    if (!('queueStack' in this)) this.queueStack = [];
    this.queueStack.push(message);
    return this;
  };
  
  /**
   * If there are queued messages we send all messages to the Socket.IO server and empty
   * the queue.
   *
   * @returns {io.Socket}
   * @api private
   */
  Socket.prototype.doQueue = function(){
    if (!('queueStack' in this) || !this.queueStack.length) return this;
    this.transport.send(this.queueStack);
    this.queueStack = [];
    return this;
  };
  
  /**
   * Check if we need to use cross domain enabled transports. Cross domain would
   * be a different port or different domain name.
   *
   * @returns {Boolean}
   * @api private
   */
  Socket.prototype.isXDomain = function(){
    var locPort = window.location.port || 80;
    return this.host !== document.domain || this.options.port != locPort;
  };
  
  /**
   * When the transport established an working connection the Socket.IO server it notifies us
   * by calling this method so we can set the `connected` and `connecting` properties and emit
   * the connection event.
   *
   * @api private
   */
  Socket.prototype.onConnect = function(){
    this.connected = true;
    this.connecting = false;
    this.doQueue();
    if (this.options.rememberTransport) this.options.document.cookie = 'socketio=' + encodeURIComponent(this.transport.type);
    this.emit('connect');
  };
  
  /**
   * When the transport receives new messages from the Socket.IO server it notifies us by calling
   * this method with the decoded `data` it received.
   *
   * @param data The message from the Socket.IO server.
   * @api private
   */
  Socket.prototype.onMessage = function(data){
    this.emit('message', [data]);
  };
  
  /**
   * When the transport is disconnected from the Socket.IO server it notifies us by calling
   * this method. If we where connected and the `reconnect` is set we will attempt to reconnect.
   *
   * @api private
   */
  Socket.prototype.onDisconnect = function(){
    var wasConnected = this.connected;
    this.connected = false;
    this.connecting = false;
    this.queueStack = [];
    if (wasConnected){
      this.emit('disconnect');
      if (this.options.reconnect && !this.reconnecting) this.onReconnect();
    }
  };
  
  /**
   * The reconnection is done using an exponential back off algorithm to prevent
   * the server from being flooded with connection requests. When the transport
   * is disconnected we wait until the `reconnectionDelay` finishes. We multiply 
   * the `reconnectionDelay` (if the previous `reconnectionDelay` was 500 it will
   * be updated to 1000 and than 2000>4000>8000>16000 etc.) and tell the current
   * transport to connect again. When we run out of `reconnectionAttempts` we will 
   * do one final attempt and loop over all enabled transport methods to see if 
   * other transports might work. If everything fails we emit the `reconnect_failed`
   * event.
   *
   * @api private
   */
  Socket.prototype.onReconnect = function(){
    this.reconnecting = true;
    this.reconnectionAttempts = 0;
    this.reconnectionDelay = this.options.reconnectionDelay;
    
    var self = this
      , tryTransportsOnConnectTimeout = this.options.tryTransportsOnConnectTimeout
      , rememberTransport = this.options.rememberTransport;
    
    function reset(){
      if(self.connected) self.emit('reconnect',[self.transport.type,self.reconnectionAttempts]);
      self.removeEvent('connect_failed', maybeReconnect).removeEvent('connect', maybeReconnect);
      self.reconnecting = false;
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
            self.transport = self.getTransport(self.options.transports); // override with all enabled transports
            self.redoTransports = true;
            self.connect();
          } else {
            self.emit('reconnect_failed');
            reset();
          }
        } else {
          self.reconnectionDelay *= 2; // exponential back off
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
  
  /**
   * API compatiblity
   */
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
   * @param {array or string} protocols
   * @param {string} proxyHost
   * @param {int} proxyPort
   * @param {string} headers
   */
  WebSocket = function(url, protocols, proxyHost, proxyPort, headers) {
    var self = this;
    self.__id = WebSocket.__nextId++;
    WebSocket.__instances[self.__id] = self;
    self.readyState = WebSocket.CONNECTING;
    self.bufferedAmount = 0;
    self.__events = {};
    if (!protocols) {
      protocols = [];
    } else if (typeof protocols == "string") {
      protocols = [protocols];
    }
    // Uses setTimeout() to make sure __createFlash() runs after the caller sets ws.onopen etc.
    // Otherwise, when onopen fires immediately, onopen is called before it is set.
    setTimeout(function() {
      WebSocket.__addTask(function() {
        WebSocket.__flash.create(
            self.__id, url, protocols, proxyHost || null, proxyPort || 0, headers || null);
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
   * @param {boolean} useCapture
   * @return void
   */
  WebSocket.prototype.addEventListener = function(type, listener, useCapture) {
    if (!(type in this.__events)) {
      this.__events[type] = [];
    }
    this.__events[type].push(listener);
  };

  /**
   * Implementation of {@link <a href="http://www.w3.org/TR/DOM-Level-2-Events/events.html#Events-registration">DOM 2 EventTarget Interface</a>}
   *
   * @param {string} type
   * @param {function} listener
   * @param {boolean} useCapture
   * @return void
   */
  WebSocket.prototype.removeEventListener = function(type, listener, useCapture) {
    if (!(type in this.__events)) return;
    var events = this.__events[type];
    for (var i = events.length - 1; i >= 0; --i) {
      if (events[i] === listener) {
        events.splice(i, 1);
        break;
      }
    }
  };

  /**
   * Implementation of {@link <a href="http://www.w3.org/TR/DOM-Level-2-Events/events.html#Events-registration">DOM 2 EventTarget Interface</a>}
   *
   * @param {Event} event
   * @return void
   */
  WebSocket.prototype.dispatchEvent = function(event) {
    var events = this.__events[event.type] || [];
    for (var i = 0; i < events.length; ++i) {
      events[i](event);
    }
    var handler = this["on" + event.type];
    if (handler) handler(event);
  };

  /**
   * Handles an event from Flash.
   * @param {Object} flashEvent
   */
  WebSocket.prototype.__handleEvent = function(flashEvent) {
    if ("readyState" in flashEvent) {
      this.readyState = flashEvent.readyState;
    }
    if ("protocol" in flashEvent) {
      this.protocol = flashEvent.protocol;
    }
    
    var jsEvent;
    if (flashEvent.type == "open" || flashEvent.type == "error") {
      jsEvent = this.__createSimpleEvent(flashEvent.type);
    } else if (flashEvent.type == "close") {
      // TODO implement jsEvent.wasClean
      jsEvent = this.__createSimpleEvent("close");
    } else if (flashEvent.type == "message") {
      var data = decodeURIComponent(flashEvent.message);
      jsEvent = this.__createMessageEvent("message", data);
    } else {
      throw "unknown event type: " + flashEvent.type;
    }
    
    this.dispatchEvent(jsEvent);
  };
  
  WebSocket.prototype.__createSimpleEvent = function(type) {
    if (document.createEvent && window.Event) {
      var event = document.createEvent("Event");
      event.initEvent(type, false, false);
      return event;
    } else {
      return {type: type, bubbles: false, cancelable: false};
    }
  };
  
  WebSocket.prototype.__createMessageEvent = function(type, data) {
    if (document.createEvent && window.MessageEvent && !window.opera) {
      var event = document.createEvent("MessageEvent");
      event.initMessageEvent("message", false, false, data, null, null, window, null);
      return event;
    } else {
      // IE and Opera, the latter one truncates the data parameter after any 0x00 bytes.
      return {type: type, data: data, bubbles: false, cancelable: false};
    }
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
   * Load a new flash security policy file.
   * @param {string} url
   */
  WebSocket.loadFlashPolicyFile = function(url){
    WebSocket.__addTask(function() {
      WebSocket.__flash.loadManualPolicyFile(url);
    });
  };

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
   * Called by Flash to notify JS that it's fully loaded and ready
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
   * Called by Flash to notify WebSockets events are fired.
   */
  WebSocket.__onFlashEvent = function() {
    setTimeout(function() {
      try {
        // Gets events using receiveEvents() instead of getting it from event object
        // of Flash event. This is to make sure to keep message order.
        // It seems sometimes Flash events don't arrive in the same order as they are sent.
        var events = WebSocket.__flash.receiveEvents();
        for (var i = 0; i < events.length; ++i) {
          WebSocket.__instances[events[i].webSocketId].__handleEvent(events[i]);
        }
      } catch (e) {
        console.error(e);
      }
    }, 0);
    return true;
  };
  
  // Called by Flash.
  WebSocket.__log = function(message) {
    console.log(decodeURIComponent(message));
  };
  
  // Called by Flash.
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

