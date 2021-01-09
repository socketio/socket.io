const eioc = require("./common").eioc;
const listen = require("./common").listen;
const expect = require("expect.js");
const request = require("superagent");

describe("JSONP", () => {
  before(() => {
    // we have to override the browser's functionality for JSONP
    document = {
      // eslint-disable-line no-global-assign
      body: {
        appendChild: () => {},
        removeChild: () => {}
      }
    };

    document.createElement = function(name) {
      const self = this;

      if ("script" === name) {
        const script = {};

        script.__defineGetter__("parentNode", () => document.body);

        script.__defineSetter__("src", uri => {
          request.get(uri).end((err, res) => {
            expect(err).to.be(null);
            eval(res.text); // eslint-disable-line no-eval
          });
        });
        return script;
      } else if ("form" === name) {
        const form = {
          style: {},
          action: "",
          parentNode: {
            removeChild: () => {}
          },
          removeChild: () => {},
          setAttribute: () => {},
          appendChild: () => {},
          submit: function() {
            request
              .post(this.action)
              .type("form")
              .send({ d: self.areaValue })
              .end(() => {});
          }
        };
        return form;
      } else if ("textarea" === name) {
        const textarea = {};

        // a hack to be able to access the area data when form is sent
        textarea.__defineSetter__("value", data => {
          self.areaValue = data;
        });
        return textarea;
      } else if (~name.indexOf("iframe")) {
        const iframe = {};
        setTimeout(() => {
          if (iframe.onload) iframe.onload();
        }, 0);

        return iframe;
      } else {
        return {};
      }
    };

    document.getElementsByTagName = name => [
      {
        parentNode: {
          insertBefore: () => {}
        }
      }
    ];
  });

  after(() => {
    delete document.getElementsByTagName;
    delete document.createElement;
    delete global.document;
  });

  describe("handshake", () => {
    it("should open with polling JSONP when requested", done => {
      const engine = listen(
        { allowUpgrades: false, transports: ["polling"] },
        port => {
          eioc("ws://localhost:" + port, {
            transports: ["polling"],
            forceJSONP: true,
            upgrade: false
          });
          engine.on("connection", socket => {
            expect(socket.transport.name).to.be("polling");
            expect(socket.transport.head).to.be("___eio[0](");
            done();
          });
        }
      );
    });
  });

  describe("messages", () => {
    let engine, port, socket;

    beforeEach(done => {
      engine = listen({ allowUpgrades: false, transports: ["polling"] }, p => {
        port = p;

        socket = new eioc.Socket("ws://localhost:" + port, {
          transports: ["polling"],
          forceJSONP: true,
          upgrade: false
        });

        done();
      });
    });

    it("should arrive from client to server and back (pollingJSONP)", done => {
      engine.on("connection", conn => {
        conn.on("message", msg => {
          conn.send("a");
        });
      });

      socket.on("open", () => {
        socket.send("a");
        socket.on("message", msg => {
          expect(socket.transport.query.j).to.not.be(undefined);
          expect(msg).to.be("a");
          done();
        });
      });
    });

    it("should not fail JSON.parse for stringified messages", done => {
      engine.on("connection", conn => {
        conn.on("message", message => {
          expect(JSON.parse(message)).to.be.eql({ test: "a\r\nb\n\n\n\nc" });
          done();
        });
      });
      socket.on("open", () => {
        socket.send(JSON.stringify({ test: "a\r\nb\n\n\n\nc" }));
      });
    });

    it("should parse newlines in message correctly", done => {
      engine.on("connection", conn => {
        conn.on("message", message => {
          expect(message).to.be.equal("a\r\nb\n\n\n\nc");
          done();
        });
      });
      socket.on("open", () => {
        socket.send("a\r\nb\n\n\n\nc");
      });
    });

    it("should arrive from server to client and back with binary data (pollingJSONP)", done => {
      const binaryData = Buffer.allocUnsafe(5);
      for (var i = 0; i < 5; i++) binaryData[i] = i;
      engine.on("connection", conn => {
        conn.on("message", msg => {
          conn.send(msg);
        });
      });

      socket.on("open", () => {
        socket.send(binaryData);
        socket.on("message", msg => {
          for (let i = 0; i < msg.length; i++) expect(msg[i]).to.be(i);
          done();
        });
      });
    });
  });

  describe("close", () => {
    it("should trigger when server closes a client", done => {
      const engine = listen(
        { allowUpgrades: false, transports: ["polling"] },
        port => {
          const socket = new eioc.Socket("ws://localhost:" + port, {
            transports: ["polling"],
            forceJSONP: true,
            upgrade: false
          });
          let total = 2;

          engine.on("connection", conn => {
            conn.on("close", reason => {
              expect(reason).to.be("forced close");
              --total || done();
            });
            setTimeout(() => {
              conn.close();
            }, 10);
          });

          socket.on("open", () => {
            socket.on("close", reason => {
              expect(reason).to.be("transport close");
              --total || done();
            });
          });
        }
      );
    });

    it("should trigger when client closes", done => {
      const engine = listen(
        { allowUpgrades: false, transports: ["polling"] },
        port => {
          const socket = new eioc.Socket("ws://localhost:" + port, {
            transports: ["polling"],
            forceJSONP: true,
            upgrade: false
          });
          let total = 2;

          engine.on("connection", conn => {
            conn.on("close", reason => {
              expect(reason).to.be("transport close");
              --total || done();
            });
          });

          socket.on("open", () => {
            socket.send("a");
            socket.on("close", reason => {
              expect(reason).to.be("forced close");
              --total || done();
            });

            setTimeout(() => {
              socket.close();
            }, 10);
          });
        }
      );
    });
  });
});
