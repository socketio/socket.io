import { Errors } from "../util";

abstract class CrudRepository<T, ID> {
  abstract findAll(): Promise<T[]>;
  abstract findById(id: ID): Promise<T>;
  abstract save(entity: T): Promise<void>;
  abstract deleteById(id: ID): Promise<void>;
}

export type TodoID = string;

export interface Todo {
  id: TodoID;
  completed: boolean;
  title: string;
}

export abstract class TodoRepository extends CrudRepository<Todo, TodoID> {}

export class InMemoryTodoRepository extends TodoRepository {
  private readonly todos: Map<TodoID, Todo> = new Map();

  findAll(): Promise<Todo[]> {
    const entities = Array.from(this.todos.values());
    return Promise.resolve(entities);
  }

  findById(id: TodoID): Promise<Todo> {
    if (this.todos.has(id)) {
      return Promise.resolve(this.todos.get(id)!);
    } else {
      return Promise.reject(Errors.ENTITY_NOT_FOUND);
    }
  }

  save(entity: Todo): Promise<void> {
    this.todos.set(entity.id, entity);
    return Promise.resolve();
  }

  deleteById(id: TodoID): Promise<void> {
    const deleted = this.todos.delete(id);
    if (deleted) {
      return Promise.resolve();
    } else {
      return Promise.reject(Errors.ENTITY_NOT_FOUND);
    }
  }
}
