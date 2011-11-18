
/**
 * Module requirements.
 */

var Transport = require('../transport')
  , Polling = require('./polling')
  , EventEmitter = require('../event-emitter')
  , util = require('../util')
  , global = this

/**
 * Module exports.
 */

module.exports = XHRPolling;
module.exports.Request = Request;

/**
 * Empty function
 */

function empty () { }

/**
 * XHR Polling constructor.
 *
 * @param {Object} opts.
 * @api public
 */

function XHRPolling (opts) {
  Transport.call(this, opts);
  // if browser
  this.xd = opts.host != global.location.hostname
    || global.location.port != opts.port;
  //end
};

/**
 * Inherits from Polling.
 */

util.inherits(XHRPolling, Polling);

/**
 * Opens the socket
 *
 * @api private
 */

XHRPolling.prototype.doOpen = function () {
  var self = this;
  util.defer(function () {
    Polling.prototype.open.call(self);
  });
};

/**
 * Closes the socket.
 *
 * @api private
 */

XHRPolling.prototype.doClose = function () {
  if (this.pollXhr) {
    this.pollXhr.abort();
  }
  if (this.sendXhr) {
    this.sendXhr.abort();
  }
};

/**
 * Creates a request.
 *
 * @param {String} method
 * @api private
 */

XHR.prototype.request = function (opts) {
  opts.uri = this.uri();
  opts.xd = this.xd;
  var req = new Request(opts);
  req.on('error', function () {
    self.close();
  });
  return req;
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
};

/**
 * Starts a poll cycle.
 *
 * @api private
 */

XHRPolling.prototype.doPoll = function () {
  this.pollXhr = this.request();
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
  var xhr = this.xhr = util.request(this.xd);
  this.xhr.open(this.method, this.uri, this.async);

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

  if (this.xd && this.xhr instanceof XDomainRequest) {
    this.xhr.onerror = function () {
      self.onError();
    };
    this.xhr.onload = function () {
      self.onData(xhr.responseText);
    };
    this.xhr.onprogress = empty;
  } else {
    this.xhr.onreadystatechange = function () {
      try {
        if (xhr.readyState != 4) return;

        if (200 == xhr.status) {
          self.onData(xhr.responseText);
        } else {
          self.onError();
        }
      } catch () {
        self.onError();
      }
    };
  }

  this.xhr.send(this.data);

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
