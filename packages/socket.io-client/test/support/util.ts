/**
 * This is needed because webdriver.io does not support mocha async mode:
 *
 * ```
 * it("works", (done) => {
 *   done(); // does not work
 * });
 * ```
 *
 * @see https://webdriver.io/docs/frameworks/#using-mocha
 * @param fn
 */
export function wrap(fn: (done: (err?: Error) => void) => void) {
  let once = true;
  return new Promise<void>((resolve, reject) => {
    fn((err) => {
      if (!once) {
        throw "done() was called multiple times";
      } else if (err) {
        reject(err);
      } else {
        once = false;
        resolve();
      }
    });
  });
}

export function success(done, socket) {
  socket.disconnect();
  done();
}

/**
 * URL of the Socket.IO server used in the tests (see "test/support/server.ts")
 */
export const BASE_URL = "http://localhost:3210";
