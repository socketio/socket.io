import { Server as HttpServer } from "http";
import { Server, ServerOptions } from "socket.io";
import { ClientEvents, ServerEvents } from "./events";
import { TodoRepository } from "./todo-management/todo.repository";
import createTodoHandlers from "./todo-management/todo.handlers";

export interface Components {
  todoRepository: TodoRepository;
}

export function createApplication(
  httpServer: HttpServer,
  components: Components,
  serverOptions: Partial<ServerOptions> = {}
): Server<ClientEvents, ServerEvents> {
  const io = new Server<ClientEvents, ServerEvents>(httpServer, serverOptions);

  const {
    createTodo,
    readTodo,
    updateTodo,
    deleteTodo,
    listTodo,
  } = createTodoHandlers(components);

  io.on("connection", (socket) => {
    socket.on("todo:create", createTodo);
    socket.on("todo:read", readTodo);
    socket.on("todo:update", updateTodo);
    socket.on("todo:delete", deleteTodo);
    socket.on("todo:list", listTodo);
  });

  return io;
}
