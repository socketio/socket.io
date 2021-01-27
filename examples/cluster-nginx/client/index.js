const socket = require('socket.io-client')('ws://nginx');

socket.on('connect', () => {
  console.log('connected');
});

socket.on('my-name-is', (serverName) => {
  console.log(`connected to ${serverName}`);
});

socket.on('disconnect', (reason) => {
  console.log(`disconnected due to ${reason}`);
});
