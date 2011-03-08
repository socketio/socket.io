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
    this.sendBuffer = [];
  };
  
  io.util.inherit(XHR, io.Transport);
  
  XHR.prototype.connect = function(){
    this.get();
    return this;
  };
  
  XHR.prototype.checkSend = function(){
    if (!this.posting && this.sendBuffer.length){
      var encoded = this.encode(this.sendBuffer);
      this.sendBuffer = [];
      this.sendIORequest(encoded);
    }
  };
  
  XHR.prototype.send = function(data){
    if (io.util.isArray(data)){
      this.sendBuffer.push.apply(this.sendBuffer, data);
    } else {
      this.sendBuffer.push(data);
    }
    this.checkSend();
    return this;
  };
  
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
  
  XHR.prototype.disconnect = function(){
    // send disconnection signal
    this.onDisconnect();
    return this;
  };
  
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
  
  XHR.prototype.request = function(url, method, multipart){
    var req = request(this.base.isXDomain());
    if (multipart) req.multipart = true;
    req.open(method || 'GET', this.prepareUrl() + (url ? '/' + url : ''));
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
