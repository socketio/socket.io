
/**
 * Module requirements.
 */

var Transport = require('../transport')
  , parser = require('../parser')
  , debug = require('debug')('engine.transport')

/**
 * Exports the constructor.
 */

module.exports = Polling;

/**
 * HTTP polling constructor.
 *
 * @api public.
 */

function Polling (req) {
  Transport.call(this, req);
};

/**
 * Inherits from Transport.
 *
 * @api public.
 */

Polling.prototype.__proto__ = Transport.prototype;

/**
 * Transport name
 *
 * @api public
 */

Polling.prototype.name = 'polling';

/**
 * Overrides onRequest.
 *
 * @param {http.ServerRequest}
 * @api private
 */

Polling.prototype.onRequest = function (req) {
  var res = req.res;

  this.clearPollTimeout();
};

/**
 * doWrite to clear poll timeout
 *
 * @api private
 */

HTTPPolling.prototype.doWrite = function () {
  this.clearPollTimeout();
};

/**
 * Performs a write.
 *
 * @api private.
 */

HTTPPolling.prototype.write = function (data, close) {
  this.doWrite(data);
  this.response.end();
  this.onClose();
};

/**
 * Override end.
 *
 * @api private
 */

HTTPPolling.prototype.end = function () {
  this.clearPollTimeout();
  return HTTPTransport.prototype.end.call(this);
};


/**
 * Handles a request.
 *
 * @api private
 */

HTTPTransport.prototype.handleRequest = function (req) {
  if (req.method == 'POST') {
    var buffer = ''
      , res = req.res
      , origin = req.headers.origin
      , headers = { 'Content-Length': 1 }
      , self = this;

    req.on('data', function (data) {
      buffer += data;
    });

    req.on('end', function () {
      res.writeHead(200, headers);
      res.end('1');

      self.onData(self.postEncoded ? qs.parse(buffer).d : buffer);
    });

    if (origin) {
      // https://developer.mozilla.org/En/HTTP_Access_Control
      headers['Access-Control-Allow-Origin'] = '*';

      if (req.headers.cookie) {
        headers['Access-Control-Allow-Credentials'] = 'true';
      }
    }
  } else {
    this.response = req.res;

    if (req.method == 'GET') {
      var self = this;

      this.pollTimeout = setTimeout(function () {
        self.packet({ type: 'noop' });
        self.log.debug(self.name + ' closed due to exceeded duration');
      }, this.manager.get('polling duration') * 1000);

      this.log.debug('setting poll timeout');
    }
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
