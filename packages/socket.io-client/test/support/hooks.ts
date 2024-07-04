import { createServer } from "./server";

let server;

export const mochaHooks = {
  beforeAll() {
    server = createServer();
  },
  afterAll() {
    server.close();
  },
};
