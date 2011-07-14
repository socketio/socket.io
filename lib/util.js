
/*!
 * socket.io-node
 * Copyright(c) 2011 LearnBoost <dev@learnboost.com>
 * MIT Licensed
 */

/**
 * Module dependencies.
 */

/**
 * Converts an enumerable to an array.
 *
 * @api public
 */

exports.toArray = function (enu) {
  var arr = [];

  for (var i = 0, l = enu.length; i < l; i++)
    arr.push(enu[i]);

  return arr;
};

/**
 * Applies the properties of one object onto another
 *
 * @param {Object} source, destination object
 * @param {Object} merge, merge object
 * @api public
 */
 
exports.merge = function(source, merge){
  for (var i in merge) source[i] = merge[i];
  return source;
};