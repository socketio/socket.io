/*global importScripts,eio,postMessage*/

importScripts('/test/support/engine.io.js');

var socket = new eio.Socket();
socket.on('message', function(msg){
  postMessage(msg);
});
