
/*!
 * Socket.IO - transports - WebSocket - Parser
 * Copyright (c) 2010-2011 Guillermo Rauch <guillermo@learnboost.com>
 * MIT Licensed
 */

/**
 * Module dependencies.
 */

var EventEmitter = require('events').EventEmitter;

/**
 * Expose `Parser`.
 */

module.exports = Parser;

function Parser(){
  this.buffer = '';
  this.i = 0;
};

Parser.prototype.__proto__ = EventEmitter.prototype;

Parser.prototype.add = function(data){
  this.buffer += data;
  this.parse();
};

Parser.prototype.parse = function(){
  for (var i = this.i, chr, l = this.buffer.length; i < l; i++){
    chr = this.buffer[i];
    if (i === 0){
      if ('\u0000' == chr) continue;
      this.error('Bad framing. Expected null byte as first frame');
    }
    if ('\ufffd' == chr){
      this.emit('data', this.buffer.substr(1, this.buffer.length - 2));
      this.buffer = this.buffer.substr(i + 1);
      this.i = 0;
      return this.parse();
    }
  }
};

Parser.prototype.error = function(reason){
  this.buffer = '';
  this.i = 0;
  this.emit('error', reason);
  return this;
};
