import { Socket } from "engine.io-client";
import { X509Certificate } from "crypto";
import { readFileSync } from "node:fs";
import { WebTransport } from "@fails-components/webtransport";

const cert = readFileSync("./cert.pem");
const CLIENTS_COUNT = 100;

global.WebTransport = WebTransport;

for (let i = 0; i < CLIENTS_COUNT; i++) {
  const socket = new Socket("ws://localhost:3000", {
    transports: ["webtransport"],
    transportOptions: {
      webtransport: {
        serverCertificateHashes: [
          {
            algorithm: "sha-256",
            value: Buffer.from(
              new X509Certificate(cert).fingerprint256
                .split(":")
                .map((el) => parseInt(el, 16))
            ),
          },
        ],
      },
    },
  });

  socket.on("open", () => {});

  socket.on("message", () => {});

  socket.on("close", (reason) => {});
}
