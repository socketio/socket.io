io.Transport.flashsocket = io.Transport.websocket.extend({

  _ready: false,

  init: function(base){
    this.__super__(base);
    
    if (!('WebSocket' in window)){        
      if (!('swfobject' in window)) io.lab.script(io.path + 'lib/vendor/web-socket-js/swfobject.js').wait();
      if (!('FABridge' in window)) io.lab.script(io.path + 'lib/vendor/web-socket-js/FABridge.js').wait();
      
      var self = this;      
      io.lab.script(io.path + 'lib/vendor/web-socket-js/web_socket.js').wait(function(){        
        WebSocket.__swfLocation = io.path + 'lib/vendor/web-socket-js/WebSocketMain.swf';
        self._ready = true;
        if (self._doConnect) self.connect();
      });
    }        
  },

  connect: function(){
    if (!this._ready){
      this._doConnect = true;
      return this;
    } 
    return this.__super__();
  },
  
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