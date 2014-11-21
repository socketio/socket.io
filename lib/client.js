
/**
 * Module dependencies.
 */

var parser = require('socket.io-parser');
var debug = require('debug')('socket.io:client');

/**
 * Module exports.
 */

module.exports = Client;

/**
 * Client constructor.
 *
 * @param {Server} server instance
 * @param {Socket} connection
 * @api private
 */

function Client(server, conn){
  this.server = server;
  this.conn = conn;
  this.encoder = new parser.Encoder();
  this.decoder = new parser.Decoder();
  this.id = conn.id;
  this.request = conn.request;
  this.setup();
  this.sockets = [];
  this.nsps = {};
  this.connectBuffer = [];
}

/**
 * Sets up event listeners.
 *
 * @api private
 */

Client.prototype.setup = function(){
  this.onclose = this.onclose.bind(this);
  this.ondata = this.ondata.bind(this);
  this.onerror = this.onerror.bind(this);
  this.ondecoded = this.ondecoded.bind(this);

  this.decoder.on('decoded', this.ondecoded);
  this.conn.on('data', this.ondata);
  this.conn.on('error', this.onerror);
  this.conn.on('close', this.onclose);
};

/**
 * Connects a client to a namespace.
 *
 * @param {String} namespace name
 * @api private
 */

Client.prototype.connect = function(name){
  debug('connecting to namespace %s', name);
  if (!this.server.nsps[name]) {
    this.packet({ type: parser.ERROR, nsp: name, data : 'Invalid namespace'});
    return;
  }
  var nsp = this.server.of(name);
  if ('/' != name && !this.nsps['/']) {
    this.connectBuffer.push(name);
    return;
  }

  var self = this;
  var socket = nsp.add(this, function(){
    self.sockets.push(socket);
    self.nsps[nsp.name] = socket;

    if ('/' == nsp.name && self.connectBuffer.length > 0) {
      self.connectBuffer.forEach(self.connect, self);
      self.connectBuffer = [];
    }
  });
};

/**
 * Disconnects from all namespaces and closes transport.
 *
 * @api private
 */

Client.prototype.disconnect = function(){
  var socket;
  // we don't use a for loop because the length of
  // `sockets` changes upon each iteration
  while (socket = this.sockets.shift()) {
    socket.disconnect();
  }
  this.close();
};

/**
 * Removes a socket. Called by each `Socket`.
 *
 * @api private
 */

Client.prototype.remove = function(socket){
  var i = this.sockets.indexOf(socket);
  if (~i) {
    var nsp = this.sockets[i].nsp.name;
    this.sockets.splice(i, 1);
    delete this.nsps[nsp];
  } else {
    debug('ignoring remove for %s', socket.id);
  }
};

/**
 * Closes the underlying connection.
 *
 * @api private
 */

Client.prototype.close = function(){
  if ('open' == this.conn.readyState) {
    debug('forcing transport close');
    this.conn.close();
    this.onclose('forced server close');
  }
};

/**
 * Writes a packet to the transport.
 *
 * @param {Object} packet object
 * @param {Boolean} whether packet is already encoded
 * @param {Boolean} whether packet is volatile
 * @api private
 */

Client.prototype.packet = function(packet, preEncoded, volatile){
  var self = this;

  // this writes to the actual connection
  function writeToEngine(encodedPackets) {
    if (volatile && !self.conn.transport.writable) return;
    for (var i = 0; i < encodedPackets.length; i++) {
      self.conn.write(encodedPackets[i]);
    }
  }

  if ('open' == this.conn.readyState) {
    debug('writing packet %j', packet);
    if(!preEncoded) { // not broadcasting, need to encode
      this.encoder.encode(packet, function (encodedPackets) { // encode, then write results to engine
        writeToEngine(encodedPackets);
      });
    } else { // a broadcast pre-encodes a packet
      writeToEngine(packet);
    }
  } else {
    debug('ignoring packet write %j', packet);
  }
};

/**
 * Called with incoming transport data.
 *
 * @api private
 */

Client.prototype.ondata = function(data){
  // try/catch is needed for protocol violations (GH-1880)
  try {
    this.decoder.add(data);
  } catch(e) {
    this.onerror(e);
  }
};

/**
 * Called when parser fully decodes a packet.
 *
 * @api private
 */

Client.prototype.ondecoded = function(packet) {
  if (parser.CONNECT == packet.type) {
    this.connect(packet.nsp);
  } else {
    var socket = this.nsps[packet.nsp];
    if (socket) {
      socket.onpacket(packet);
    } else {
      debug('no socket for namespace %s', packet.nsp);
    }
  }
};

/**
 * Handles an error.
 *
 * @param {Objcet} error object
 * @api private
 */

Client.prototype.onerror = function(err){
  this.sockets.forEach(function(socket){
    socket.onerror(err);
  });
  this.onclose('client error');
};

/**
 * Called upon transport close.
 *
 * @param {String} reason
 * @api private
 */

Client.prototype.onclose = function(reason){
  debug('client close with reason %s', reason);

  // ignore a potential subsequent `close` event
  this.destroy();

  // `nsps` and `sockets` are cleaned up seamlessly
  var socket;
  while (socket = this.sockets.shift()) {
    socket.onclose(reason);
  }

  this.decoder.destroy(); // clean up decoder
};

/**
 * Cleans up event listeners.
 *
 * @api private
 */

Client.prototype.destroy = function(){
  this.conn.removeListener('data', this.ondata);
  this.conn.removeListener('error', this.onerror);
  this.conn.removeListener('close', this.onclose);
  this.decoder.removeListener('decoded', this.ondecoded);
};
