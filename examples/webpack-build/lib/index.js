
var socket = require('socket.io-client')('http://localhost:3000');

console.log('init');

socket.on('connect', onConnect);

function onConnect(){
  console.log('connect ' + socket.id);
}
