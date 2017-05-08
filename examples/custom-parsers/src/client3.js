
const customParser = require('socket.io-json-parser');
const socket = require('socket.io-client')('localhost:3003', {
  parser: customParser
});

socket.io.engine.on('data', (data) => console.log('[json]' + ' size= ' + (typeof data === 'string' ? data.length : data.byteLength)));

socket.on('string', (data) => console.log('[json] [string]', data));
socket.on('numeric', (data) => console.log('[json] [numeric]', data));
socket.on('binary', (data) => console.log('[json] [binary]', data));
