
const socket = require('socket.io-client')('localhost:3001', {});

socket.io.engine.on('data', (data) => console.log('[default]' + ' size= ' + (typeof data === 'string' ? data.length : data.byteLength)));

socket.on('string', (data) => console.log('[default] [string]', data));
socket.on('numeric', (data) => console.log('[default] [numeric]', data));
socket.on('binary', (data) => console.log('[default] [binary]', data));
