
function Server (opts) {
  this.clients = {};
  this.clientsCount = 0;
  this.flags = {};

  // legacy
  this.sockets = this;
}

/**
 * Broadcast flag.
 *
 * @api public
 */

Server.prototype.__defineGetter__('broadcast', function () {
  this.flags.broadcast = true;
});

/**
 * Called with a websocket.io-compatible connection.
 *
 * @param {engine.Socket|wsio.Socket} connection
 * @api public
 */

Server.prototype.onConnection = function (conn) {
  var socket = new Socket(conn, this)
    , self = this

  socket.once('ready', function () {
    self.clients[socket.id] = socket;
    self.emit('connection', socket):
  });
};

Server.prototype.socket =
Server.prototype.client = function (id) {
  return this.clients[id];
};

Server.prototype.emit = function (first_argument) {

};

Server.prototype.in = function () {

};
