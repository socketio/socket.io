/**
 * Socket.IO client
 * 
 * @author Guillermo Rauch <guillermo@learnboost.com>
 * @license The MIT license.
 * @copyright Copyright (c) 2010 LearnBoost <dev@learnboost.com>
 */

(function(){
  var io = this.io,
  
  empty = new Function(),

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

  XHRPolling.check = function(){
    return io.Transport.XHR.check();
  };

  XHRPolling.xdomainCheck = function(){
    return io.Transport.XHR.xdomainCheck();
  };

})();
