//exports.report=report;
//exports.prof=prof;

//require('./reporter') // reporter must be running
//require(__dirname + "/lib/setup").ext('support');
//require('log4js') // logging doesnt depend on log4js
var urlparse = require('url').parse,
		frame = '~m~',
		qs = require('querystring');
		var multipart = require("multipart");
var events = require('events');
var util=require('util');
util.inherits(Socket, events.EventEmitter);
/**
 * @desc simulates a socket.io client with HTTP client
 */
var http = require('http'),
    url = require('url');
/*
  PROTOTYPING SOCKET.IO CLIENT BEHAVIOUR
    var socket = new io.Socket({node_server_url}); 
    socket.connect();
    socket.on('connect', function(){ … }) 
    socket.on('message', function(){ … }) 
    socket.on('disconnect', function(){ … })
*/



function Socket(ip, port, opts){
  //this.client  = http.createClient(port, ip);
  if (typeof port !== 'number') throw new Error('[nodeClient] Socket Constructor: need a number for port. But port was '+ typeof port);  
  this.host = ip;
  this.port = port;
  this.requestUriBase = "socket.io";
  //this.type = 'xhr-multipart';
  this.type = 'nodeTransport'
  this.headers={};
  //we write json in the message body
  //this.headers['Content-Type'] = 'application/json';  
  this.headers['connection'] = 'keep-alive';		
  //this.headers['Transfer-Encoding']= 'chunked';
  events.EventEmitter.call(this);
	//process.EventEmitter.call(this);
	var self=this;
	options({
	  secure: false,
	  logging: true,
		timeout: 8000,
		resource:self.requestUriBase,
		heartbeatInterval: 16000, //be a bit generous, cause this must be larger than the serverside heartbeat interval (which now is 10 seconds)
		closeTimeout: 0,
		maxRetries: 20,
		initialTimeBetweenTries: 1000
	}, opts, self);
	this.connected = false;
	this.connecting = false;
	this._heartbeats = 0;
	this._posting=false;
  this._heartbeatTimeout = {};
  this.timeBetweenTries = this.options.initialTimeBetweenTries;  
  this.shouldConnect=true;
  this.initial = true;
  this.maxRetries = this.options.maxRetries;
  this.retries = 0;

  //LOG4JS LOGGING
  this._addContext = function(a){
    var args = Array.prototype.slice.call(a);
    args.unshift('[NODE CLIENT] ' + '--' + now()+ ' '); 
    return args;   
  }
  this.log = function(a){ if (this.options.logging) console.log.apply(this, this._addContext(arguments));}
  this.warn = function(a){ if (this.options.logging) console.warn.apply(this, this._addContext(arguments));}
  this.info = function(a){ if (this.options.logging) console.info.apply(this, this._addContext(arguments));}  
  this.error = function(a){ if (this.options.logging) console.error.apply(this, this._addContext(arguments));}
  // we try connecting every n milli seconds. On errors n is always doubled.
  this.connectWaitTimer = function interval() {
   setTimeout(function () {
     self.connect();
     //self.startInterval();
   }, self.timeBetweenTries); // we cannot use setInterval because we need to change the time all the time.
  }

  this._connect= function(){
    self.shouldConnect=true;
    self.connectWaitTimer();    
  }
}

Socket.prototype._prepareUrl = function(){
	return (this.options.secure ? 'https' : 'http') 
		+ '://' + this.host 
		+ ':' + this.port
		+ '/' + this.options.resource
		+ '/' + this.type
		+ (this.sessionid ? ('/' + this.sessionid) : '/');
};

Socket.prototype._request = function(url, method, multipart){
  if (method == 'POST'){
		this.headers['Content-type']= 'application/x-www-form-urlencoded; charset=utf-8';
	}
	//var req = this.client.request(method || 'GET', this._prepareUrl(), this.headers);
	var options = {
    host: this.host,
    port: this.port,
    path: this._prepareUrl(),
    method: method || 'GET',
    headers: this.headers
  };
  var req = http.request(options);
  var self=this;
  req.connection.addListener('end', function(){ self.warn('req.connection.addListener end called'); self._onDisconnect('connection end'); });  
	req.on('error', function(e){
	  self.log("Got Request error: " + e.message);
	  self.emit('error', {type: (req.method=='GET'?'connect':'send'), 'error':e, 'message': e.message})
	})
	//if (multipart) req.multipart = true;
	//req.open(method || 'GET', this._prepareUrl() + (url ? '/' + url : ''));

	return req;
};

