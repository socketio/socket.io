
/*!
 * socket.io-node
 * Copyright(c) 2011 LearnBoost <dev@learnboost.com>
 * MIT Licensed
 */

(function (module, io, should) {

  if ('object' == typeof global) {
    return module.exports = { '': function () {} };
  }

  module.exports = {

    'test connecting the socket and disconnecting': function (next) {
      var socket = new io.Socket({ host: 'localhost', port: 3000 });
      socket.on('connect', function () {
        socket.disconnect();
        next();
      });
    }

  };

})(
    'undefined' == typeof module ? module = {} : module
  , 'undefined' == typeof io ? require('socket.io-client') : io
  , 'undefined' == typeof should ? require('should-browser') : should
);
