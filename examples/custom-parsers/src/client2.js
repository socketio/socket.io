
const customParser = require('socket.io-msgpack-parser');
const socket = require('socket.io-client')('http://localhost:3002', {
  parser: customParser
});

socket.io.engine.on('data', (data) => console.log('[msgpack]' + ' size= ' + (typeof data === 'string' ? data.length : data.byteLength)));

socket.on('string', (data) => console.log('[msgpack] [string]', data));
socket.on('numeric', (data) => console.log('[msgpack] [numeric]', data));
socket.on('binary', (data) => console.log('[msgpack] [binary]', data));