Socket.prototype.connect = function(){
  if (!this.shouldConnect)  return;
  this.log('connecting...')
  if (this.shouldConnect) this.shouldConnect=false;
  
  var self=this;
  this.connecting = true;
  // SETUP PARSER FOR MULTIPART GET RESPONSES
  this.parser = multipart.parser();
  this.parser.boundary = "socketio";
  // in all event handlers, "this" is the parser, and "this.part" is the
  // part that's currently being dealt with.
  var buffer="";sendBuffer="";
  
  //subscribe to own error events
   this.on('error', function(e){
     this.send({status:'error', 'message':e.message, 'data':e})//will queue in sendbuffer if no connection available yet, be JSend compliant
   }); 
  
  this.parser.onpartbegin = function (part) { 
    //self.log('content type '+(part.headers['content-type'])); 
  };
  this.parser.ondata = function (chunk) { 
    //self.log('chunk '+ chunk); 
    buffer+=chunk.toString(); 
  };
  this.parser.onpartend = function (part) { 
    //self.log('parser boundary end '); 
    self._onData(buffer); buffer=""; 
  };  

  if (!('_sendBuffer' in this)) this._sendBuffer = [];
  //nothing will get sent until request end will be called
  //this.request = client.request('GET', this._prepareUrl, this.headers);
  this.request = this._request('', 'GET', true);
  var buffer;
  this.request.on('error', function (e){
    self.emit('error', {'type':'connect', 'message': 'Multipart GET request error ' + e.message})  
    self._handleConnectError();                  
  });
  this.request.on('response', function (response){
      self.response=response;
     // bail hard on non-200, something must be wrong
      if (response.statusCode != 200) {
          self.emit('error', {'type':'connect', message: 'response statuscode was '+response.statuscode, 'status': http.STATUS_CODES[response.statusCode]})        
          self._handleConnectError();
          return;
      }

      //var json;
      
      response.setEncoding('utf8');
      response.on('error', function (e) {
        self.emit('error', {'type':'connect', 'message': 'Multipart GET request response error ' + e.message})    
        self._handleConnectError();            
      });
      response.on('end', function () {
        //self._onData(buffer);
        self.emit('error', {'type':'disconnect', 'message': 'Multipart GET request should not receive end.'})
        self._handleConnectError();  
      });
      response.on('data', function (chunk) {
          try {
              self._onMultipartData(chunk);
              
          } catch (Err) {
              console.log((Err.stack));
              self.emit('error', {'type':'onMessage', 'message': Err.message, 'stack': Err.stack})
              return; // continue
          }
      }); 
      //this._onConnect(this.request, this.response);
  })  
  this.request.end(); // we send a normal GET request without a body //ends the GET request (however as we get back a session  id, next time we can reuse the same transport by passing in the session id in POSt)  
}

Socket.prototype.disconnect = function(){
  // clode the parser
  this.parser.close();
  try {
    //the GET request
    if('response' in this) this.response.connection.destroy();
    if ('request' in this) {
        this.request.end();  this.request.connection.destroy(); 
        if (typeof this.request.abort == 'function') 
          this.request.abort();//new since node v3.8
    }
    this.log("[Response] Closing connection ");
  } catch(e) {
    this.warn("[Response] Error ending connection "+e)
  }
  try {
    //the post request
    if('sendResponse' in this) this.response.connection.destroy();
    if ('_sendRequest' in this) {
        this._sendRequest.connection.destroy(); 
        if (typeof this._sendRequest.abort == 'function') 
          this._sendRequest.abort();//new since node v3.8
    }
    this._posting = false;
    this.connecting = false;    
    this.log("[sendResponse] Closing connection ");
  } catch(e) {
    this.warn("[sendResponse] Error ending connection "+e)
  }  
  this.sessionid = undefined; 
  this.connected = false;
  this.emit('disconnect', {message:'disconnect'}); 
}

