
/**
 * Module requirements.
 */

var Polling = require('./polling')
  , EventEmitter = require('../event-emitter')
  , util = require('../util')
  , global = this

/**
 * Module exports.
 */

module.exports = XHR;
module.exports.Request = Request;

/**
 * Empty function
 */

function empty () { }

/**
 * XHR Polling constructor.
 *
 * @param {Object} opts
 * @api public
 */

function XHR (opts) {
  Polling.call(this, opts);

  if (global.location) {
    this.xd = opts.host != global.location.hostname
      || global.location.port != opts.port;
  }

  // cache busting for IE
  if (global.ActiveXObject) {
    this.query.t = +new Date;
  }
};

/**
 * Inherits from Polling.
 */

util.inherits(XHR, Polling);

/**
 * Opens the socket
 *
 * @api private
 */

XHR.prototype.doOpen = function () {
  var self = this;
  util.defer(function () {
    Polling.prototype.doOpen.call(self);
  });
};

/**
 * Creates a request.
 *
 * @param {String} method
 * @api private
 */

XHR.prototype.request = function (opts) {
  opts = opts || {};
  opts.uri = this.uri();
  opts.xd = this.xd;
  return new Request(opts);
};

/**
 * Sends data.
 *
 * @param {String} data to send.
 * @param {Function} called upon flush.
 * @api private
 */

XHR.prototype.write = function (data, fn) {
  var req = this.request({ method: 'POST', data: data })
    , self = this
  req.on('success', fn);
  req.on('error', function (err) {
    self.onError('xhr post error', err);
  });
  this.sendXhr = req;
};

/**
 * Starts a poll cycle.
 *
 * @api private
 */

XHR.prototype.doPoll = function () {
  // debug: xhr poll
  var req = this.request()
    , self = this
  req.on('data', function (data) {
    self.onData(data);
  });
  req.on('error', function (err) {
    self.onError('xhr poll error', err);
  });
  this.pollXhr = req;
};

/**
 * Request constructor
 *
 * @param {Object} options
 * @api public
 */

function Request (opts) {
  this.method = opts.method || 'GET';
  this.uri = opts.uri;
  this.xd = !!opts.xd;
  this.async = false !== opts.async;
  this.data = undefined != opts.data ? opts.data : null;
  this.create();
}

/**
 * Inherits from Polling.
 */

util.inherits(Request, EventEmitter);

/**
 * Creates the XHR object and sends the request.
 *
 * @api private
 */

Request.prototype.create = function () {
  var xhr = this.xhr = util.request(this.xd)
    , self = this

  xhr.open(this.method, this.uri, this.async);

  if ('POST' == this.method) {
    try {
      if (xhr.setRequestHeader) {
        // xmlhttprequest
        xhr.setRequestHeader('Content-type', 'text/plain;charset=UTF-8');
      } else {
        // xdomainrequest
        xhr.contentType = 'text/plain';
      }
    } catch (e) {}
  }

  if (this.xd && global.XDomainRequest && xhr instanceof XDomainRequest) {
    xhr.onerror = function (e) {
      self.onError(e);
    };
    xhr.onload = function () {
      self.onData(xhr.responseText);
    };
    xhr.onprogress = empty;
  } else {
    xhr.withCredentials = true;
    xhr.onreadystatechange = function () {
      var data;

      try {
        if (xhr.readyState != 4) return;
        if (200 == xhr.status) {
          data = xhr.responseText;
        } else {
          var err = new Error;
          err.code = xhr.status;
          err.type = 'StatusError';
          self.onError(err);
        }
      } catch (e) {
        self.onError(e);
      }

      if (undefined != data) {
        self.onData(data);
      }
    };
  }

  // debug: sending xhr with url %s | data %s, this.uri, this.data
  xhr.send(this.data);

  if (global.ActiveXObject) {
    this.index = Request.requestsCount++;
    Request.requests[this.index] = this;
  }
};

/**
 * Called upon successful response.
 *
 * @api private
 */

Request.prototype.onSuccess = function () {
  this.emit('success');
  this.cleanup();
}

/**
 * Called if we have data.
 *
 * @api private
 */

Request.prototype.onData = function (data) {
  this.emit('data', data);
  this.onSuccess();
}

/**
 * Called upon error.
 *
 * @api private
 */

Request.prototype.onError = function () {
  this.emit('error');
  this.cleanup();
}

/**
 * Cleans up house.
 *
 * @api private
 */

Request.prototype.cleanup = function () {
  // xmlhttprequest
  this.xhr.onreadystatechange = empty;

  // xdomainrequest
  this.xhr.onload = this.xhr.onerror = empty;

  try {
    this.xhr.abort();
  } catch(e) {}

  if (global.ActiveXObject) {
    delete Browser.requests[this.index];
  }

  this.xhr = null;
}

/**
 * Aborts the request.
 *
 * @api public
 */

Request.prototype.abort = function () {
  this.cleanup();
};

if (global.ActiveXObject) {
  Request.requestsCount = 0;
  Request.requests = {};

  global.attachEvent('onunload', function () {
    for (var i in Request.requests) {
      if (Request.requests.hasOwnProperty(i)) {
        Request.requests[i].abort();
      }
    }
  });
}
