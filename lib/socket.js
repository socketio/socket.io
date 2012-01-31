
/**
 * Module dependencies.
 */

var EventEmitter = require('events').EventEmitter;

/**
 * Socket.
 *
 * @api private
 */

function Socket (connection, server) {
  this.connection = connection;
  this.id = this.sid = connection.id;
  this.server = server;
  this.store = this.server.store;

  // group subscriptions
  this.subscriptions = [];

  // join to group for itself
  var self = this;
  this.join(sid, function () {
    self.emit('ready');
  });
}

/**
 * Inherits from EventEmitter.
 */

Socket.prototype.__proto__ = EventEmitter.prototype;

/**
 * Save reference to original `emit`.
 *
 * @api private
 */

Socket.prototype._emit = Socket.prototype.emit;

/**
 * Joins a group.
 *
 * @param {String} group
 * @return {Socket} for chaining
 * @api public
 */

Socket.prototype.join = function (group, fn) {
  if (!~this.subscriptions.indexOf(group)) {
    var self = this;
    this.subscriptions.push(group);
    this.store.addToGroup(group, this.sid, function (ev, args) {
      self.onGroupEvent(ev, args);
    }, fn);
  } else {
    fn && fn();
  }

  return this;
};

/**
 * Leaves a group.
 *
 * @return {Socket} for chaining
 * @api public
 */

Socket.prototype.leave = function (group) {
  var index = this.subscriptions.indexOf(group);
  if (~index) {
    this.subscriptions.splice(index, 1);
  }
  return this;
};

/**
 * Called upon disconnect.
 *
 * @api private
 */

Socket.prototype.onDisconnect = function () {
  for (var i = 0, l = this.subscriptions; i < l; i++) {
    this.store.removeFromGroup(id, group, fn);
  }
};
