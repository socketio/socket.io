
/**
 * Module dependencies.
 */

var util = require('./util')
  , transports = require('./transports')
  , EventEmitter = require('./event-emitter')

/**
 * Module exports.
 */

module.exports = Socket;

/**
 * Socket constructor.
 *
 * @param {Object} options
 * @api public
 */

function Socket (opts) {
  if ('string' == typeof opts) {
    var uri = util.parseUri(opts);
    opts = arguments[1] || {};
    opts.host = uri.host;
    opts.secure = uri.scheme == 'https' || uri.scheme == 'wss';
    opts.port = uri.port || (opts.secure ? 443 : 80);
  }

  opts = opts || {};

  this.host = opts.host || opts.hostname || 'localhost';
  this.port = opts.port || 80;
  this.query = opts.query || {};
  this.upgrade = false !== opts.upgrade;
  this.path = opts.path || '/engine.io'
  this.forceJSONP = !!opts.forceJSONP;
  this.transports = opts.transports || ['polling', 'websocket', 'flashsocket'];
  this.readyState = '';
  this.writeBuffer = [];

  this.open();
};

/**
 * Inherits from EventEmitter.
 */

util.inherits(Socket, EventEmitter);

/**
 * Creates transport of the given type.
 *
 * @param {String} transport name
 * @return {Transport}
 * @api private
 */

Socket.prototype.createTransport = function (name) {
  // debug: creating transport "%s", name
  var query = clone(this.query)
  query.transport = name;

  if (this.sid) {
    query.sid = this.sid;
  }

  var transport = new transports[name]({
      host: this.host
    , port: this.port
    , secure: this.secure
    , path: this.path
    , query: query
    , forceJSONP: this.forceJSONP
  });

  return transport;
};

function clone (obj) {
  var o = {};
  for (var i in obj) {
    if (obj.hasOwnProperty(i)) {
      o[i] = obj[i];
    }
  }
  return o;
}

/**
 * Initializes transport to use and starts probe.
 *
 * @api private
 */

Socket.prototype.open = function () {
  this.readyState = 'opening';
  var transport = this.createTransport(this.transports[0]);
  transport.open();
  this.setTransport(transport);
};

/**
 * Sets the current transport. Disables the existing one (if any).
 *
 * @api private
 */

Socket.prototype.setTransport = function (transport) {
  var self = this;

  if (this.transport) {
    // debug: clearing existing transport
    this.transport.removeAllListeners();
  }

  // set up transport
  this.transport = transport;

  // set up transport listeners
  transport
    .on('packet', function (packet) {
      self.onPacket(packet);
    })
    .on('error', function (e) {
      self.onError(e);
    })
    .on('close', function () {
      self.onClose('transport close');
    })
};

/**
 * Probes a transport.
 *
 * @param {String} transport name
 * @api private
 */

Socket.prototype.probe = function (name) {
  // debug: probing transport "%s", name
  var transport = this.createTransport(name, { probe: 1 })
    , self = this

  transport.once('open', function () {
    // debug: probe transport "%s" opened - pinging, name
    transport.send({ type: 'ping', data: 'probe' });
    transport.once('message', function (msg) {
      if ('pong' == msg.type && 'probe' == msg.data) {
        // debug: probe transport "%s" pong - upgrading, name
        self.upgrading = true;
        self.emit('upgrading', name);

        // debug: pausing current transport "%s", self.transport.name
        self.transport.pause(function () {
          self.setTransport(self.transport);
          self.upgrading = false;
          self.emit('upgrade', name);
        });
      } else {
        // debug: probe transport "%s" failed, name
        var err = new Error('probe error');
        err.transport = transport.name;
        self.emit('error', err);
      }
    });
  });

  transport.open();

  this.once('close', function () {
    // debug: socket closed prematurely - aborting probe
    transport.close();
  });

  this.once('upgrading', function (to) {
    if (to != name) {
      // debug: probe for "%s" succeeded - aborting "%s", to, name
      transport.close();
    }
  });
};

/**
 * Called when connection is deemed open.
 *
 * @api public
 */

Socket.prototype.onOpen = function () {
  // debug: socket open
  this.readyState = 'open';
  this.emit('open');
  this.onopen && this.onopen.call(this);
  this.flush();
};

/**
 * Handles a packet.
 *
 * @api private
 */

Socket.prototype.onPacket = function (packet) {
  // debug: socket receive: type "%s" | data "%s", packet.type, packet.data
  switch (packet.type) {
    case 'noop':
      break;

    case 'ping':
      this.sendPacket('pong');
      break;

    case 'error':
      var err = new Error('server error');
      err.code = packet.data;
      this.emit('error', err);
      break;

    case 'message':
      this.emit('message', packet.data);
      this.onmessage && this.onmessage.call(this, packet.data);
      break;
  }
};

/**
 * Flush write buffers.
 *
 * @api private
 */

Socket.prototype.flush = function () {
  if (this.writeBuffer.length) {
    // debug: flushing %d packets in socket, this.writeBuffer.length

    // make sure to transfer the buffer to the transport
    this.transport.buffer = true;

    for (var i = 0, l = this.writeBuffer.length; i < l; i++) {
      this.transport.send(this.writeBuffer[i]);
    }

    // force transport flush
    this.transport.flush();
  }
};

/**
 * Sends a message.
 *
 * @param {String} message.
 * @return {Socket} for chaining.
 * @api public
 */

Socket.prototype.send = function (msg) {
  this.sendPacket('message', msg);
  return this;
};

/**
 * Sends a packet.
 *
 * @param {String} packet type.
 * @param {String} data.
 * @api private
 */

Socket.prototype.sendPacket = function (type, data) {
  var packet = { type: type, data: data };
  if ('open' != this.readyState || this.upgrading) {
    // debug: socket send - buffering packet: type "%s" | data "%s", type, data
    this.writeBuffer.push(packet);
  } else {
    // debug: socket send - transporting: type "%s" | data "%s", type, data
    this.transport.send(packet);
  }
};

/**
 * Closes the connection.
 *
 * @api private
 */

Socket.prototype.close = function () {
  if ('opening' == this.readyState || 'open' == this.readyState) {
    if (this.transport) {
      // debug: socket closing - telling transport to close
      this.transport.close();
    }

    this.onClose();
  }

  return this;
};

/**
 * Called upon transport close.
 *
 * @api private
 */

Socket.prototype.onClose = function () {
  // debug: socket close
  this.readyState = 'closed';
  this.emit('close');
  this.onclose && this.onclose.call(this);
};
