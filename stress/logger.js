'use strict';

var io = require('../');
var server = io.listen(23456);
server.set('log level', 0);

var n = 100000;
var t0 = Date.now();
for (var i = 0; i < n; ++i) {
	server.get('log level') > 2 && server.log.debug('fooooooooooooo', 'ooooooooooooooooo', 'oooooooooooooooooooo', 'oooooooooooooooooooooooo');
}
var t1 = Date.now();
for (var i = 0; i < n; ++i) {
	server.log.debug('fooooooooooooo', 'ooooooooooooooooo', 'oooooooooooooooooooo', 'oooooooooooooooooooooooo');
}
var t2 = Date.now();
console.log('DONE: conditional log: ', t1 - t0, 'ms overhead for ', n, 'invokations');
console.log('DONE: internal logic: ', t2 - t1, 'ms overhead for ', n, 'invokations');
