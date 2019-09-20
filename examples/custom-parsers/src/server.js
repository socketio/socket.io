
const express = require('express');
const app = express();
const server = require('http').createServer(app);
const path = require('path');
const port = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, '../public')));

server.listen(port, () => console.log('>>> http://localhost:' + port));

const io = require('socket.io');
const msgpackParser = require('socket.io-msgpack-parser');
const jsonParser = require('socket.io-json-parser');
const customParser = require('./custom-parser');

let server1 = io(3001, {});
let server2 = io(3002, {
  parser: msgpackParser
});
let server3 = io(3003, {
  parser: jsonParser
});
let server4 = io(3004, {
  parser: customParser
});

let string = [];
let numeric = [];
let binary = Buffer.allocUnsafe(1e3);
for (var i = 0; i < 1e3; i++) {
  string.push('' + i);
  numeric.push(i);
  binary[i] = i;
}

server1.on('connect', onConnect(1000));
server2.on('connect', onConnect(2000));
server3.on('connect', onConnect(3000));
server4.on('connect', onConnect(4000));

function onConnect (delay) {
  return function (socket) {
    console.log('connect ' + socket.id);

    setTimeout(() => {
      socket.emit('string', string);
      socket.emit('numeric', numeric);
      socket.emit('binary', binary);
    }, delay);

    socket.on('disconnect', () => console.log('disconnect ' + socket.id));
  };
}

