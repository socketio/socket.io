io.Transport.flashsocket = io.Transport.websocket.extend({

  init: function(base){
    this.__super__(base);     
		WebSocket.__swfLocation = io.path + 'lib/vendor/web-socket-js/WebSocketMain.swf';
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
    return !! navigator.plugins['Shockwave Flash'].description && ('__initialize' in WebSocket);
  } 

  if ('ActiveXObject' in window){
    try {
      return !! new ActiveXObject('ShockwaveFlash.ShockwaveFlash').GetVariable('$version') && ('__swfLocation' in WebSocket);
    } catch (e){}      
  }

  return false;
};