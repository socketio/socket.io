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