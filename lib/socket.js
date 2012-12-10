
/**
 * Module dependencies.
 */

var parser = require('socket.io-parser')
  , Emitter = require('./emitter')
  , toArray = require('to-array')
  , debug = require('debug')('socket.io-client:socket')
  , bind;

/**
 * Module exports.
 */

module.exports = Socket;

/**
 * Internal events (blacklisted).
 * These events can't be emitted by the user.
 */

var events = [
  'connect',
  'disconnect',
  'open',
  'close',
  'error'
];

/**
 * Shortcut to `Emitter#emit`.
 */

var emit = Emitter.prototype.emit;

/**
 * `Socket` constructor.
 *
 * @api public
 */

function Socket(io, nsp){
  this.io = io;
  this.nsp = nsp;
  this.json = this; // compat
  this.ids = 0;
  this.acks = [];
  this.open();
}

/**
 * Mix in `Emitter`.
 */

Emitter(Socket.prototype);

/**
 * Called upon engine `open`.
 *
 * @api private
 */

Socket.prototype.open =
Socket.prototype.connect = function(){
  this.io.ensureOpen();
  if ('open' == this.io.readyState) this.onopen();
  this.subs = [
    this.io.on('open', bind(this, 'onopen')),
    this.io.on('error', bind(this, 'onerror'))
  ];
};

/**
 * Sends a `message` event.
 *
 * @return {Socket} self
 * @api public
 */

Socket.prototype.send = function(){
  var args = toArray(arguments);
  args.shift('message');
  this.emit.apply(this, args);
  return this;
};

/**
 * Override `emit`.
 * If the event is in `events`, it's emitted normally.
 *
 * @param {String} event name
 * @return {Socket} self
 * @api public
 */

Socket.prototype.emit = function(ev){
  if (~events.indexOf(ev)) {
    emit.apply(this, arguments);
  } else {
    var args = toArray(arguments);
    var packet = { type: parser.EVENT };

    // event name
    args.unshift(ev);

    // event ack callback
    if ('function' == typeof args[args.length - 1]) {
      debug('emitting packet with ack id %d', this.ids);
      packet.id = this.ids++;
      this.acks.push(args.pop());
    }

    packet.args = args;
    this.packet(packet);
  }

  return this;
};

/**
 * Sends a packet.
 *
 * @param {Object} packet
 * @api private
 */

Socket.prototype.packet = function(packet){
  packet.nsp = this.nsp;
  this.io.write(parser.encode(packet));
};

/**
 * Called upon `error`.
 *
 * @param {Object} data
 * @api private
 */

Socket.prototype.onerror = function(data){
  this.emit('error', data);
};

/**
 * "Opens" the socket.
 *
 * @api private
 */

Socket.prototype.onopen = function(){
  this.subs.push(
    this.io.on('packet', bind(this, 'onpacket')),
    this.io.on('close', bind(this, 'onclose')),
    this.io.on('reconnecting', bind(this, 'onreconnecting'))
  );
};

/**
 * Called upon engine `close`.
 *
 * @param {String} reason
 * @api private
 */

Socket.prototype.onclose = function(reason){
  debug('close (%s)', reason);
  this.emit('close', reason);
  this.emit('disconnect', reason);
};

/**
 * Called with socket packet.
 *
 * @param {Object} packet
 * @api private
 */

Socket.prototype.onpacket = function(packet){
  if (packet.nsp != this.nsp) return;

  switch (packet.type) {
    case parser.CONNECT:
      this.onconnect();
      break;

    case parser.EVENT:
      this.onevent(packet);
      break;

    case parser.ACK:
      this.onack(packet);
      break;

    case parser.DISCONNECT:
      this.ondisconnect();
      break;

    case parser.ERROR:
      this.emit('error', packet.data);
      break;
  }
};

/**
 * Called upon a server event.
 *
 * @param {Object} packet
 * @api private
 */

Socket.prototype.onevent = function(packet){
  var args = packet.data || [];
  debug('emitting event %s');

  if (packet.id) {
    debug('attaching ack callback to event');
    args.push(this.ack(packet.id));
  }

  emit.apply(this, args);
};

/**
 * Produces an ack callback to emit with an event.
 *
 * @api private
 */

Socket.prototype.ack = function(){
  var self = this;
  var sent = false;
  return function(){
    // prevent double callbacks
    if (sent) return;
    var args = toArray(arguments);
    debug('sending ack %j', args);
    self.packet({
      type: parser.ACK,
      data: args
    });
  };
};

/**
 * Called upon a server acknowlegement.
 *
 * @param {Object} packet
 * @api private
 */

Socket.prototype.onack = function(packet){
  this.acks[packet.id].apply(this, packet.data);
  delete this.acks[packet.id];
};

/**
 * Called upon server connect.
 *
 * @api private
 */

Socket.prototype.onconnect = function(){
  this.emit('open');
  this.emit('connect');
};

/**
 * Called upon server disconnect.
 *
 * @api private
 */

Socket.prototype.ondisconnect = function(){
  debug('server disconnect (%s)', this.nsp);
  this.destroy();
};

/**
 * Cleans up.
 *
 * @api private
 */

Socket.prototype.destroy = function(){
  debug('destroying socket (%s)', this.nsp);

  // manual close means no reconnect
  for (var i = 0; i < this.subs.length; i++) {
    this.subs[i].destroy();
  }

  // notify manager
  this.io.destroy(this);
};

/**
 * Disconnects the socket manually.
 *
 * @return {Socket} self
 * @api public
 */

Socket.prototype.close =
Socket.prototype.disconnect = function(){
  debug('performing disconnect (%s)', this.nsp);

  this.packet(parser.PACKET_DISCONNECT);

  // manual close means no reconnect
  for (var i = 0; i < this.subs.length; i++) {
    this.subs[i].destroy();
  }

  // notify manager
  this.io.destroy(this);

  // fire events
  this.onclose('io client disconnect');
  return this;
};

/**
 * Load `bind`.
 */

try {
  bind = require('bind');
} catch(e){
  bind = require('bind-component');
}
