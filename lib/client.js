
/**
 * Module dependencies.
 */

var parser = require('socket.io-parser');
var encode = parser.encode;
var decode = parser.decode;
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
  this.id = conn.id;
  this.request = conn.request;
  this.setup();
  this.sockets = [];
  this.nsps = {};
  this.connectBuffer = [];
  this.reconstructor = null;
}

/**
 * Sets up event listeners.
 *
 * @api private
 */

Client.prototype.setup = function(){
  this.onclose = this.onclose.bind(this);
  this.ondata = this.ondata.bind(this);
  this.conn.on('data', this.ondata);
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
  var nsp = this.server.of(name);
  if ('/' != name && !this.nsps['/']) {
    this.connectBuffer.push(name);
    return;
  }

  var self = this;
  var socket = nsp.add(this, function(){
    self.sockets.push(socket);
    self.nsps[nsp.name] = socket;

    if ('/' == nsp.name) {
      self.connectBuffer.forEach(self.connect, self);
      delete self.connectBuffer;
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
 * @api private
 */

Client.prototype.packet = function(packet){
  if ('open' == this.conn.readyState) {
    debug('writing packet %j', packet);
    var self = this;

    encode(packet, function (encodedPackets) { // encode, then write results to engine
      for (var i = 0; i < encodedPackets.length; i++) {
        self.conn.write(encodedPackets[i]);
      }
    });
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
  var self = this;

  function handlePacket(packet) { // handles packet based on type
    if (parser.CONNECT == packet.type) {
      self.connect(packet.nsp);
    } else {
      var socket = self.nsps[packet.nsp];
      if (socket) {
        socket.onpacket(packet);
      } else {
        debug('no socket for namespace %s', packet.nsp);
      }
    }
  }

  if ((global.Buffer && Buffer.isBuffer(data)) ||
      (global.ArrayBuffer && data instanceof ArrayBuffer) ||
      data.base64) { // received binary data
    debug('got binary data');

    if (!this.reconstructor) {
      throw new Error('got binary data when not reconstructing a packet')
    } else {
      var packet = this.reconstructor.takeBinaryData(data);
      if (packet) { // reached the last buffer
        self.reconstructor = null;
        handlePacket(packet);
      }
    }
  } else { // not binary data
    var packet = decode(data);
    debug('got packet %j', packet);

    if (packet.type == parser.BINARY_EVENT) { // the first of a 'buffer sequence'
      self.reconstructor = new parser.BinaryReconstructor(packet);
    } else { // an isolated packet
      handlePacket(packet);
    }
  }
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
  this.sockets.forEach(function(socket){
    socket.onclose(reason);
  });
};

/**
 * Cleans up event listeners.
 *
 * @api private
 */

Client.prototype.destroy = function(){
  this.conn.removeListener('data', this.ondata);
  this.conn.removeListener('close', this.onclose);
};
