
/**
 * Module dependencies.
 */

const express = require('express');
const app = express();
const server = require('http').createServer(app);
const enchilada = require('enchilada');
const io = require('engine.io').attach(server);

app.use(enchilada({
  src: __dirname + '/public',
  debug: true
}));
app.use(express.static(__dirname + '/public'));
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/index.html');
});

app.get('/engine.io.min.js', (req, res) => {
  res.sendFile(require.resolve('engine.io-client/dist/engine.io.min.js'));
});

io.on('connection', (socket) => {
  socket.on('message', () => {
    socket.send('pong');
  });
});

const port = process.env.PORT || 3000;
server.listen(port, () => {
  console.log('\x1B[96mlistening on localhost:' + port + ' \x1B[39m');
});
