
/*!
 * socket.io-node
 * Copyright(c) 2011 LearnBoost <dev@learnboost.com>
 * MIT Licensed
 */

/**
 * Module dependencies.
 */

var util = require('./util')
  , toArray = util.toArray;

/**
 * Log levels.
 */

var levels = [
    'error'
  , 'warn'
  , 'info'
  , 'debug'
];

/**
 * Colors for log levels.
 */

var colors = [
    31
  , 33
  , 36
  , 90
];

/**
 * Pads the nice output to the longest log level.
 */

function pad (str) {
  var max = 0;

  for (var i = 0, l = levels.length; i < l; i++)
    max = Math.max(max, levels[i].length);

  if (str.length < max)
    return str + new Array(max - str.length + 1).join(' ');

  return str;
};


/**
 * Returns a human readable timestamp.
 */

function timestamp() {

  function pad_date(number) {

    return ('0' + number).slice(-2)

  }

  var date = new Date();

  return date.getFullYear() + "-" + pad_date(date.getMonth()+1) + "-" + pad_date(date.getDate()) + " " + date.toLocaleTimeString() + " ";
};

/**
 * Logger (console).
 *
 * @api public
 */

var Logger = module.exports = function (opts) {
  opts = opts || {}
  this.timestamps = false;
  this.colors = false !== opts.colors;
  this.level = 3;
  this.enabled = true;
};

/**
 * Log method.
 *
 * @api public
 */

Logger.prototype.log = function (type) {
  var index = levels.indexOf(type);

  if (index > this.level || !this.enabled)
    return this;

  
  if (this.timestamps)
    type = timestamp() + type;

  console.log.apply(
      console
    , [this.colors
        ? '   \033[' + colors[index] + 'm' + pad(type) + ' -\033[39m'
        : type + ':'
      ].concat(toArray(arguments).slice(1))
  );

  return this;
};

/**
 * Generate methods.
 */

levels.forEach(function (name) {
  Logger.prototype[name] = function () {
    this.log.apply(this, [name].concat(toArray(arguments)));
  };
});
