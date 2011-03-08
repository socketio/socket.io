/**
 * Socket.IO client
 * 
 * @author Guillermo Rauch <guillermo@learnboost.com>
 * @license The MIT license.
 * @copyright Copyright (c) 2010 LearnBoost <dev@learnboost.com>
 */

(function(){
  var io = this.io;
  
  var XHRMultipart = io.Transport['xhr-multipart'] = function(){
    io.Transport.XHR.apply(this, arguments);
  };
  
  io.util.inherit(XHRMultipart, io.Transport.XHR);
  
  XHRMultipart.prototype.type = 'xhr-multipart';
  
  XHRMultipart.prototype.get = function(){
    var self = this;
    this.xhr = this.request('', 'GET', true);
    this.xhr.onreadystatechange = function(){
      if (self.xhr.readyState == 4) self.onData(self.xhr.responseText);
    };
    this.xhr.send(null);
  };
  
  XHRMultipart.check = function(){
    return 'XMLHttpRequest' in window && 'prototype' in XMLHttpRequest && 'multipart' in XMLHttpRequest.prototype;
  };

  XHRMultipart.xdomainCheck = function(){
    return true;
  };
  
})();