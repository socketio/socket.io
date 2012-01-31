
/**
 * Store. In memory by default.
 *
 * @api public
 */

function Store () {
  this.groups = {};
}

/**
 * Adds id to group.
 *
 * @param {String} client id
 * @param {String} group name
 * @param {Function} event listener
 * @param {Function} callback
 * @api private
 */

Store.prototype.addToGroup = function (id, group, listener, fn) {
  if (!this.groups[group]) {
    this.groups[group] = [];
    this.listeners[group] = {};
  }

  if (!this.listeners[group][id]) {
    this.on('group:' + group, listener);
    this.listeners[group][id] = listener;
    this.groups[group].push(id);
  }

  fn && fn();
};

/**
 * Removes id from group.
 *
 * @api private
 */

Store.prototype.removeFromGroup = function (id, group, fn) {
  if (this.groups[group]) {
    var i = this.groups[group].indexOf(id);
    if (~i) {
      this.groups[group].splice(i, 1);
      this.removeListener('group:' + group, this.listeners[group][id]);
    }
  }

  fn && fn();
};
