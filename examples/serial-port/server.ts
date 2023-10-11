import { Server } from "socket.io";
const SerialPort = require("serialport");
const Readline = require("@serialport/parser-readline");
const emitter = require("events").EventEmitter;

const em = new emitter();
const deviceName = "/dev/tty.usbserial-0001";

const io = new Server(8080);

let found = false;

function findDevice() {
  console.log("findDevice");
  SerialPort.list()
    .then(function (ports) {
      // // iterate through ports
      for (var i = 0; i < ports.length; i += 1) {
        console.log("list", ports[i]);
        if (ports[i].path === deviceName) {
          console.log("device founded");
          found = true;
          em.emit("connected");
          startDevice();
          return;
        }
      }
      if (!found) {
        setTimeout(findDevice, 1000);
      }
    })
    .catch(function (error) {
      console.log("error on read port", error);
    });
}

function startDevice() {
  try {
    const port = new SerialPort(deviceName, { baudRate: 9600 });
    const parser = port.pipe(new Readline({ delimiter: "\n" })); // Read the port data

    port.on("open", () => {
      console.log("serial port open");
    });

    parser.on("data", (data) => {
      console.log("got word from arduino:", data);
      em.emit("onDataReceived", data);
    });

    port.on("close", function (err) {
      console.log("Port closed."), err;
      found = false;
      em.emit("disconnect");
      setTimeout(findDevice, 1000);
    });
  } catch (e) {
    console.log("device not found ");
  }
}

io.on("connect", (socket) => {
  console.log(`connect ${socket.id}`);

  if (found) {
    socket.emit("onDeviceConnected");
  } else {
    socket.emit("onDeviceDisconnected");
  }

  em.on("disconnect", function (data) {
    socket.emit("onDeviceDisconnected");
  });
  em.on("connected", function (data) {
    socket.emit("onDeviceConnected");
  });
  em.on("onDataReceived", function (data) {
    socket.emit("onDataReceived", data);
  });

  socket.on("disconnect", () => {
    console.log(`disconnect ${socket.id}`);
  });
});

console.log("start program");
findDevice();
