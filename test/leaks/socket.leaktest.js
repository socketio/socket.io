/*!
 * socket.io-node
 * Copyright(c) 2011 LearnBoost <dev@learnboost.com>
 * MIT Licensed
 */

/**
 * Test dependencies.
 */

require.paths.unshift(__dirname + '/../../lib');

var assertvanish = require('assertvanish')
  , common = require('../common')
  , ports = 15800;

function resultCallback (leaks, leakedSocket) {
  if (leaks) {
    console.error('Leak detected');
    process.exit(1);
  } else {
    console.error('No leaks');
    process.exit(0);
  }
};

/**
 * Test.
 */

var cl = client(++ports);
var io = create(cl);

io.sockets.on('connection', function (socket) {
  console.log('connected');
  
  socket.on('disconnect', function() {
    console.log("client gone");
    setTimeout(gc, 1000);
    assertvanish(socket, 2000, {silent: true, callback: resultCallback});
  });
});

setTimeout(function() {
  cl.handshake(function (sid) {
    var ws = websocket(cl, sid);
    ws.on('open', function () {
      console.log('open!');
      setTimeout(function() {
        ws.close();
      }, 500);
    });
  });
}, 100);
