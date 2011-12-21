
/**
 * Module dependencies.
 */

var Transport = require('../transport')
  , XHR = require('./polling-xhr')
  , JSON = require('./polling-jsonp')
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
    });
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
 * Overloads onData to detect payloads.
 *
 * @api private
 */

Polling.prototype.onData = function (data) {
  var packets = parser.decodePayload(data);

  for (var i = 0, l = packets.length; i < l; i++) {
    // if its a PONG to our initial ping we consider the connection open
    if ('opening' == this.readyState) {
      if ('pong' == packets[i].type) {
        this.onOpen();
        continue;
      } else {
        this.error('protocol violation');
        return;
      }
    }

    // if its a close packet, we close the ongoing requests
    if ('close' == packets[i].type) {
      // doClose will cancel existing requests, and then fire a close packet
      // to signal the server we're closed, since we can't kill the socket/s
      this.doClose();
      this.onClose();
      return;
    }

    // otherwise bypass onData and handle the message
    this.onMessage(packets[i]);
  }

  // if we got data we're not polling
  this.polling = false;

  // trigger next poll
  this.poll();
};

/**
 * For polling, send a close packet.
 *
 * @api private
 */

Polling.prototype.doClose = function () {
  this.write(parser.encodePacket('close'));
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