Socket.prototype.send = function(data){
  //send the message body
  //this.request.write(JSON.stringify(message), this.headers);
  if (Array.isArray(data)){
		this._sendBuffer.push.apply(this._sendBuffer, data);
	} else {
	  if (typeof data !== 'string') data=JSON.stringify(data);
		this._sendBuffer.push(data);
	}
	this._checkSend();
	return this;
  //this.request.write('data=' + encodeURIComponent(data), this.headers);
  //this.request.end(); //sends delimiters for chunked encoding but keeps connection
}

Socket.prototype._checkSend = function(){
	if (!this._posting && this._sendBuffer.length){//if we aren't posting and there is something in the buffer: send it
		var encoded = this._encode(this._sendBuffer);
		this._sendBuffer = [];
		this._send(encoded);
	}
};

Socket.prototype._send = function(data){
	var self = this;
	this._posting = true;
	this._sendRequest = this._request('send', 'POST');
	this._sendRequest.write('data=' + /*encodeURIComponent*/qs.escape(data));
	this._sendRequest.on('response', function(response){
		self._sendResponse=response;
		if (response.statusCode != 200){
		    self.emit('error', {'type': 'send', 'message':'error sending message, got statuscode ' + http.STATUS_CODES[response.statusCode]})
		}
        //throw "response: " + response.statusCode;
    response.setEncoding('utf8');
    response.on('end', function () {
      //nothing to be done here all Ok if we receive end from Post request   
    });
    response.on('data', function (chunk) {
        try {
            //should be multipart message saying ok
            if(chunk !== 'ok'){
              self.log('Bad response for message received from server, Message was not delivered ' + chunk);
              self.emit('error', {'type': 'send', 'message':'error sending message ' + chunk})
              return;
            }
            //buffer+=chunk.toString();
            //json = JSON.parse(chunk); // let's not get crazy here
            //this.emit('message', json);

        } catch (Err) {
            console.log(Err.stack);
            return; // continue
        }
    });        
		self._posting = false;
		self._checkSend(); //poll again to see if something new entered the buffer meanwhile
	})
	this._sendRequest.end(); //sends delimiters for chunked encoding but keeps connection
}

Socket.prototype._onMultipartData = function (multipart){
  // feed the multipart stream throught the multipart stream parser
  this.parser.write(multipart);
}

//send a heartbeat message
Socket.prototype._heartbeat = function(h){
	var self = this;
	this.info('echoing heartbeat ' + h)
	self.send('~h~' + h); //pong
};

//HANDLING CONNECTION ERRORS
Socket.prototype._handleConnectError = function(){
  //destroy everything, that has been created until now
    this.parser.close();
    try {
      //the GET request
      if('response' in this) this.response.connection.destroy();
      if ('request' in this) {
          this.request.end();  this.request.connection.destroy(); 
          if (typeof this.request.abort == 'function') 
            this.request.abort();//new since node v3.8
      }
      this.log("[Response] Closing connection ");
    } catch(e) {
      this.warn("[Response] Error ending connection "+e)
    }
    this.request.destroy && this.request.destroy();
    this.response.destroy && this.response.destroy();    

    //  now lets reconnect
    if (this._checkMaxTimesConnectionError('connect')) return;
    this.timeBetweenTries *= 2;        
    this.emit('error', {type: 'connect', message: 'handleConnectionError ' + ' retrying in ' + this.timeBetweenTries/1000 + ' seconds'})  
    //we are not yet connected so no heartbeat interval is set, lets just try again
    this.connecting=false;
    this._connect(); //starts a timer before effectively connecting
}

Socket.prototype.setupHeartbeatInterval = function(){
  var self = this;
	if(this._heartbeatTimeout._onTimeout !== null) clearTimeout(this._heartbeatTimeout);
	//this.log('heartbeat Timeout cleared ' + 		self._heartbeatTimeout._idleStart   )					 
  self._heartbeatTimeout = setTimeout(function(){
  	self._onDisconnect('heartbeat timeout');
  }, self.options.heartbeatInterval);
  //self.log('settup heartbeat Timeout ' + self._heartbeatTimeout._idleStart)			
}
//HANDLING ANSWERS
//request on response
Socket.prototype._onConnect = function(){
  //when we connect the server will send a heartbeat within its interval (on the client we start counting a bit longer so that we take into account the transmission time)
  this.setupHeartbeatInterval();
	this.connected = true;
	this.connecting = false;
	//this._doQueue();
	//if (this.options.rememberTransport) this.options.document.cookie = 'socket.io=' + encodeURIComponent(this.transport.type);
	this.emit('connect');
};

