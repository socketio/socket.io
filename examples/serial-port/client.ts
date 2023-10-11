import { io } from "socket.io-client";

const socket = io("ws://localhost:8080/", {});

socket.on("connect", () => {
  console.log(`connect ${socket.id}`);
});

socket.on("disconnect", () => {
  console.log(`disconnect`);
});

socket.on("onDeviceDisconnected", () => {
  console.log(`onDeviceDisconnected`);
});
socket.on("onDeviceConnected", () => {
  console.log(`onDeviceConnected`);
});
