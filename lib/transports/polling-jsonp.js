
/**
 * Module requirements.
 */

var Transport = require('../transport')
  , Polling = require('./polling')
  , util = require('../util')

/**
 * Module exports.
 */

module.exports = JSONPPolling;

/**
 * Cached regular expressions.
 */

var rNewline = /\n/g

/**
 * Noop.
 */

function empty () { }

/**
 * JSONP Polling constructor.
 *
 * @param {Object} opts.
 * @api public
 */

function JSONPPolling (opts) {
  Transport.call(this, opts);
  this.setIndex();
};

/**
 * Inherits from Polling.
 */

util.inherits(JSONPPolling, Polling);

/**
 * Transport name.
 *
 * @api public
 */

JSONPPolling.prototype.name = 'polling-jsonp';

/**
 * Sets JSONP global callback.
 *
 * @api private
 */

JSONPPolling.prototype.setIndex = function () {
  // if we have an index already, set it to empy
  if (undefined != this.index) {
    eio.j[this.index] = empty;
  }

  var self = this;
  this.index = eio.j.length;
  eio.j.push(function (msg) {
    self.onData(msg);
  });
};

/**
 * Opens the socket.
 *
 * @api private
 */

JSONPPolling.prototype.doOpen = function () {
  var self = this;
  util.defer(function () {
    Polling.prototype.doOpen.call(self);
  });
};

/**
 * Closes the socket
 *
 * @api private
 */

JSONPPolling.prototype.doClose = function () {
  this.setIndex();

  if (this.script) {
    this.script.parentNode.removeChild(this.script);
    this.script = null;
  }

  if (this.form) {
    this.form.parentNode.removeChild(this.form);
    this.form = null;
  }

  Polling.prototype.doClose.call(this);
};

/**
 * Starts a poll cycle.
 *
 * @api private
 */

JSONPPolling.prototype.doPoll = function () {
  var self = this
    , script = document.createElement('script')
    , query = this.options.query + (this.options.query ? '&' : '')
        + 't=' + (+new Date) + '&i=' + this.index

  if (this.script) {
    this.script.parentNode.removeChild(this.script);
    this.script = null;
  }

  script.async = true;
  script.src = this.prepareUrl() + query;

  var insertAt = document.getElementsByTagName('script')[0]
  insertAt.parentNode.insertBefore(script, insertAt);
  this.script = script;

  if (util.ua.gecko) {
    setTimeout(function () {
      var iframe = document.createElement('iframe');
      document.body.appendChild(iframe);
      document.body.removeChild(iframe);
    }, 100);
  }
};

/**
 * Writes with a hidden iframe.
 *
 * @param {String} data to send
 * @param {Function} called upon flush.
 * @api private
 */

JSONPPolling.prototype.write = function (data, fn) {
  var self = this
    , query = this.options.query + (this.options.query ? '&' : '')
        + 't=' + (+new Date) + '&i=' + this.index

  if (!this.form) {
    var form = document.createElement('form')
      , area = document.createElement('textarea')
      , id = this.iframeId = 'socketio_iframe_' + this.index
      , iframe;

    form.className = 'socketio';
    form.style.position = 'absolute';
    form.style.top = '-1000px';
    form.style.left = '-1000px';
    form.target = id;
    form.method = 'POST';
    form.setAttribute('accept-charset', 'utf-8');
    area.name = 'd';
    form.appendChild(area);
    document.body.appendChild(form);

    this.form = form;
    this.area = area;
  }

  this.form.action = this.prepareUrl() + query;

  function complete () {
    initIframe();
    fn();
  };

  function initIframe () {
    if (self.iframe) {
      self.form.removeChild(self.iframe);
    }

    try {
      // ie6 dynamic iframes with target="" support (thanks Chris Lambacher)
      iframe = document.createElement('<iframe name="'+ self.iframeId +'">');
    } catch (e) {
      iframe = document.createElement('iframe');
      iframe.name = self.iframeId;
    }

    iframe.id = self.iframeId;

    self.form.appendChild(iframe);
    self.iframe = iframe;
  };

  initIframe();

  // escape \n to prevent it from being converted into \r\n by some UAs
  this.area.value = data.replace(rNewline, '\\n');

  try {
    this.form.submit();
  } catch(e) {}

  if (this.iframe.attachEvent) {
    iframe.onreadystatechange = function () {
      if (self.iframe.readyState == 'complete') {
        complete();
      }
    };
  } else {
    this.iframe.onload = complete;
  }
};
