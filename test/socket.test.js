
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
      var socket = create();
      socket.on('connect', function () {
        socket.disconnect();
        next();
      });
    },

    'test receiving messages': function (next) {
      var socket = create()
        , connected = false
        , messages = 0;

      socket.on('connect', function () {
        connected = true;
      });

      socket.on('message', function (i) {
        String(++messages).should().equal(i);
      });

      socket.on('disconnect', function (reason) {
        connected.should().be_true;
        messages.should().equal(3);
        reason.should().eql('booted');
        next();
      });
    },

    'test sending messages': function (next) {
      var socket = create();

      socket.on('connect', function () {
        socket.send('echo');

        socket.on('message', function (msg) {
          msg.should().equal('echo');
          socket.disconnect();
          next();
        });
      });
    },

    'test acks sent from client': function (next) {
      var socket = create();

      socket.on('connect', function () {
        socket.on('message', function (msg) {
          if ('tobi 2' == msg) {
            socket.disconnect();
            next();
          }
        });
      });
    }

  };

})(
    'undefined' == typeof module ? module = {} : module
  , 'undefined' == typeof io ? require('socket.io-client') : io
  , 'undefined' == typeof should ? require('should-browser') : should
);
