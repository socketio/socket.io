<script setup>
import { computed, ref } from "vue";
import { useTodoStore } from "@/stores/todo";
import { socket } from "@/socket";

const newTodo = ref("");
const editedTodo = ref(undefined);
const newTitle = ref("");

const store = useTodoStore();

// remove any existing listeners (in case of hot reload)
socket.off();

store.bindEvents();

function addTodo() {
  const value = newTodo.value && newTodo.value.trim();
  if (!value) {
    return;
  }
  store.add(value);
  newTodo.value = "";
}

function editTodo(todo) {
  editedTodo.value = todo;
  newTitle.value = todo.title;
}

function doneEdit(todo) {
  if (newTitle.value) {
    store.setTitle(todo, newTitle.value);
  } else {
    store.delete(todo);
  }
  editedTodo.value = undefined;
}

function cancelEdit() {
  editedTodo.value = undefined;
}

const allDone = computed({
  get: () => {
    return store.remaining === 0;
  },
  set: (value) => {
    store.toggleAll(value);
  },
});

function pluralize(word, count) {
  return word + (count === 1 ? "" : "s");
}
</script>

<template>
  <section class="todoapp" v-cloak>
    <header class="header">
      <h1>todos</h1>
      <input
        class="new-todo"
        autofocus
        autocomplete="off"
        placeholder="What needs to be done?"
        v-model="newTodo"
        @keydown.enter="addTodo"
      />
    </header>
    <section class="main" v-show="store.todos.length">
      <input
        id="toggle-all"
        class="toggle-all"
        type="checkbox"
        v-model="allDone"
      />
      <label for="toggle-all">Mark all as complete</label>
      <ul class="todo-list">
        <li
          class="todo"
          v-for="todo in store.todos"
          :key="todo.id"
          :class="{ completed: todo.completed, editing: todo === editedTodo }"
        >
          <div class="view">
            <input
              class="toggle"
              type="checkbox"
              v-model="todo.completed"
              @click="store.toggleOne(todo)"
            />
            <label @dblclick="editTodo(todo)">{{ todo.title }}</label>
            <button class="destroy" @click="store.delete(todo)"></button>
          </div>
          <input
            class="edit"
            type="text"
            v-model="newTitle"
            @blur="doneEdit"
            @keydown.enter="doneEdit(todo)"
            @keydown.esc="cancelEdit(todo)"
          />
        </li>
      </ul>
    </section>
    <footer class="footer" v-show="store.todos.length">
      <span class="todo-count">
        <strong v-text="store.remaining"></strong>
        {{ pluralize("item", store.remaining) }} left
      </span>
      <button
        class="clear-completed"
        @click="store.deleteCompleted"
        v-show="store.todos.length > store.remaining"
      >
        Clear complete
      </button>
    </footer>
  </section>
</template>

<style scoped></style>
