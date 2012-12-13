
# socket.io

## How to use

```js
var http = require('http').Server();
var sockets = require('socket.io')(http);
sockets.on('connection', function(socket){
  socket.on('event', function(data){});
  socket.on('disconnect', function(){});
});
```

## License

MIT
