
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

Multipart.prototype._onConnect = function(req, res){
  var self = this
    , body = ''
    , headers = {};

  // https://developer.mozilla.org/En/HTTP_Access_Control
  if (req.headers.origin && this._verifyOrigin(req.headers.origin)){
    headers['Access-Control-Allow-Origin'] = '*';
    headers['Access-Control-Allow-Credentials'] = 'true';
  }

  if (typeof req.headers['access-control-request-method'] !== 'undefined'){
    // CORS preflight message
    headers['Access-Control-Allow-Methods'] = req.headers['access-control-request-method'];
    res.writeHead(200, headers);
    res.end('ok');
    return;
  }

  switch (req.method){
    case 'GET':
      Client.prototype._onConnect.apply(this, [req, res]);
      headers['Content-Type'] = 'multipart/x-mixed-replace;boundary="socketio"';
      headers['Connection'] = 'keep-alive';
      this.request.connection.on('end', function(){ self._onClose(); });
      this.response.useChunkedEncodingByDefault = false;
      this.response.shouldKeepAlive = true;
      this.response.writeHead(200, headers);
      this.response.write("--socketio\n");
      if ('flush' in this.response) this.response.flush();
      this._payload();
      break;
      
    case 'POST':
      headers['Content-Type'] = 'text/plain';
      req.on('data', function(chunk){ body += chunk });
      req.on('end', function(){
        try {
          var msg = qs.parse(body);
          self._onMessage(msg.data);
        } catch(e){
          self.listener.log('xhr-multipart message handler error - ' + e.stack);
        }
        res.writeHead(200, headers);
        res.end('ok');
        body = '';
      });
      break;
  }
};
  
Multipart.prototype._write = function(message){
  if (this._open){
    this.response.write("Content-Type: text/plain" + (message.length === 1 && message.charCodeAt(0) === 6 ? "; charset=us-ascii" : "") + "\n\n");
    this.response.write(message + "\n");
    this.response.write("--socketio\n");
  }
};
