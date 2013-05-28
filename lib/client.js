
/**
 * Module dependencies.
 */

var parser = require('socket.io-parser')
  , encode = parser.encode
  , decode = parser.decode
  , debug = require('debug')('socket.io:client');

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
  var self = this;
  var socket = nsp.add(this, function(){
    self.sockets.push(socket);
    self.nsps[nsp.name] = socket;
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
    this.conn.write(encode(packet));
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
  var packet = decode(data.toString());
  debug('got packet %j', packet);

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
