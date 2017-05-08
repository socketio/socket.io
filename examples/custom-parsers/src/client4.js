
const customParser = require('./custom-parser');
const socket = require('socket.io-client')('localhost:3004', {
  parser: customParser
});

socket.io.engine.on('data', (data) => console.log('[custom]' + ' size= ' + (typeof data === 'string' ? data.length : data.byteLength)));

socket.on('string', (data) => console.log('[custom] [string]', data));
socket.on('numeric', (data) => console.log('[custom] [numeric]', data));
socket.on('binary', (data) => console.log('[custom] [binary]', data));
