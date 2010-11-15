/**
 * Pseudo-listener constructor
 *
 * @param {String} realm name
 * @param {Listener} listener the realm belongs to
 * @api public
 */

function Realm(name, listener){
  this.name = name;
  this.listener = listener;
}

/**
 * Override connection event so that client.send() appends the realm annotation
 *
 * @param {String} ev name
 * @param {Function} callback
 * @api public
 */

Realm.prototype.on = function(ev, fn){
  var self = this;
  if (ev == 'connection')
    this.listener.on('connection', function(conn){
      // Monkey-patch conn#send
      var oldSend = conn.send;
      conn.send = function(msg, atts){
        atts = atts || {};
        atts['r'] = self.name;
        return oldSend.call(conn, msg, atts);
      };

      // Make sure to only relay messages with the realm annotation
      var oldOn = conn.on;
      conn.on = function(ev, fn){
        if (ev == 'message')
          return oldOn.call(this, ev, function(msg, atts){
            if (atts.r == self.name)
              fn.call(conn, msg, atts);
          });
        else
          return oldOn.call(this, ev, fn);
      };
      
      fn.call(self, conn);
    });
  else
    this.listener.on(ev, fn);
  return this;
};

/**
 * Broadcast a message annotated for this realm
 *
 * @param {String} message
 * @param {Array/String} except
 * @param {Object} message annotations
 * @api public
 */

Realm.prototype.broadcast = function(message, except, atts){
  atts = atts || {};
  atts['r'] = this.name;
  this.listener.broadcast(message, except, atts);
  return this;
};

/**
 * List of properties to proxy to the listener
 */

['clients', 'options', 'server'].forEach(function(p){
  Realm.prototype.__defineGetter__(p, function(){
    return this.listener[p];
  });
});

/**
 * List of methods to proxy to the listener
 */

['realm'].forEach(function(m){
  Realm.prototype[m] = function(){
    return this.listener[m].apply(this.listener, arguments);
  };
});
