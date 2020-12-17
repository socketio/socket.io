import { io, Socket } from "socket.io-client";

export class Todo {
  completed: boolean;
  editing: boolean;

  private _title: String = "";
  get title() {
    return this._title;
  }
  set title(value: String) {
    this._title = value.trim();
  }

  constructor(title: String) {
    this.completed = false;
    this.editing = false;
    this.title = title.trim();
  }
}

export class TodoStore {
  todos: Array<Todo>;

  constructor() {
    let persistedTodos = JSON.parse(localStorage.getItem('angular2-todos') || '[]');
    // Normalize back into classes
    this.todos = persistedTodos.map( (todo: {_title: String, completed: boolean}) => {
      let ret = new Todo(todo._title);
      ret.completed = todo.completed;
      return ret;
    });
  }

  protected updateStore() {
    localStorage.setItem('angular2-todos', JSON.stringify(this.todos));
  }

  private getWithCompleted(completed: boolean) {
    return this.todos.filter((todo: Todo) => todo.completed === completed);
  }

  allCompleted() {
    return this.todos.length === this.getCompleted().length;
  }

  setAllTo(completed: boolean) {
    this.todos.forEach((t: Todo) => t.completed = completed);
    this.updateStore();
  }

  removeCompleted() {
    this.todos = this.getWithCompleted(false);
    this.updateStore();
  }

  getRemaining() {
    return this.getWithCompleted(false);
  }

  getCompleted() {
    return this.getWithCompleted(true);
  }

  toggleCompletion(todo: Todo) {
    todo.completed = !todo.completed;
    this.updateStore();
  }

  remove(todo: Todo) {
    this.todos.splice(this.todos.indexOf(todo), 1);
    this.updateStore();
  }

  add(title: String) {
    this.todos.push(new Todo(title));
    this.updateStore();
  }
}

export class RemoteTodoStore extends TodoStore {
  private socket: Socket;

  constructor() {
    super();
    this.socket = io("http://localhost:8080");
    this.socket.on("todos", (updatedTodos: Array<Todo>) => {
      this.todos = updatedTodos;
    });
  }

  protected updateStore() {
    this.socket.emit("update-store", this.todos.map(({ title, editing, completed }) => ({ title, editing, completed })));
  }
}
