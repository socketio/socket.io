import { createServer } from "http";
import { createApplication } from "./app";
import { InMemoryTodoRepository } from "./todo-management/todo.repository";

const httpServer = createServer();

createApplication(
  httpServer,
  {
    todoRepository: new InMemoryTodoRepository(),
  },
  {
    cors: {
      origin: ["http://localhost:4200"],
    },
  }
);

httpServer.listen(3000);
