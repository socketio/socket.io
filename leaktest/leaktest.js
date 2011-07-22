var assertvanish = require('assertvanish')
  , common = require('../test/common.js')
  , websocket = common.websocket
  , client = common.client
  , create = common.create
  , ports = 15800;

function resultCallback(leaks, leakedSocket) {
  if (leaks) {
    console.error('leak detected');
    process.exit(1);
  } else {
    console.error('no leak :)');
    process.exit(0);
  }
}

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
console.log('initiating handshake...');
cl.handshake(function (sid) {
  console.log('handshake done');
  var ws = websocket(cl, sid);
  ws.on('open', function () {
    console.log('open!');
    setTimeout(function() {
      ws.close();
    }, 500);
  });
});
}, 500);
