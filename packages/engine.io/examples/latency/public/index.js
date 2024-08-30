
/**
 * Module dependencies.
 */

const SmoothieChart = require('smoothie').SmoothieChart;
const TimeSeries = require('smoothie').TimeSeries;

// helper

function $ (id) { return document.getElementById(id); }

// chart

let smoothie;
let time;

function render () {
  if (smoothie) smoothie.stop();
  $('chart').width = document.body.clientWidth;
  smoothie = new SmoothieChart();
  smoothie.streamTo($('chart'), 1000);
  time = new TimeSeries();
  smoothie.addTimeSeries(time, {
    strokeStyle: 'rgb(255, 0, 0)',
    fillStyle: 'rgba(255, 0, 0, 0.4)',
    lineWidth: 2
  });
}

// socket
const socket = new eio.Socket();
let last;
function send () {
  last = new Date();
  socket.send('ping');
  $('transport').innerHTML = socket.transport.name;
}

socket.on('open', () => {
  if ($('chart').getContext) {
    render();
    window.onresize = render;
  }
  send();
});

socket.on('close', () => {
  if (smoothie) smoothie.stop();
  $('transport').innerHTML = '(disconnected)';
});

socket.on('message', () => {
  const latency = new Date() - last;
  $('latency').innerHTML = latency + 'ms';
  if (time) time.append(+new Date(), latency);
  setTimeout(send, 100);
});
