
/*!
 * Socket.IO - transports - HTMLFile
 * Copyright (c) 2010-2011 Guillermo Rauch <guillermo@learnboost.com>
 * MIT Licensed
 */

var Client = require('../client')
  , qs = require('querystring');

/**
 * Expose `HTMLFile`.
 */

module.exports = HTMLFile;

/**
 * Initialize a `HTMLFile` client.
 *
 * @api private
 */

function HTMLFile() {
  Client.apply(this, arguments);
};

/**
 * Inherit from `Client.prototype`.
 */

HTMLFile.prototype.__proto__ = Client.prototype;

/**
 * Connection implementation.
 * 
 * @api private
 */

HTMLFile.prototype._onConnect = function(req, res){
  var self = this
    , body = '';

  switch (req.method){
    case 'GET':
      Client.prototype._onConnect.call(this, req, res);
      res.useChunkedEncodingByDefault = true;
      res.shouldKeepAlive = true;
      res.setHeader('Content-Type', 'text/html');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('Transfer-Encoding', 'chunked');
      res.write('<html><body>' + new Array(245).join(' '));
      this._payload();
      break;
      
    case 'POST':
      req.on('data', function(message){ body += message; });
      req.on('end', function(){
        try {
          var msg = qs.parse(body);
          self._onMessage(msg.data);
        } catch(e){
          self.listener.log('htmlfile message handler error - ' + e.stack);
        }

        res.setHeader('Content-Type', 'text/plain');
        res.end('ok');
      });
      break;
  }
};

/**
 * Write implementation.
 * 
 * @param {String} message
 * @api private
 */
  
HTMLFile.prototype._write = function(message){
  if (this._open) {
    message = JSON.stringify(message);
    this.response.write('<script>parent.s._(' + message + ', document);</script>');
  }
};
