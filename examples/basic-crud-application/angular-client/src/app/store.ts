import { io, Socket } from "socket.io-client";
import { ClientEvents, ServerEvents } from "../../../server/lib/events";
import { environment } from '../environments/environment';

export interface Todo {
  id: string,
  title: string,
  completed: boolean,
  editing: boolean,
  synced: boolean
}

const mapTodo = (todo: any) => {
  return {
    ...todo,
    editing: false,
    synced: true
  }
}

export class TodoStore {
  public todos: Array<Todo> = [];
  private socket: Socket<ServerEvents, ClientEvents>;

  constructor() {
    this.socket = io(environment.serverUrl);

    this.socket.on("connect", () => {
      this.socket.emit("todo:list", (res) => {
        if ("error" in res) {
          // handle the error
          return;
        }
        this.todos = res.data.map(mapTodo);
      });
    });

    this.socket.on("todo:created", (todo) => {
      this.todos.push(mapTodo(todo));
    });

    this.socket.on("todo:updated", (todo) => {
      const existingTodo = this.todos.find(t => {
        return t.id === todo.id
      });
      if (existingTodo) {
        existingTodo.title = todo.title;
        existingTodo.completed = todo.completed;
      }
    });

    this.socket.on("todo:deleted", (id) => {
      const index = this.todos.findIndex(t => {
        return t.id === id
      });
      if (index !== -1) {
        this.todos.splice(index, 1);
      }
    })
  }

  private getWithCompleted(completed: boolean) {
    return this.todos.filter((todo: Todo) => todo.completed === completed);
  }

  allCompleted() {
    return this.todos.length === this.getCompleted().length;
  }

  setAllTo(completed: boolean) {
    this.todos.forEach(todo => {
      todo.completed = completed;
      todo.synced = false;
      this.socket.emit("todo:update", todo, (res) => {
        if (res && "error" in res) {
          // handle the error
          return;
        }
        todo.synced = true;
      });
    });
  }

  removeCompleted() {
    this.getCompleted().forEach((todo) => {
      this.socket.emit("todo:delete", todo.id, (res) => {
        if (res && "error" in res) {
          // handle the error
        }
      });
    })
    this.todos = this.getRemaining();
  }

  getRemaining() {
    return this.getWithCompleted(false);
  }

  getCompleted() {
    return this.getWithCompleted(true);
  }

  toggleCompletion(todo: Todo) {
    todo.completed = !todo.completed;
    todo.synced = false;
    this.socket.emit("todo:update", todo, (res) => {
      if (res && "error" in res) {
        // handle the error
        return;
      }
      todo.synced = true;
    })
  }

  remove(todo: Todo) {
    this.todos.splice(this.todos.indexOf(todo), 1);
    this.socket.emit("todo:delete", todo.id, (res) => {
      if (res && "error" in res) {
        // handle the error
      }
    });
  }

  add(title: string) {
    this.socket.emit("todo:create", { title, completed: false }, (res) => {
      if ("error" in res) {
        // handle the error
        return;
      }
      this.todos.push({
        id: res.data,
        title,
        completed: false,
        editing: false,
        synced: true
      });
    });
  }
}

