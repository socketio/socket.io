/**
 * socket.io-node-client
 * Copyright(c) 2011 LearnBoost <dev@learnboost.com>
 * MIT Licensed
 */

(function(){
  var io = this.io,
  
  /**
   * The HTMLFile transport creates a `forever iframe` based transport
   * for Internet Explorer. Regular forever iframe implementations will 
   * continuously trigger the browsers buzy indicators. If the forever iframe
   * is created inside a `htmlfile` these indicators will not be trigged.
   *
   * @constructor
   * @extends {io.Transport.XHR}
   * @api public
   */
  HTMLFile = io.Transport.htmlfile = function(){
    io.Transport.XHR.apply(this, arguments);
  };
  
  io.util.inherit(HTMLFile, io.Transport.XHR);
  
  /**
   * The transport type, you use this to identify which transport was chosen.
   *
   * @type {String}
   * @api public
   */
  HTMLFile.prototype.type = 'htmlfile';
  
  /**
   * Starts the HTMLFile data stream for incoming messages. And registers a
   * onunload event listener so the HTMLFile will be destroyed.
   *
   * @api private
   */
  HTMLFile.prototype.get = function(){
    var self = this;
    this.open();
    window.attachEvent('onunload', function(){ self.destroy(); });
  };
  
  /**
   * Creates a new ActiveX `htmlfile` with a forever loading iframe
   * that can be used to listen to messages. Inside the generated
   * `htmlfile` a reference will be made to the HTMLFile transport.
   *
   * @api private
   */
  HTMLFile.prototype.open = function(){
    this.doc = new ActiveXObject('htmlfile');
    this.doc.open();
    this.doc.write('<html></html>');
    this.doc.parentWindow.s = this;
    this.doc.close();
    
    var iframeC = this.doc.createElement('div');
    this.doc.body.appendChild(iframeC);
    this.iframe = this.doc.createElement('iframe');
    iframeC.appendChild(this.iframe);
    this.iframe.src = this.prepareUrl() + '/' + (+ new Date);
  };
  
  /**
   * The Socket.IO server will write script tags inside the forever
   * iframe, this function will be used as callback for the incoming
   * information.
   *
   * @param {String} data The message
   * @param {document} doc Reference to the context
   * @api private
   */
  HTMLFile.prototype._ = function(data, doc){
    this.onData(data);
    var script = doc.getElementsByTagName('script')[0];
    script.parentNode.removeChild(script);
  };
  
  /**
   * Destroy the established connection, iframe and `htmlfile`.
   * And calls the `CollectGarbage` function of Internet Explorer
   * to release the memory.
   *
   * @api private
   */
  HTMLFile.prototype.destroy = function(){
    if (this.iframe){
      try {
        this.iframe.src = 'about:blank';
      } catch(e){}
      this.doc = null;
      CollectGarbage();
    }
  };
  
  /**
   * Disconnects the established connection.
   *
   * @returns {Transport} Chaining.
   * @api public
   */
  HTMLFile.prototype.disconnect = function(){
    this.destroy();
    return io.Transport.XHR.prototype.disconnect.call(this);
  };
  
  /**
   * Checks if the browser supports this transport. The browser
   * must have an `ActiveXObject` implementation.
   *
   * @return {Boolean}
   * @api public
   */
  HTMLFile.check = function(){
    if ('ActiveXObject' in window){
      try {
        var a = new ActiveXObject('htmlfile');
        return a && io.Transport.XHR.check();
      } catch(e){}
    }
    return false;
  };
  
  /**
   * Check if cross domain requests are supported.
   *
   * @returns {Boolean}
   * @api public
   */
  HTMLFile.xdomainCheck = function(){
    // we can probably do handling for sub-domains, we should test that it's cross domain but a subdomain here
    return false;
  };
  
})();