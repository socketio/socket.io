
/*!
 * Socket.IO - transports - Multipart
 * Copyright (c) 2010-2011 Guillermo Rauch <guillermo@learnboost.com>
 * MIT Licensed
 */

var Client = require('../client')
  , qs = require('querystring');

/**
 * Expose `Multipart`.
 */

module.exports = Multipart;

/**
 * Initialize a `Multipart` client.
 *
 * @api private
 */

function Multipart() {
  Client.apply(this, arguments);
};

/**
 * Inherit from `Client.prototype`.
 */

Multipart.prototype.__proto__ = Client.prototype;

/**
 * Connection implementation.
 * 
 * @api private
 */

Multipart.prototype._onConnect = function(req, res){
  var self = this
    , body = '';

  // https://developer.mozilla.org/En/HTTP_Access_Control
  if (req.headers.origin && this._verifyOrigin(req.headers.origin)){
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }

  if (typeof req.headers['access-control-request-method'] !== 'undefined'){
    // CORS preflight message
    res.setHeader('Access-Control-Allow-Methods', req.headers['access-control-request-method']);
    res.end('ok');
    return;
  }

  switch (req.method){
    case 'GET':
      Client.prototype._onConnect.call(this, req, res);
      res.setHeader('Content-Type', 'multipart/x-mixed-replace;boundary="socketio"');
      res.setHeader('Connection', 'keep-alive');
      req.connection.on('end', function(){ self._onClose(); });
      res.useChunkedEncodingByDefault = false;
      res.shouldKeepAlive = true;
      res.write("--socketio\n");
      if ('flush' in res) res.flush();
      this._payload();
      break;
      
    case 'POST':
      res.setHeader('Content-Type', 'text/plain');
      req.on('data', function(chunk){ body += chunk });
      req.on('end', function(){
        try {
          var msg = qs.parse(body);
          self._onMessage(msg.data);
        } catch(e){
          self.listener.log('xhr-multipart message handler error - ' + e.stack);
        }
        res.end('ok');
        body = '';
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
  
Multipart.prototype._write = function(message){
  if (this._open){
    var res = this.response
      , charset = '';

    if (1 == message.length && 6 == message.charCodeAt(0))
      charset = '; charset=us-ascii';
  
    res.write("Content-Type: text/plain" + charset + "\n\n");
    res.write(message + "\n");
    res.write("--socketio\n");
  }
};
