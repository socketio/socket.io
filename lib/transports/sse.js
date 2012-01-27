var HTTPTransport = require('./http');

exports = module.exports = SSE;

/**
 * SSE transport constructor.
 *
 * @api public
 */

function SSE (mng, data, req) {
  HTTPTransport.call(this, mng, data, req);
};

/**
 * Inherits from Transport.
 */

SSE.prototype.__proto__ = HTTPTransport.prototype;

/**
 * Transport name
 *
 * @api public
 */

SSE.prototype.name = 'sse';

/**
 * Handles the request.
 *
 * @api private
 */

SSE.prototype.handleRequest = function (req) {
  HTTPTransport.prototype.handleRequest.call(this, req);

  if (!req.headers.accept || req.headers.accept !== 'text/event-stream')
    return;

  if (req.method == 'GET') {
    var headers = {
            'Content-Type': 'text/event-stream'
          , 'Cache-Control': 'no-cache'
          , 'Connection': 'keep-alive'
        }
      , origin = req.headers.origin
    if (origin) {
      // https://developer.mozilla.org/En/HTTP_Access_Control
      headers['Access-Control-Allow-Origin'] = '*';
      headers['Access-Control-Allow-Credentials'] = 'true';
    }
    req.res.writeHead(200, headers);
  }
};

/**
 * Closes the connection.
 *
 * @api private
 */

SSE.prototype.doClose = function () {
  this.socket.end();
};

/**
 * Performs the write.
 *
 * @api private
 */
var inspect = require('util').inspect;
SSE.prototype.write = function (data) {
  var payload = 'data: ';
  payload += JSON.stringify(data);
  payload += '\n\n';
  if (this.response.write(payload)) {
    this.drained = true;
  }

  this.log.debug(this.name + ' writing', inspect(payload));
};
