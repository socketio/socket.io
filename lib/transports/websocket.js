/**
 * Socket.IO client
 * 
 * @author Guillermo Rauch <guillermo@learnboost.com>
 * @license The MIT license.
 * @copyright Copyright (c) 2010 LearnBoost <dev@learnboost.com>
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

io.Transport.websocket.xdomainCheck = function(){
	return true;
};