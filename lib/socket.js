
/**
 * Module dependencies.
 */

var EventEmitter = require('events').EventEmitter
  , debug = require('debug')('engine.socket')

/**
 * Module exports.
 */

module.exports = Socket;

/**
 * Client class (abstract).
 *
 * @api private
 */

function Socket (id, server, transport) {
  this.id = id;
  this.server = server;
  this.upgraded = false;
  this.readyState = 'opening';

  // keep track of request that originated the transport
  this.req = transport.req;
  this.setTransport(transport);
  this.onOpen();
}

/**
 * Inherits from EventEmitter.
 */

Socket.prototype.__proto__ = EventEmitter.prototype;

/**
 * Called upon transport considered open.
 *
 * @api private
 */

Socket.prototype.onOpen = function () {
  this.readyState = 'open';

  // sends an `open` packet
  this.transport.send({
      type: 'open'
    , data: JSON.stringify({
          sid: this.id
        , upgrades: this.server.upgrades(this.transport.name)
        , pingTimeout: this.server.pingTimeout
        , pingInterval: this.server.pingInterval
      })
  });

  this.emit('open');
  this.ping();
};

/**
 * Called upon transport packet.
 *
 * @param {Object} packet
 * @api private
 */

Socket.prototype.onPacket = function (packet) {
  if ('open' == this.readyState) {
    switch (packet.type) {
      case 'pong':
        debug('got pong');
        this.emit('heartbeat');
        this.ping();
        break;

      case 'error':
        this.onClose('parse error');
        break;

      case 'message':
        this.emit('message', packet.data);
        break;
    }
  } else {
    debug('packet received with closed socket');
  }
};

Socket.prototype.onError = function (err) {
  debug('transport error');
  this.onClose('transport error', err);
};

/**
 * Pings a client.
 *
 * @api private
 */

Socket.prototype.ping = function () {
  clearTimeout(this.pingTimeoutTimer);

  var self = this;
  this.pingIntervalTimer = setTimeout(function () {
    debug('writing ping packet - expected pong in %sms', self.server.pingTimeout);
    self.transport.send({ type: 'ping' });
    self.pingTimeoutTimer = setTimeout(function () {
      self.onClose('ping timeout');
    }, self.server.pingTimeout);
  }, this.server.pingInterval);
};

/**
 * Attaches handlers for the given transport.
 *
 * @param {Transport} transport
 * @api private
 */

Socket.prototype.setTransport = function (transport) {
  this.transport = transport;
  this.transport.once('error', this.onError.bind(this));
  this.transport.on('packet', this.onPacket.bind(this));
  this.transport.once('close', this.onClose.bind(this, ['transport close']));
};

/**
 * Upgrades socket to the given transport
 *
 * @param {Transport} transport
 * @api private
 */

Socket.prototype.upgrade = function (transport) {
  // assert: !this.upgraded, 'we cant upgrade twice'
  this.upgraded = true;
  this.clearTransport();

  // the transport is already opened if we're upgrading to it
  // therefore we don't worry about the `open` event
  this.setTransport(transport);
  this.ping();
};

/**
 * Clears listeners and timers associated with current transport.
 *
 * @api private
 */

Socket.prototype.clearTransport = function () {
  clearTimeout(this.pingIntervalTimer);
  clearTimeout(this.pingTimeoutTimer);
};

/**
 * Called upon transport considered closed.
 * Possible reasons: `ping timeout`, `client error`, `parse error`,
 * `transport error`, `server close`, `transport close`
 */

Socket.prototype.onClose = function (reason, description) {
  if ('close' != this.readyState) {
    this.clearTransport();
    this.readyState = 'close';
    this.emit('close', reason, description);
  }
};

/**
 * Sends a message packet.
 *
 * @param {String} message
 * @api public
 */

Socket.prototype.send = function (data) {
  this.transport.send({ type: 'message', data: data });
};

/**
 * Closes the socket and underlying transport.
 *
 * @return {Socket} for chaining
 * @api public
 */

Socket.prototype.close = function () {
  if ('open' == this.readyState) {
    this.onClose('forced close');
    this.transport.close();
  }
};
