/**
 * From https://github.com/felixge/nodelog/
 */

var sys = require('util');
var tcp = require('net');
var irc = exports;

function bind(fn, scope) {
  var bindArgs = Array.prototype.slice.call(arguments);
  bindArgs.shift();
  bindArgs.shift();

  return function() {
    var args = Array.prototype.slice.call(arguments);
    fn.apply(scope, bindArgs.concat(args));
  };
}

function each(set, iterator) {
  for (var i = 0; i < set.length; i++) {
    var r = iterator(set[i], i);
    if (r === false) {
      return;
    }
  }
}

var Client = irc.Client = function(host, port) {
  this.host = host || 'localhost';
  this.port = port || 6667;

  this.connection = null;
  this.buffer = '';
  this.encoding = 'utf8';
  this.timeout = 10 * 60 * 60 * 1000;

  this.nick = null;
  this.user = null;
  this.real = null;
}
sys.inherits(Client, process.EventEmitter);

Client.prototype.connect = function(nick, user, real) {
  var connection = tcp.createConnection(this.port, this.host);
  connection.setEncoding(this.encoding);
  connection.setTimeout(this.timeout);
  connection.addListener('connect', bind(this.onConnect, this));
  connection.addListener('data', bind(this.onReceive, this));
  connection.addListener('end', bind(this.onEof, this));
  connection.addListener('timeout', bind(this.onTimeout, this));
  connection.addListener('close', bind(this.onClose, this));

  this.nick = nick;
  this.user = user || 'guest';
  this.real = real || 'Guest';

  this.connection = connection;
};

Client.prototype.disconnect = function(why) {
  if (this.connection.readyState !== 'closed') {
    this.connection.close();
    sys.puts('disconnected (reason: '+why+')');
    this.emit('DISCONNECT', why);
  }
};

Client.prototype.send = function(arg1) {
  if (this.connection.readyState !== 'open') {
    return this.disconnect('cannot send with readyState: '+this.connection.readyState);
  }

  var message = [];
  for (var i = 0; i< arguments.length; i++) {
    if (arguments[i]) {
      message.push(arguments[i]);
    }
  }
  message = message.join(' ');

  sys.puts('> '+message);
  message = message + "\r\n";
  this.connection.write(message, this.encoding);
};

Client.prototype.parse = function(message) {
  var match = message.match(/(?:(:[^\s]+) )?([^\s]+) (.+)/);
  var parsed = {
    prefix: match[1],
    command: match[2]
  };

  var params = match[3].match(/(.*?) ?:(.*)/);
  if (params) {
    // Params before :
    params[1] = (params[1])
      ? params[1].split(' ')
      : [];
    // Rest after :
    params[2] = params[2]
      ? [params[2]]
      : [];

    params = params[1].concat(params[2]);
  } else {
    params = match[3].split(' ');
  }

  parsed.params = params;
  return parsed;
};

Client.prototype.onConnect = function() {
  this.send('NICK', this.nick);
  this.send('USER', this.user, '0', '*', ':'+this.real);
};

Client.prototype.onReceive = function(chunk) {
  this.buffer = this.buffer + chunk;
  
  while (this.buffer) {
    var offset = this.buffer.indexOf("\r\n");
    if (offset < 0) {
      return;
    }
  
    var message = this.buffer.substr(0, offset);
    this.buffer = this.buffer.substr(offset + 2);
    sys.puts('< '+message);

    message = this.parse(message);

    this.emit.apply(this, [message.command, message.prefix].concat(message.params));

    if (message !== false) {
      this.onMessage(message);
    }
  }
}; 

Client.prototype.onMessage = function(message) {
  switch (message.command) {
    case 'PING':
      this.send('PONG', ':'+message.params[0]);
      break;
  }
};

Client.prototype.onEof = function() {
  this.disconnect('eof');
};

Client.prototype.onTimeout = function() {
  this.disconnect('timeout');
};

Client.prototype.onClose = function() {
  this.disconnect('close');
};

exports.user = function(prefix) {
  return prefix.match(/:([^!]+)!/)[1]
};
