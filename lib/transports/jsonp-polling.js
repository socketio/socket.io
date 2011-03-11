/**
 * socket.io-node-client
 * Copyright(c) 2011 LearnBoost <dev@learnboost.com>
 * MIT Licensed
 */

(function(){
  var io = this.io,
  
   /**
   * The HTMLFile transport.
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
   * A list of all JSONPolling transports
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
   * Posts a encoded message to the Socket.IO server.
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
   * for messages.
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
   * Callback function for the incomming message stream.
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