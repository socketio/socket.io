/**
 * Module dependencies.
 */

var transports = require('./transports');
var Emitter = require('component-emitter');
var debug = require('debug')('engine.io-client:socket');
var index = require('indexof');
var parser = require('engine.io-parser');
var parseuri = require('parseuri');
var parsejson = require('parsejson');
var parseqs = require('parseqs');

/**
 * Module exports.
 */

module.exports = Socket;

/**
 * Noop function.
 *
 * @api private
 */

function noop(){}

/**
 * Socket constructor.
 *
 * @param {String|Object} uri or options
 * @param {Object} options
 * @api public
 */

function Socket(uri, opts){
  if (!(this instanceof Socket)) return new Socket(uri, opts);

  var self = this;
  opts = opts || {};

  if (uri && 'object' == typeof uri) {
    opts = uri;
    uri = null;
  }

  if (uri) {
    uri = parseuri(uri);
    opts.host = uri.host;
    opts.secure = uri.protocol == 'https' || uri.protocol == 'wss';
    opts.port = uri.port;
    if (uri.query) opts.query = uri.query;
  }

  self.secure = null != opts.secure ? opts.secure :
    (global.location && 'https:' == location.protocol);

  if (opts.host) {
    var pieces = opts.host.split(':');
    opts.hostname = pieces.shift();
    if (pieces.length) opts.port = pieces.pop();
  }

  self.agent = opts.agent || false;
  self.hostname = opts.hostname ||
    (global.location ? location.hostname : 'localhost');
  self.port = opts.port || (global.location && location.port ?
       location.port :
       (self.secure ? 443 : 80));
  self.query = opts.query || {};
  if ('string' == typeof self.query) self.query = parseqs.decode(self.query);
  self.upgrade = false !== opts.upgrade;
  self.path = (opts.path || '/engine.io').replace(/\/$/, '') + '/';
  self.forceJSONP = !!opts.forceJSONP;
  self.jsonp = false !== opts.jsonp;
  self.forceBase64 = !!opts.forceBase64;
  self.enablesXDR = !!opts.enablesXDR;
  self.timestampParam = opts.timestampParam || 't';
  self.timestampRequests = opts.timestampRequests;
  self.transports = opts.transports || ['polling', 'websocket'];
  self.readyState = '';
  self.writeBuffer = [];
  self.callbackBuffer = [];
  self.policyPort = opts.policyPort || 843;
  self.rememberUpgrade = opts.rememberUpgrade || false;
  self.binaryType = null;
  self.onlyBinaryUpgrades = opts.onlyBinaryUpgrades;

  // SSL options for Node.js client
  self.pfx = opts.pfx || null;
  self.key = opts.key || null;
  self.passphrase = opts.passphrase || null;
  self.cert = opts.cert || null;
  self.ca = opts.ca || null;
  self.ciphers = opts.ciphers || null;
  self.rejectUnauthorized = opts.rejectUnauthorized || null;

  self.open();
}

Socket.priorWebsocketSuccess = false;

/**
 * Mix in `Emitter`.
 */

Emitter(Socket.prototype);

/**
 * Protocol version.
 *
 * @api public
 */

Socket.protocol = parser.protocol; // this is an int

/**
 * Expose deps for legacy compatibility
 * and standalone browser access.
 */

Socket.Socket = Socket;
Socket.Transport = require('./transport');
Socket.transports = require('./transports');
Socket.parser = require('engine.io-parser');

/**
 * Creates transport of the given type.
 *
 * @param {String} transport name
 * @return {Transport}
 * @api private
 */

