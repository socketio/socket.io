
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
    opts.host = uri.host;
    opts.secure = uri.scheme == 'wss'
    opts.port = uri.port || (opts.secure ? 443 : 80);
  }

  opts = opts || {};

  this.host = opts.host || opts.hostname || 'localhost';
  this.port = opts.port || 80;
  this.query = opts.query || '';
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
 * @param {Object} extra query parameters
 * @return {Transport}
 * @api private
 */

Socket.prototype.createTransport = function (name, queryParams) {
  // debug: creating transport "%s", name
  var query = this.query || {}
  query.transport = name;

  // add extra query params, if any
  if (queryParams) {
    for (var i in queryParams) {
      if (queryParams.hasOwnProperty(i)) {
        query[i] = queryParams[i];
      }
    }
  }

  var transport = new transports[name]({
      host: this.host
    , port: this.port
    , secure: this.secure
    , path: this.path
    , query: query
    , forceJSONP: this.forceJSONP
  }, engine);

  return transport;
};

/**
 * Initializes transport to use and starts probe.
 *
 * @api private
 */

Socket.prototype.open = function () {
  var self = this;

  this.readyState = 'opening';

  // use the first transport always for the first try
  var transport = this.createTransport(this.transports[0]);
  transport.open();
  transport.once('open', function () {
    this.setTransport(transport);
  });

  // if the engine is closed before transport opened, abort it
  this.once('close', function () {
    transport.close();
  });

  // whether we should perform a probe
  if (this.upgrade && this.transports.length > 1 && transport.pause) {
    var probeTransports = this.transports.slice(1);

    for (var i = 0, l = probeTransports.length; i < l; i++) {
      this.probe(probeTransports[i]);
    }
  }
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
    // this already fired for an upgrade, so we don't have to worry
    .on('open', function () {
      self.onOpen();
    })
    .on('message', function (data) {
      self.onMessage(msg);
    })
    .on('close', function () {
      self.onClose();
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
  var transport = this.createTransport(name)
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
 * Opens the connection
 *
 * @api public
 */

Socket.prototype.open = function () {
  if ('' == this.readyState || 'closed' == this.readyState) {
    this.transport.open()
  }

  return this;
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
 * Handles a message.
 *
 * @api private
 */

Socket.prototype.onMessage = function (msg) {
  // debug: socket receive: type "%s" | data "%s", msg.type, msg.data
  switch (msg.type) {
    case 'noop':
      break;

    case 'ping':
      this.sendPacket('pong');
      break;

    case 'error':
      var err = new Error('server error');
      err.code = msg.data;
      this.emit('error', err);
      break;

    case 'message':
      this.emit('message', msg.data);
      this.onmessage && this.onmessage.call(this, msg.data);
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
