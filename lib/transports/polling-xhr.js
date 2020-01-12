const Polling = require('./polling');

class XHR extends Polling {
  /**
   * Overrides `onRequest` to handle `OPTIONS`..
   *
   * @param {http.IncomingMessage}
   * @api private
   */
  onRequest (req) {
    if ('OPTIONS' === req.method) {
      const res = req.res;
      const headers = this.headers(req);
      headers['Access-Control-Allow-Headers'] = 'Content-Type';
      res.writeHead(200, headers);
      res.end();
    } else {
      super.onRequest(req);
    }
  }

  /**
   * Returns headers for a response.
   *
   * @param {http.IncomingMessage} request
   * @param {Object} extra headers
   * @api private
   */
  headers (req, headers) {
    headers = headers || {};

    if (req.headers.origin) {
      headers['Access-Control-Allow-Credentials'] = 'true';
      headers['Access-Control-Allow-Origin'] = req.headers.origin;
    } else {
      headers['Access-Control-Allow-Origin'] = '*';
    }

    return super.headers(req, headers);
  }
}

module.exports = XHR;