Socket.prototype.createTransport = function (name) {
  var self = this;
  debug('creating transport "%s"', name);
  var query = clone(self.query);

  // append engine.io protocol identifier
  query.EIO = parser.protocol;

  // transport name
  query.transport = name;

  // session id if we already have one
  if (self.id) query.sid = self.id;

  var transport = new transports[name]({
    agent: self.agent,
    hostname: self.hostname,
    port: self.port,
    secure: self.secure,
    path: self.path,
    query: query,
    forceJSONP: self.forceJSONP,
    jsonp: self.jsonp,
    forceBase64: self.forceBase64,
    enablesXDR: self.enablesXDR,
    timestampRequests: self.timestampRequests,
    timestampParam: self.timestampParam,
    policyPort: self.policyPort,
    socket: self,
    pfx: self.pfx,
    key: self.key,
    passphrase: self.passphrase,
    cert: self.cert,
    ca: self.ca,
    ciphers: self.ciphers,
    rejectUnauthorized: self.rejectUnauthorized
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
  var self = this;
  var transport;
  if (self.rememberUpgrade && Socket.priorWebsocketSuccess && self.transports.indexOf('websocket') != -1) {
    transport = 'websocket';
  } else if (0 == self.transports.length) {
    // Emit error on next tick so it can be listened to
    setTimeout(function() {
      self.emit('error', 'No transports available');
    }, 0);
    return;
  } else {
    transport = self.transports[0];
  }
  self.readyState = 'opening';

  // Retry with the next transport if the transport is disabled (jsonp: false)
  var transport;
  try {
    transport = self.createTransport(transport);
  } catch (e) {
    self.transports.shift();
    self.open();
    return;
  }

  transport.open();
  self.setTransport(transport);
};

/**
 * Sets the current transport. Disables the existing one (if any).
 *
 * @api private
 */

Socket.prototype.setTransport = function(transport){
  debug('setting transport %s', transport.name);
  var self = this;

  if (self.transport) {
    debug('clearing existing transport %s', self.transport.name);
    self.transport.removeAllListeners();
  }

  // set up transport
  self.transport = transport;

  // set up transport listeners
  transport
  .on('drain', function(){
    self.onDrain();
  })
  .on('packet', function(packet){
    self.onPacket(packet);
  })
  .on('error', function(e){
    self.onError(e);
  })
  .on('close', function(){
    self.onClose('transport close');
  });
};

/**
 * Probes a transport.
 *
 * @param {String} transport name
 * @api private
 */

Socket.prototype.probe = function (name) {
  debug('probing transport "%s"', name);
  var self = this;
  var transport = self.createTransport(name, { probe: 1 });
  var failed = false;

  Socket.priorWebsocketSuccess = false;

  function onTransportOpen(){
    if (self.onlyBinaryUpgrades) {
      var upgradeLosesBinary = !self.supportsBinary && self.transport.supportsBinary;
      failed = failed || upgradeLosesBinary;
    }
    if (failed) return;

    debug('probe transport "%s" opened', name);
    transport.send([{ type: 'ping', data: 'probe' }]);
    transport.once('packet', function (msg) {
      if (failed) return;
      if ('pong' == msg.type && 'probe' == msg.data) {
        debug('probe transport "%s" pong', name);
        self.upgrading = true;
        self.emit('upgrading', transport);
        if (!transport) return;
        Socket.priorWebsocketSuccess = 'websocket' == transport.name;

        debug('pausing current transport "%s"', self.transport.name);
        self.transport.pause(function () {
          if (failed) return;
          if ('closed' == self.readyState) return;
          debug('changing transport and sending upgrade packet');

          cleanup();

          self.setTransport(transport);
          transport.send([{ type: 'upgrade' }]);
          self.emit('upgrade', transport);
          transport = null;
          self.upgrading = false;
          self.flush();
        });
      } else {
        debug('probe transport "%s" failed', name);
        var err = new Error('probe error');
        err.transport = transport.name;
        self.emit('upgradeError', err);
      }
    });
  }

  function freezeTransport() {
    if (failed) return;

    // Any callback called by transport should be ignored since now
    failed = true;

    cleanup();

    transport.close();
    transport = null;
  }

  //Handle any error that happens while probing
  function onerror(err) {
    var error = new Error('probe error: ' + err);
    error.transport = transport.name;

    freezeTransport();

    debug('probe transport "%s" failed because of error: %s', name, err);

    self.emit('upgradeError', error);
  }

  function onTransportClose(){
    onerror("transport closed");
  }

  //When the socket is closed while we're probing
  function onclose(){
    onerror("socket closed");
  }

  //When the socket is upgraded while we're probing
  function onupgrade(to){
    if (transport && to.name != transport.name) {
      debug('"%s" works - aborting "%s"', to.name, transport.name);
      freezeTransport();
    }
  }

  //Remove all listeners on the transport and on self
  function cleanup(){
    transport.removeListener('open', onTransportOpen);
    transport.removeListener('error', onerror);
    transport.removeListener('close', onTransportClose);
    self.removeListener('close', onclose);
    self.removeListener('upgrading', onupgrade);
  }

  transport.once('open', onTransportOpen);
  transport.once('error', onerror);
  transport.once('close', onTransportClose);

  self.once('close', onclose);
  self.once('upgrading', onupgrade);

  transport.open();

};

/**
 * Called when connection is deemed open.
 *
 * @api public
 */

Socket.prototype.onOpen = function () {
  debug('socket open');
  var self = this;
  self.readyState = 'open';
  Socket.priorWebsocketSuccess = 'websocket' == self.transport.name;
  self.emit('open');
  self.flush();

  // we check for `readyState` in case an `open`
  // listener already closed the socket
  if ('open' == self.readyState && self.upgrade && self.transport.pause) {
    debug('starting upgrade probes');
    for (var i = 0, l = self.upgrades.length; i < l; i++) {
      self.probe(self.upgrades[i]);
    }
  }
};

/**
 * Handles a packet.
 *
 * @api private
 */

Socket.prototype.onPacket = function (packet) {
  var self = this;
  if ('opening' == self.readyState || 'open' == self.readyState) {
    debug('socket receive: type "%s", data "%s"', packet.type, packet.data);

    self.emit('packet', packet);

    // Socket is live - any packet counts
    self.emit('heartbeat');

    switch (packet.type) {
      case 'open':
        self.onHandshake(parsejson(packet.data));
        break;

      case 'pong':
        self.setPing();
        break;

      case 'error':
        var err = new Error('server error');
        err.code = packet.data;
        self.emit('error', err);
        break;

      case 'message':
        self.emit('data', packet.data);
        self.emit('message', packet.data);
        break;
    }
  } else {
    debug('packet received with socket readyState "%s"', self.readyState);
  }
};

/**
 * Called upon handshake completion.
 *
 * @param {Object} handshake obj
 * @api private
 */

Socket.prototype.onHandshake = function (data) {
  var self = this;
  self.emit('handshake', data);
  self.id = data.sid;
  self.transport.query.sid = data.sid;
  self.upgrades = self.filterUpgrades(data.upgrades);
  self.pingInterval = data.pingInterval;
  self.pingTimeout = data.pingTimeout;
  self.onOpen();
  // In case open handler closes socket
  if  ('closed' == self.readyState) return;
  self.setPing();

  // Prolong liveness of socket on heartbeat
  self.removeListener('heartbeat', self.onHeartbeat);
  self.on('heartbeat', self.onHeartbeat);
};

/**
 * Resets ping timeout.
 *
 * @api private
 */

Socket.prototype.onHeartbeat = function (timeout) {
  var self = this;
  clearTimeout(self.pingTimeoutTimer);
  self.pingTimeoutTimer = setTimeout(function () {
    if ('closed' == self.readyState) return;
    self.onClose('ping timeout');
  }, timeout || (self.pingInterval + self.pingTimeout));
};

/**
 * Pings server every `this.pingInterval` and expects response
 * within `this.pingTimeout` or closes connection.
 *
 * @api private
 */

Socket.prototype.setPing = function () {
  var self = this;
  clearTimeout(self.pingIntervalTimer);
  self.pingIntervalTimer = setTimeout(function () {
    debug('writing ping packet - expecting pong within %sms', self.pingTimeout);
    self.ping();
    self.onHeartbeat(self.pingTimeout);
  }, self.pingInterval);
};

/**
* Sends a ping packet.
*
* @api public
*/

Socket.prototype.ping = function () {
  this.sendPacket('ping');
};

/**
 * Called on `drain` event
 *
 * @api private
 */

Socket.prototype.onDrain = function() {
  var self = this;
  for (var i = 0; i < self.prevBufferLen; i++) {
    if (self.callbackBuffer[i]) {
      self.callbackBuffer[i]();
    }
  }

  self.writeBuffer.splice(0, self.prevBufferLen);
  self.callbackBuffer.splice(0, self.prevBufferLen);

  // setting prevBufferLen = 0 is very important
  // for example, when upgrading, upgrade packet is sent over,
  // and a nonzero prevBufferLen could cause problems on `drain`
  self.prevBufferLen = 0;

  if (self.writeBuffer.length == 0) {
    self.emit('drain');
  } else {
    self.flush();
  }
};

/**
 * Flush write buffers.
 *
 * @api private
 */

Socket.prototype.flush = function () {
  var self = this;
  if ('closed' != self.readyState && self.transport.writable &&
    !self.upgrading && self.writeBuffer.length) {
    debug('flushing %d packets in socket', self.writeBuffer.length);
    self.transport.send(self.writeBuffer);
    // keep track of current length of writeBuffer
    // splice writeBuffer and callbackBuffer on `drain`
    self.prevBufferLen = self.writeBuffer.length;
    self.emit('flush');
  }
};

/**
 * Sends a message.
 *
 * @param {String} message.
 * @param {Function} callback function.
 * @return {Socket} for chaining.
 * @api public
 */

Socket.prototype.write =
Socket.prototype.send = function (msg, fn) {
  this.sendPacket('message', msg, fn);
  return this;
};

/**
 * Sends a packet.
 *
 * @param {String} packet type.
 * @param {String} data.
 * @param {Function} callback function.
 * @api private
 */

Socket.prototype.sendPacket = function (type, data, fn) {
  var self = this;
  if ('closing' == self.readyState || 'closed' == self.readyState) {
    return;
  }

  var packet = { type: type, data: data };
  self.emit('packetCreate', packet);
  self.writeBuffer.push(packet);
  self.callbackBuffer.push(fn);
  self.flush();
};

/**
 * Closes the connection.
 *
 * @api private
 */

Socket.prototype.close = function () {
  var self = this;
  if ('opening' == self.readyState || 'open' == self.readyState) {
    this.readyState = 'closing';

    function close() {
      self.onClose('forced close');
      debug('socket closing - telling transport to close');
      self.transport.close();
    }

    function cleanupAndClose() {
      self.removeListener('upgrade', cleanupAndClose);
      self.removeListener('upgradeError', cleanupAndClose);
      close();
    }

    function waitForUpgrade() {
      // wait for upgrade to finish since we can't send packets while pausing a transport
      self.once('upgrade', cleanupAndClose);
      self.once('upgradeError', cleanupAndClose);
    }

    if (self.writeBuffer.length) {
      self.once('drain', function() {
        if (self.upgrading) {
          waitForUpgrade();
        } else {
          close();
        }
      });
    } else if (self.upgrading) {
      waitForUpgrade();
    } else {
      close();
    }
  }

  return self;
};

/**
 * Called upon transport error
 *
 * @api private
 */

Socket.prototype.onError = function (err) {
  debug('socket error %j', err);
  Socket.priorWebsocketSuccess = false;
  this.emit('error', err);
  this.onClose('transport error', err);
};

/**
 * Called upon transport close.
 *
 * @api private
 */

Socket.prototype.onClose = function (reason, desc) {
  var self = this;
  if ('opening' == this.readyState || 'open' == this.readyState || 'closing' == this.readyState) {
    debug('socket close with reason: "%s"', reason);

    // clear timers
    clearTimeout(self.pingIntervalTimer);
    clearTimeout(self.pingTimeoutTimer);

    // clean buffers in next tick, so developers can still
    // grab the buffers on `close` event
    setTimeout(function() {
      self.writeBuffer = [];
      self.callbackBuffer = [];
      self.prevBufferLen = 0;
    }, 0);

    // stop event from firing again for transport
    self.transport.removeAllListeners('close');

    // ensure transport won't stay open
    self.transport.close();

    // ignore further transport communication
    self.transport.removeAllListeners();

    // set ready state
    self.readyState = 'closed';

    // clear session id
    self.id = null;

    // emit close event
    self.emit('close', reason, desc);
  }
};

/**
 * Filters upgrades, returning only those matching client transports.
 *
 * @param {Array} server upgrades
 * @api private
 *
 */

Socket.prototype.filterUpgrades = function (upgrades) {
  var filteredUpgrades = [];
  for (var i = 0, j = upgrades.length; i<j; i++) {
    if (~index(this.transports, upgrades[i])) filteredUpgrades.push(upgrades[i]);
  }
  return filteredUpgrades;
};
