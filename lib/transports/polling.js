
/**
 * Module dependencies.
 */

var Transport = require('../transport')
  , XHR = require('./polling-xhr')
  , JSON = require('./polling-json')
  , util = require('../util')
  , parser = require('../parser')
  , global = this

/**
 * Module exports.
 */

module.exports = Polling;

/**
 * Polling transport polymorphic constructor.
 * Decides on xhr vs jsonp based on feature detection.
 *
 * @api public
 */

function Polling (opts) {
  var xd;

  if (global.location) {
    xd = opts.host != global.location.hostname
      || global.location.port != opts.port;
  }

  var xhr = request(xd);

  if (xhr && !opts.forceJSONP) {
    return new XHR;
  } else {
    return new JSONP;
  }
};

/**
 * Inherits from Transport.
 */

util.inherits(Polling, Transport);

/**
 * Opens the socket (triggers polling). We write a PING message to determine
 * when the transport is open.
 *
 * @api private
 */

Polling.prototype.doOpen = function () {
  this.poll();
  this.write(parser.encodePacket('ping'));
};

/**
 * Pauses polling.
 *
 * @param {Function} callback upon flush
 * @api private
 */

Polling.prototype.pause = function (onFlush) {
  this.paused = true;

  var pending = 0;

  if (this.polling) {
    pending++;
    this.once('data', function () {
      --pending || onFlush();
    }
  }

  if (this.buffer) {
    pending++;
    this.once('flush', function () {
      --pending || onFlush();
    });
  }
};

/**
 * Starts polling cycle.
 *
 * @api public
 */

Polling.prototype.poll = function () {
  if (!this.paused) {
    this.polling = true;
    this.doPoll();
    this.emit('poll');
  }
};

/**
 * Pauses polling.
 *
 * @param {Function} callback when buffers are flushed
 * @api private
 */

Polling.prototype.pause = function (fn) {
  this.paused = true;
  this.removeAllListeners();
};

/**
 * Overloads onData to detect payloads.
 *
 * @api private
 */

Polling.prototype.onData = function (data) {
  if ('open' != this.readyState) {
    this.onOpen();
  }

  var packets = parser.decodePayload(data);

  for (var i = 0, l = packets.length; i < l; i++) {
    Transport.prototype.onData.call(this, packets[i]);
  }

  // if we got data we're not polling
  this.polling = false;

  // trigger next poll
  this.poll();

  return ret;
};

/**
 * Writes a packets payload.
 *
 * @param {Array} data packets
 * @api private
 */

Polling.prototype.writeMany = function (packets) {
  this.write(parser.encodePayload(packets));
};
