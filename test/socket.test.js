
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
    },

    'test acks sent from server': function (next) {
      var socket = create();

      socket.on('connect', function () {
        socket.send('ooo', function () {
          socket.disconnect();
          next();
        });
      });
    },

    'test connecting to namespaces': function (next) {
      var socket = create().socket
        , namespaces = 2;

      function finish () {
        socket.of('').disconnect();
        next();
      }

      socket.of('/woot').on('message', function (msg) {
        msg.should().equal('connected to woot');
        --namespaces || finish();
      });

      socket.of('/chat').on('message', function (msg) {
        msg.should().equal('connected to chat');
        --namespaces || finish();
      });
    },

    'test disconnecting from namespaces': function (next) {
      var socket = create().socket
        , namespaces = 2
        , disconnections = 0;

      function finish () {
        socket.of('').disconnect();
        next();
      };

      socket.of('/a').on('connect', function () {
        socket.of('/a').disconnect();
      });

      socket.of('/a').on('disconnect', function () {
        --namespaces || finish();
      });

      socket.of('/b').on('connect', function () {
        socket.of('/b').disconnect();
      });

      socket.of('/b').on('disconnect', function () {
        --namespaces || finish();
      });
    },

    'test sending json from server': function (next) {
      var socket = create();

      socket.on('message', function (msg) {
        msg.should().eql(3141592);
        socket.disconnect();
        next();
      });
    },

    'test sending json from client': function (next) {
      var socket = create();

      socket.json.send([1, 2, 3]);
      socket.on('message', function (msg) {
        msg.should().equal('echo');
        socket.disconnect();
        next();
      });
    },

    'test emitting an event from server': function (next) {
      var socket = create();

      socket.on('woot', function () {
        socket.disconnect();
        next();
      });
    },

    'test emitting an event to server': function (next) {
      var socket = create();

      socket.emit('woot');
      socket.on('echo', function () {
        socket.disconnect();
        next();
      })
    },

    'test emitting an event from server and sending back data': function (next) {
      var socket = create();

      socket.on('woot', function (a, fn) {
        a.should().eql(1);
        fn('test');

        socket.on('done', function () {
          socket.disconnect();
          next();
        });
      });
    }

  };

})(
    'undefined' == typeof module ? module = {} : module
  , 'undefined' == typeof io ? require('socket.io-client') : io
  , 'undefined' == typeof should ? require('should-browser') : should
);
