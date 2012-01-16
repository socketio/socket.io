
/**
 * Module dependencies.
 */

var EventEmitter = require('events').EventEmitter
  , debug = require('debug')('engine:socket')

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
  this.writeBuffer = [];

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
  this.sendPacket('open', JSON.stringify({
      sid: this.id
    , upgrades: this.server.upgrades(this.transport.name)
    , pingTimeout: this.server.pingTimeout
    , pingInterval: this.server.pingInterval
  }));

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
    self.sendPacket({ type: 'ping' });
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
  this.transport.on('drain', this.flush.bind(this));
  this.transport.once('close', this.onClose.bind(this, 'transport close'));
};

/**
 * Upgrades socket to the given transport
 *
 * @param {Transport} transport
 * @api private
 */

Socket.prototype.maybeUpgrade = function (transport) {
  debug('might upgrade socket transport from "%s" to "%s"'
    , this.transport.name, transport.name);

  // set transport upgrade timer
  var upgradeTimeout = setTimeout(function () {
    debug('client did not complete upgrade - closing transport');
    if ('open' == transport.readyState) {
      transport.close();
    }
  }, this.server.upgradeTimeout);

  var self = this;
  function onPacket (packet) {
    if ('ping' == packet.type && 'probe' == packet.data) {
      transport.send([{ type: 'pong', data: 'probe' }]);
    } else if ('upgrade' == packet.type) {
      debug('got upgrade packet - upgrading');
      self.upgraded = true;
      self.emit('upgrade', transport);
      self.clearTransport();
      self.setTransport(transport);
      self.ping();
      self.flush();
      clearTimeout(upgradeTimeout);
      transport.removeListener('packet', onPacket);
    } else {
      transport.close();
    }
  }
  transport.on('packet', onPacket);
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
  if ('closed' != this.readyState) {
    this.clearTransport();
    this.readyState = 'closed';
    this.emit('close', reason, description);
  }
};

/**
 * Sends a message packet.
 *
 * @param {String} message
 * @return {Socket} for chaining
 * @api public
 */

Socket.prototype.send = function (data) {
  this.sendPacket('message', data);
  return this;
};

/**
 * Sends a packet.
 *
 * @param {String} packet type
 * @param {String} optional, data
 * @api private
 */

Socket.prototype.sendPacket = function (type, data) {
  if ('closing' != this.readyState) {
    debug('sending packet "%s" (%s)', type, data);
    this.writeBuffer.push({ type: type, data: data });
    this.flush();
  }
};

/**
 * Attempts to flush the packets buffer.
 *
 * @api private
 */

Socket.prototype.flush = function () {
  if ('closed' != this.readyState && this.transport.writable) {
    debug('flushing buffer to transport');
    this.transport.send(this.writeBuffer);
    this.writeBuffer = [];
  }
};

/**
 * Closes the socket and underlying transport.
 *
 * @return {Socket} for chaining
 * @api public
 */

Socket.prototype.close = function () {
  if ('open' == this.readyState) {
    this.readyState = 'closing';
    var self = this;
    this.transport.close(function () {
      self.onClose('forced close');
    });
  }
};
