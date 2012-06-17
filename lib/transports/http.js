
/*!
 * socket.io-node
 * Copyright(c) 2011 LearnBoost <dev@learnboost.com>
 * MIT Licensed
 */

/**
 * Module requirements.
 */

var Transport = require('../transport')
  , parser = require('../parser')
  , qs = require('querystring');

/**
 * Export the constructor.
 */

exports = module.exports = HTTPTransport;

/**
 * HTTP interface constructor. For all non-websocket transports.
 *
 * @api public
 */

function HTTPTransport (mng, data, req) {
  Transport.call(this, mng, data, req);
};

/**
 * Inherits from Transport.
 */

HTTPTransport.prototype.__proto__ = Transport.prototype;

/**
 * Handles a request.
 *
 * @api private
 */

HTTPTransport.prototype.handleRequest = function (req) {
  if (req.method == 'POST') {
    var buffers = []
      , dataLength = 0
      , res = req.res
      , origin = req.headers.origin
      , headers = { 'Content-Length': 1, 'Content-Type': 'text/plain; charset=UTF-8' }
      , self = this;

    req.on('data', function (data) {
      var buffer = Buffer.isBuffer(data)? data : new Buffer( data, 'utf8' );
      dataLength += buffer.length      
      if ( dataLength >= self.manager.get('destroy buffer size')) {
        buffers = [];
        req.connection.destroy();
      } else {
        buffers.push(buffer);
      }
    });

    req.on('end', function () {
      res.writeHead(200, headers);
      res.end('1');
      var endData;
      if(buffers.length == 1) {
        endData = buffers[0].toString('utf8');
      } else {
        var endBuffer = new Buffer(dataLength);
        var curPos = 0, buffer, _i, _len;
        for (_i = 0, _len = buffers.length; _i < _len; _i++) {
          buffer = buffers[_i];
          buffer.copy(endBuffer, curPos);
          curPos += buffer.length;
        }
        endData = endBuffer.toString('utf8');   
      }     
      self.onData(self.postEncoded ? qs.parse(endData).d : endData);
    });

    // prevent memory leaks for uncompleted requests
    req.on('close', function () {
      buffers = [];
      self.onClose();
    });

    if (origin) {
      // https://developer.mozilla.org/En/HTTP_Access_Control
      headers['Access-Control-Allow-Origin'] = origin;
      headers['Access-Control-Allow-Credentials'] = 'true';
    }
  } else {
    this.response = req.res;

    Transport.prototype.handleRequest.call(this, req);
  }
};

/**
 * Handles data payload.
 *
 * @api private
 */

HTTPTransport.prototype.onData = function (data) {
  var messages = parser.decodePayload(data);
  this.log.debug(this.name + ' received data packet', data);

  for (var i = 0, l = messages.length; i < l; i++) {
    this.onMessage(messages[i]);
  }
};

/**
 * Closes the request-response cycle
 *
 * @api private
 */

HTTPTransport.prototype.doClose = function () {
  this.response.end();
};

/**
 * Writes a payload of messages
 *
 * @api private
 */

HTTPTransport.prototype.payload = function (msgs) {
  this.write(parser.encodePayload(msgs));
};
