io.Transport.websocket = io.Transport.extend({

	type: 'websocket',

  connect: function(){
    var self = this;
    this.socket = new WebSocket(this._prepareUrl());
    this.socket.addEventListener('message', function(ev){ self._onData(ev.data); });
    this.socket.addEventListener('close', function(ev){ self._onClose(); });
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
  return 'WebSocket' in window && !('__swfLocation' in WebSocket);
};