import fetch from "node-fetch";
import { WebSocket } from "ws";
import chai from "chai";
import chaiString from "chai-string";

chai.use(chaiString);

globalThis.fetch = fetch;
globalThis.WebSocket = WebSocket;
globalThis.chai = chai;
