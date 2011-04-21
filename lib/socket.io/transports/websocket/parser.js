
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

/**
 * Frame the input, outputting "data" events.
 *
 * TODO: optimize
 * @api private
 */

Parser.prototype.parse = function(){
  var buf = this.buffer
    , len = buf.length
    , chr;

  for (var i = this.pos; i < len; ++i){
    chr = buf[i];

    // verify NUL
    if (i === 0){
      if ('\u0000' == chr) continue;
      this.error('Bad framing. Expected null byte as first frame');
    }

    if ('\ufffd' == chr){
      this.emit('data', buf.substr(1, buf.length - 2));
      this.buffer = buf.substr(i + 1);
      this.pos = 0;
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
  this.pos = 0;
  this.buffer = '';
};

/**
 * Emit an error `msg`, and reset the parser.
 *
 * @param {String} msg
 * @api private
 */

Parser.prototype.error = function(msg){
  this.reset();
  this.emit('error', msg);
};
