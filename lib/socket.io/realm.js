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
      fn.call(self, new RealmClient(self.name, conn));
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

/**
 * Pseudo-client constructor
 *
 * @param {Client} Actual client
 * @api public
 */

function RealmClient(name, client){
  this.name = name;
  this.client = client;
};

/**
 * Override Client#on to filter messages from our realm
 *
 * @param {String} ev name
 * @param {Function) callback
 */

RealmClient.prototype.on = function(ev, fn){
  var self = this;
  if (ev == 'message')
    this.client.on('message', function(msg, atts){
      if (atts.r == self.name)
        fn.call(self, msg, atts);
    });
  else
    this.client.on(ev, fn);
  return this;
};

/**
 * Client#send wrapper with realm annotations
 *
 * @param {String} message
 * @param {Object} annotations
 * @apu public
 */

RealmClient.prototype.send = function(message, anns){
  anns = anns || {};
  anns['r'] = this.name;
  return this.client.send(message, anns);
};

/**
 * Client#send wrapper with realm annotations
 *
 * @param {String} message
 * @param {Object} annotations
 * @apu public
 */

RealmClient.prototype.sendJSON = function(message, anns){
  anns = anns || {};
  anns['r'] = this.name;
  return this.client.sendJSON(message, anns);
};

/**
 * Client#send wrapper with realm annotations
 *
 * @param {String} message
 * @param {Object} annotations
 * @apu public
 */

RealmClient.prototype.broadcast = function(message, anns){
  anns = anns || {};
  anns['r'] = this.name;
  return this.client.broadcast(message, anns);
};

/**
 * Proxy some properties to the client
 */

['connected', 'options', 'connections', 'listener'].forEach(function(p){
  RealmClient.prototype.__defineGetter__(p, function(){
    return this.client[p];
  });
});

/**
 * Module exports
 */

module.exports = Realm;
module.exports.Client = RealmClient;
