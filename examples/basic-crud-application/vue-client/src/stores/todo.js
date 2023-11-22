import { defineStore } from "pinia";
import { socket } from "@/socket";

export const useTodoStore = defineStore("todo", {
  state: () => ({
    todos: [],
  }),

  getters: {
    remaining(state) {
      let count = 0;
      state.todos.forEach((todo) => {
        if (!todo.completed) {
          count++;
        }
      });
      return count;
    },
  },

  actions: {
    bindEvents() {
      socket.on("connect", () => {
        socket.emit("todo:list", (res) => {
          this.todos = res.data;
        });
      });

      socket.on("todo:created", (todo) => {
        this.todos.push(todo);
      });

      socket.on("todo:updated", (todo) => {
        const existingTodo = this.todos.find((t) => {
          return t.id === todo.id;
        });
        if (existingTodo) {
          existingTodo.title = todo.title;
          existingTodo.completed = todo.completed;
        }
      });

      socket.on("todo:deleted", (id) => {
        const i = this.todos.findIndex((t) => {
          return t.id === id;
        });
        if (i !== -1) {
          this.todos.splice(i, 1);
        }
      });
    },

    add(title) {
      const todo = {
        id: Date.now(),
        title,
        completed: false,
      };
      this.todos.push(todo);
      socket.emit("todo:create", { title, completed: false }, (res) => {
        todo.id = res.data;
      });
    },

    setTitle(todo, title) {
      todo.title = title;
      socket.emit("todo:update", todo, () => {});
    },

    delete(todo) {
      const i = this.todos.findIndex((t) => {
        return t.id === todo.id;
      });

      if (i !== -1) {
        this.todos.splice(i, 1);
        socket.emit("todo:delete", todo.id, () => {});
      }
    },

    deleteCompleted() {
      this.todos.forEach((todo) => {
        if (todo.completed) {
          socket.emit("todo:delete", todo.id, () => {});
        }
      });

      this.todos = this.todos.filter((t) => {
        return !t.completed;
      });
    },

    toggleOne(todo) {
      todo.completed = !todo.completed;
      socket.emit("todo:update", todo, () => {});
    },

    toggleAll(onlyActive) {
      this.todos.forEach((todo) => {
        if (!onlyActive || !todo.completed) {
          this.toggleOne(todo);
        }
      });
    },
  },
});
