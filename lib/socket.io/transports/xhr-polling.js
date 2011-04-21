
/*!
 * Socket.IO - transports - Polling
 * Copyright (c) 2010-2011 Guillermo Rauch <guillermo@learnboost.com>
 * MIT Licensed
 */

var Client = require('../client')
  , qs = require('querystring');

/**
 * Expose `Polling`.
 */

module.exports = Polling;

/**
 * Initialize a `Polling` client.
 *
 * @api private
 */

function Polling() {
  Client.apply(this, arguments);
};

/**
 * Inherit from `Client.prototype`.
 */

Polling.prototype.__proto__ = Client.prototype;

/**
 * Options.
 */

Polling.prototype.options = {
    timeout: null
  , closeTimeout: 8000
  , duration: 20000
};

/**
 * Connection implementation.
 * 
 * @api private
 */

Polling.prototype._onConnect = function(req, res){
  var self = this
    , body = '';

  switch (req.method){
    case 'GET':
      Client.prototype._onConnect.call(this, req, res);
      this._closeTimeout = setTimeout(function(){
        self._write('');
      }, this.duration);
      this._payload();
      break;
      
    case 'POST':
      req.on('data', function(chunk){ body += chunk; });
      req.on('end', function(){
        res.setHeader('Content-Type', 'text/plain');

        if (req.headers.origin){
          if (self._verifyOrigin(req.headers.origin)){
            res.setHeader('Access-Control-Allow-Origin', '*');
            if (req.headers.cookie) {
              res.setHeader('Access-Control-Allow-Credentials', 'true');
            }
          } else {
            res.statusCode = 401;
            res.end('unauthorized');
            return;
          }
        }

        try {
          // optimization: just strip first 5 characters here?
          //  ^ totally
          var msg = qs.parse(body);
          self._onMessage(msg.data);
        } catch(e){
          self.listener.log('xhr-polling message handler error - ' + e.stack);
        }

        res.end('ok');
      });
      break;
  }
};

/**
 * Close Implementation.
 * 
 * @api private
 */

Polling.prototype._onClose = function(){
  if (this._closeTimeout) clearTimeout(this._closeTimeout);
  return Client.prototype._onClose.call(this);
};

/**
 * Write implementation.
 *
 * @param {String} message
 * @api private
 */
  
Polling.prototype._write = function(message){
  if (this._open) {
    var res = this.response
      , req = this.request
      , origin = req.headers.origin;

    res.setHeader('Content-Type', 'text/plain; charset=UTF-8');
    res.setHeader('Content-Length', Buffer.byteLength(message));

    // https://developer.mozilla.org/En/HTTP_Access_Control
    if (origin && this._verifyOrigin(origin)){
      origin = 'null' == origin ? '*' : origin;
      res.setHeader('Access-Control-Allow-Origin', origin);
      if (req.headers.cookie) res.setHeader('Access-Control-Allow-Credentials', 'true');
    }

    res.end(message);
    this._onClose();
  }
};
