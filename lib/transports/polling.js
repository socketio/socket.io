
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

  if ('GET' == req.method) {
    this.onPollRequest(req, res);
  } else if ('POST' == req.method) {
    this.onDataRequest(req, res);
  } else {
    res.writeHead(500);
    res.end();
  }
};

/**
 * The client sends a request awaiting for us to send data.
 *
 * @api private
 */

Polling.prototype.onPollRequest = function (req, res) {
  // if there's an ongoing poll
  if (this.req) {
    // assert: this.res, '.req and .res should be (un)set together'
    this.onError('poll overlap from client');
    res.writeHead(500);
  } else {
    this.req = req;
    this.res = res;

    var self = this;

    function onClose () {
      self.onError('poll connection closed prematurely');
    }

    function cleanup () {
      req.removeListener('close', onClose);
      self.req = self.res = null;
    }

    req.cleanup = cleanup;
    req.on('close', onClose);

    this.buffer = false;
    this.flush();
  }
};

/**
 * The client sends a request with data.
 *
 * @api private
 */

Polling.prototype.onDataRequest = function (req, res) {
  if (this.dataReq) {
    // assert: this.dataRes, '.dataReq and .dataRes should be (un)set together'
    this.onError('data request overlap from client');
    res.writeHead(500);
  } else {
    this.dataReq = req;
    this.dataRes = res;

    var chunks = ''
      , self = this

    function cleanup () {
      chunks = '';
      req.removeListener('data', onData);
      req.removeListener('end', onEnd);
      req.removeListener('close', cleanup);
      self.dataReq = self.dataRes = null;
    };

    function onClose () {
      cleanup();
      self.onError('data request connection closed prematurely');
    };

    function onData () {
      chunks += data;
    };

    function onEnd () {
      self.onData(chunks);
      res.writeHead(204);
      res.end();
      cleanup();
    };

    req.abort = cleanup;
    req.on('close', onClose);
    req.on('data', onData);
    req.on('end', onEnd);
    req.setEncoding('utf8');
  }
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
