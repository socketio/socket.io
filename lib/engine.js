
/**
 * Module exports.
 */

module.exports = exports = Engine;

/**
 * Export Transport.
 */

exports.Transport = require('./transport');

/**
 * Export transports
 */

var transports = exports.transports = require('./transports');

/**
 * Export utils.
 */

exports.util = require('./util')

/**
 * Engine constructor.
 *
 * @param {Object} options
 * @api public
 */

function Engine (opts) {
  opts = opts || {};

  this.host = opts.host || opts.hostname || 'localhost';
  this.port = opts.port || 80;
  this.upgrade = false !== opts.upgrade;
  this.path = opts.path || '/engine.io'
  this.forceJSONP = !!opts.forceJSONP;
  this.transports = opts.transports || ['polling', 'websocket', 'flashsocket'];
  this.readyState = '';

  // handle inline function events (eg: `onopen`)
  var evs = ['open', 'message', 'close']
    , self = this

  for (var i = 0, l = evs.length; i < l; i++) {
    (function (ev) {
      self.on(ev, function () {
        if (self['on' + ev]) {
          self['on' + ev].apply(this, arguments);
        }
      });
    })(evs[i]);
  }

  this.init();
};

/**
 * Initializes transport to use and starts probe.
 *
 * @api private
 */

Engine.prototype.init = function () {
  // use the first transport always for the first try
  this.setTransport(this.transports[0]);

  var self = this;

  // whether we should perform a probe
  if (this.upgrade && this.transports.length > 1) {
    var probeTransports = this.transports.slice(1)
      , probes = []

    function abort () {
      for (var i = 0, l = probes.length; i++) {
        probes[i].close();
      }
    }

    for (var i = 0, l = probeTransports.length; i < l; i++) {
      (function (i) {
        var id = probeTransports[i]

        probes.push(this.probe(id, function (err) {
          probes.splice(i, 1);

          if (err) {
            self.emit('error', err);
            self.log.debug('probing transport "%s" failed', id);
          } else {
            self.setTransport(probeTransports[i]);
            abort();
          }
        }));
      })();
    }
  }

  // flush write buffers
  function flush () {
    if (self.writeBuffer.length) {
      // make sure to transfer the buffer to the transport
      self.transport.buffer = true;
      for (var i = 0, l = self.writeBuffer.length; i < l; i++) {
        self.transport.send(self.writeBuffer[i]);
      }
      self.transport.flush();
    }
  }

  this.on('open', flush);
  this.on('upgrade', flush);
};

/**
 * Sets the current transport. Disables the existing one (if any).
 *
 * @api private
 */

Engine.prototype.setTransport = function (id) {
  var self = this;

  function set () {
    // make sure to set upgrading state
    self.upgrading = false;

    // set up transport
    self.transportId = id;
    self.transport = new transports[id]({
        host: self.host
      , port: self.port
      , secure: self.secure
      , path: self.path
      , query: 'transport=' + id + (self.query ? '&' + self.query : '')
      , forceJSONP: self.forceJSONP
    });

    // emit upgrade event
    self.emit('upgrade', id);

    // set up transport listeners
    self.transport.on('data', function (data) {
      self.onMessage(parser.decodePacket(data));
    });
    self.transport.on('close', function () {
      self.onClose();
    });
    self.transport.open();
  };

  if (this.transport) {
    // upgrade transports
    if (!this.transport.pause) {
      this.emit('error', new Error('Transport "' + this.transportId
        + '" can\'t be upgraded.'));
      return;
    }

    this.upgrading = true;
    this.transport.pause(set);
  } else {
    // first open
    this.readyState = 'opening';
    set();
  }
};

/**
 * Probes a tranposrt
 *
 * @param {String} transport id
 * @param {Function} callback
 * @api private
 */

Engine.prototype.probe = function (id, fn) {
  this.log.debug('probing transport "%s"', id);

  var transport = new transports[id]({
      host: this.host
    , port: this.port
    , secure: this.secure
    , path: this.path
    , query: 'transport=' id
  });

  transport.once('open', function () {
    transport.write(parser.encodePacket('probe'));
    transport.once('data', function (data) {
      if ('probe' == parser.decodePacket(data).type) {
        fn();
      } else {
        var err = new Error('probe fail');
        err.transport = id;
        fn(err);
      }
    });
  });

  return transport;
};

/**
 * Opens the connection
 *
 * @api public
 */

Engine.prototype.open = function () {
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

Engine.prototype.onOpen = function () {
  this.readyState = 'open';
  this.emit('open');
};

/**
 * Handles a message.
 *
 * @api private
 */

Engine.prototype.onMessage = function (msg) {
  switch (msg.type) {
    case 'open':
      this.onOpen();
      break;

    case 'heartbeat':
      this.writePacket('heartbeat');
      break;
  }
};

/**
 * Sends a message.
 *
 * @param {String} message.
 * @return {Engine} for chaining.
 * @api public
 */

Engine.prototype.send = function (msg) {
  this.writePacket('message', msg);
  return this;
};

/**
 * Encodes a packet and writes it out.
 *
 * @param {String} packet type.
 * @param {String} data.
 * @api private
 */

Engine.prototype.writePacket = function (type, data) {
  this.write(parser.encodePacket(type, data));
};

/**
 * Writes data.
 *
 * @api private
 */

Engine.prototype.write = function (data) {
  if ('open' != this.readyState || this.upgrading) {
    this.writeBuffer.push(data);
  } else {
    this.transport.send(data);
  }
};

/**
 * Closes the connection.
 *
 * @api private
 */

Engine.prototype.close = function () {
  if ('opening' == this.readyState || 'open' == this.readyState) {
    this.transport.close();
  }
  return this;
};

/**
 * Called upon transport close.
 *
 * @api private
 */

Engine.prototype.onClose = function () {
  this.readyState = 'closed';
  this.emit('close');
};
