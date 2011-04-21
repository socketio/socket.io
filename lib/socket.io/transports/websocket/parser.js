
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

/**
 * Initialize a new `Parser`.
 *
 * @api private
 */

function Parser(){
  this.reset();
};

/**
 * Inherit from `EventEmitter.prototype`.
 */

Parser.prototype.__proto__ = EventEmitter.prototype;

/**
 * Write `data`.
 *
 * @param {String} data
 * @api private
 */

Parser.prototype.write = function(data){
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

/**
 * Reset parser state.
 *
 * @api private
 */

Parser.prototype.reset = function(){
  this.i = 0;
  this.buffer = '';
};

/**
 * Emit an error `msg`, and reset the parser.
 *
 * @param {String} msg
 * @api private
 */

Parser.prototype.error = function(msg){
  this.buffer = '';
  this.i = 0;
  this.emit('error', msg);
};