//response on data
Socket.prototype._onData = function(data){
  //first me must mime decode the data
	var msgs = this._decode(data);
	if (msgs === false) return this.error('Bad message received from server ' + data);
	if (msgs){
		for (var i = 0, l = msgs.length; i < l; i++){
			this._onMessage(msgs[i]);
		}
	}
};

//response on data
Socket.prototype._onMessage = function(message){
  if (!('sessionid' in this)){
		this.sessionid = message;
		this.info(' session '+ this.sessionid +  ' established - connected')
		this._onConnect();
	} else if (message.substr(0, 3) == '~h~'){
		this._onHeartbeat(message.substr(3)); //pong
	} else {
		this.emit('message', message);
	}
};

//response on data = hearbeat message
Socket.prototype._onHeartbeat = function(h){
    var self=this;
	//if (h == this._heartbeats){
		//this.log('heartbeat received ' + h)	
		//this.log('heartbeat Timeout before clear ' + self._heartbeatTimeout._idleStart)
		//when we receive a heartbeat weclear the timeout and start counting again			
    this.setupHeartbeatInterval();
		this._heartbeat(h); // echo
	//}
};

/*Socket.prototype._checkStartInterval = function(){
  if (!this.initial) return;
  if (this.initial) {
    this.initial = false; 
    this.startInterval();
  }
}
*/

Socket.prototype._checkMaxTimesConnectionError = function(type){
  //start the timer on first usage
  //this._checkStartInterval();
  //reopen connection
  if (this.retries++ >= this.maxRetries){
    this.emit('error', {type: type, message: 'max retry times reached, retried ' + this.maxRetries + ' times. bailing out'})
    //we shouldnt be in a timer, when we come here, cause the timer gets rearmed only after a disconnect took place and a _connect is called 
    if (this.connectWaitTimer._onTimeout !== null ) clearTimeout(this._connectWaitTimer);  //that's it, definitely clear the reconnect timeout
    return true;   
  } 
  return false;
}
Socket.prototype._onDisconnect = function(spec){
  //called when we lost connection (actually the connection might still be active so disconnect it!)
  //check if limit reached
  if (this._checkMaxTimesConnectionError('disconnect')) return;
  //reopen connection
  //if (spec == 'heartbeat timeout'){
    this.emit('error', {type: 'disconnect', message: spec + ' retrying in ' + this.timeBetweenTries/1000 + ' seconds'})   
    this.disconnect();     
    this._connect();
    this.timeBetweenTries *= 2;  

  //}
  //we will not receive any heartbeat anymore, so clear the heartbeat timeout
  if (this._heartbeatTimeout._onTimeout !== null) clearTimeout(this._heartbeatTimeout);
  //if (this.startInterval._onTimeout !== null ) clearTimeout(this._startInterval);  

}



//HELPERS
Socket.prototype._encode = function(messages){
	var ret = '', message,
			messages = Array.isArray(messages) ? messages : [messages];
	for (var i = 0, l = messages.length; i < l; i++){
		message = messages[i] === null || messages[i] === undefined ? '' : String(messages[i]);
		ret += frame + message.length + frame + message;
	}
	return ret;
};
	
Socket.prototype._decode = function(data){
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
				data = data.substr(number.length + frame.length)
				number = Number(number);
				break;
			} 
		}
		messages.push(data.substr(0, number)); // here
		data = data.substr(number);
	} while(data !== '');
	return messages;
};





/*if (db.user && db.pass) {
    var basicAuth = 'Basic ' + new Buffer(db.user + ':' + db.pass).toString('base64');
}

var headers = {};
if (typeof basicAuth != 'undefined') {
    headers["Authorization"] = basicAuth;
}*/
function now(){
	return new Date().toUTCString();
}

function options(opts, mergeOpts, self){
	self.options = merge(opts || {}, mergeOpts || {});
}

function merge(source, merge){
	for (var i in merge) source[i] = merge[i];
	return source;
};

//factory method for closure
exports.makeSocket=function(ip,port,opts){return new Socket(ip, port, opts);};
exports.nodeClient = Socket;




