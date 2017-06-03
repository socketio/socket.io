
import io from 'socket.io-client';

const socket = io('http://localhost:3000');

console.log('init');

socket.on('connect', onConnect);

function onConnect(){
  console.log('connect ' + socket.id);
}
