import { createApplication } from "../../lib/app";
import { createServer, Server } from "http";
import {
  InMemoryTodoRepository,
  TodoRepository,
} from "../../lib/todo-management/todo.repository";
import { AddressInfo } from "net";
import { io, Socket } from "socket.io-client";
import { ClientEvents, ServerEvents } from "../../lib/events";
import { expect } from "chai";

const createPartialDone = (count: number, done: () => void) => {
  let i = 0;
  return () => {
    if (++i === count) {
      done();
    }
  };
};

describe("todo management", () => {
  let httpServer: Server,
    socket: Socket<ServerEvents, ClientEvents>,
    otherSocket: Socket<ServerEvents, ClientEvents>,
    todoRepository: TodoRepository;

  beforeEach((done) => {
    const partialDone = createPartialDone(2, done);

    httpServer = createServer();
    todoRepository = new InMemoryTodoRepository();

    createApplication(httpServer, {
      todoRepository,
    });

    httpServer.listen(() => {
      const port = (httpServer.address() as AddressInfo).port;
      socket = io(`http://localhost:${port}`);
      socket.on("connect", partialDone);

      otherSocket = io(`http://localhost:${port}`);
      otherSocket.on("connect", partialDone);
    });
  });

  afterEach(() => {
    httpServer.close();
    socket.disconnect();
    otherSocket.disconnect();
  });

  describe("create todo", () => {
    it("should create a todo entity", (done) => {
      const partialDone = createPartialDone(2, done);

      socket.emit(
        "todo:create",
        {
          title: "lorem ipsum",
          completed: false,
        },
        async (res) => {
          if ("error" in res) {
            return done(new Error("should not happen"));
          }
          expect(res.data).to.be.a("string");

          const storedEntity = await todoRepository.findById(res.data);
          expect(storedEntity).to.eql({
            id: res.data,
            title: "lorem ipsum",
            completed: false,
          });

          partialDone();
        }
      );

      otherSocket.on("todo:created", (todo) => {
        expect(todo.id).to.be.a("string");
        expect(todo.title).to.eql("lorem ipsum");
        expect(todo.completed).to.eql(false);
        partialDone();
      });
    });

    it("should fail with an invalid entity", (done) => {
      const incompleteTodo = {
        completed: "false",
        description: true,
      };
      // @ts-ignore
      socket.emit("todo:create", incompleteTodo, (res) => {
        if (!("error" in res)) {
          return done(new Error("should not happen"));
        }
        expect(res.error).to.eql("invalid payload");
        expect(res.errorDetails).to.eql([
          {
            message: '"title" is required',
            path: ["title"],
            type: "any.required",
          },
        ]);
        done();
      });

      otherSocket.on("todo:created", () => {
        done(new Error("should not happen"));
      });
    });
  });

  describe("read todo", () => {
    it("should return a todo entity", (done) => {
      todoRepository.save({
        id: "254dbf85-f5b9-4675-b913-acab5d600884",
        title: "lorem ipsum",
        completed: true,
      });

      socket.emit(
        "todo:read",
        "254dbf85-f5b9-4675-b913-acab5d600884",
        (res) => {
          if ("error" in res) {
            return done(new Error("should not happen"));
          }
          expect(res.data.id).to.eql("254dbf85-f5b9-4675-b913-acab5d600884");
          expect(res.data.title).to.eql("lorem ipsum");
          expect(res.data.completed).to.eql(true);
          done();
        }
      );
    });

    it("should fail with an invalid ID", (done) => {
      socket.emit("todo:read", "123", (res) => {
        if ("error" in res) {
          expect(res.error).to.eql("entity not found");
          done();
        } else {
          done(new Error("should not happen"));
        }
      });
    });

    it("should fail with an unknown entity", (done) => {
      socket.emit(
        "todo:read",
        "6edcf81e-7049-40e0-8497-9cdd52414f75",
        (res) => {
          if ("error" in res) {
            expect(res.error).to.eql("entity not found");
            done();
          } else {
            done(new Error("should not happen"));
          }
        }
      );
    });
  });

  describe("update todo", () => {
    it("should update a todo entity", (done) => {
      const partialDone = createPartialDone(2, done);

      todoRepository.save({
        id: "c7790b35-6bbb-45dd-8d67-a281ca407b43",
        title: "lorem ipsum",
        completed: true,
      });

      socket.emit(
        "todo:update",
        {
          id: "c7790b35-6bbb-45dd-8d67-a281ca407b43",
          title: "dolor sit amet",
          completed: true,
        },
        async () => {
          const storedEntity = await todoRepository.findById(
            "c7790b35-6bbb-45dd-8d67-a281ca407b43"
          );
          expect(storedEntity).to.eql({
            id: "c7790b35-6bbb-45dd-8d67-a281ca407b43",
            title: "dolor sit amet",
            completed: true,
          });
          partialDone();
        }
      );

      otherSocket.on("todo:updated", (todo) => {
        expect(todo.title).to.eql("dolor sit amet");
        expect(todo.completed).to.eql(true);
        partialDone();
      });
    });

    it("should fail with an invalid entity", (done) => {
      const incompleteTodo = {
        id: "123",
        completed: "false",
        description: true,
      };
      // @ts-ignore
      socket.emit("todo:update", incompleteTodo, (res) => {
        if (!(res && "error" in res)) {
          return done(new Error("should not happen"));
        }
        expect(res.error).to.eql("invalid payload");
        expect(res.errorDetails).to.eql([
          {
            message: '"id" must be a valid GUID',
            path: ["id"],
            type: "string.guid",
          },
          {
            message: '"title" is required',
            path: ["title"],
            type: "any.required",
          },
        ]);
        done();
      });

      otherSocket.on("todo:updated", () => {
        done(new Error("should not happen"));
      });
    });
  });

  describe("delete todo", () => {
    it("should delete a todo entity", (done) => {
      const partialDone = createPartialDone(2, done);
      const id = "58960ab2-4e78-4ced-8079-134f12179d46";

      todoRepository.save({
        id,
        title: "lorem ipsum",
        completed: true,
      });

      socket.emit("todo:delete", id, async () => {
        try {
          await todoRepository.findById(id);
        } catch (e) {
          partialDone();
        }
      });

      otherSocket.on("todo:deleted", (id) => {
        expect(id).to.eql("58960ab2-4e78-4ced-8079-134f12179d46");
        partialDone();
      });
    });

    it("should fail with an invalid ID", (done) => {
      socket.emit("todo:delete", "123", (res) => {
        if (!(res && "error" in res)) {
          return done(new Error("should not happen"));
        }
        expect(res.error).to.eql("entity not found");
        done();
      });

      otherSocket.on("todo:deleted", () => {
        done(new Error("should not happen"));
      });
    });
  });

  describe("list todo", () => {
    it("should return a list of entities", (done) => {
      todoRepository.save({
        id: "d445db6d-9d55-4ff2-88ae-bd1f81c299d2",
        title: "lorem ipsum",
        completed: false,
      });

      todoRepository.save({
        id: "5f56fb59-a887-4984-93bf-eb39b4170a35",
        title: "dolor sit amet",
        completed: true,
      });

      socket.emit("todo:list", (res) => {
        if ("error" in res) {
          return done(new Error("should not happen"));
        }
        expect(res.data).to.eql([
          {
            id: "d445db6d-9d55-4ff2-88ae-bd1f81c299d2",
            title: "lorem ipsum",
            completed: false,
          },
          {
            id: "5f56fb59-a887-4984-93bf-eb39b4170a35",
            title: "dolor sit amet",
            completed: true,
          },
        ]);
        done();
      });
    });
  });
});
