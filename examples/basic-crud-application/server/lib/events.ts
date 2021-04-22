import { Todo, TodoID } from "./todo-management/todo.repository";
import { ValidationErrorItem } from "joi";

interface Error {
  error: string;
  errorDetails?: ValidationErrorItem[];
}

interface Success<T> {
  data: T;
}

export type Response<T> = Error | Success<T>;

export interface ServerEvents {
  "todo:created": (todo: Todo) => void;
  "todo:updated": (todo: Todo) => void;
  "todo:deleted": (id: TodoID) => void;
}

export interface ClientEvents {
  "todo:list": (callback: (res: Response<Todo[]>) => void) => void;

  "todo:create": (
    payload: Omit<Todo, "id">,
    callback: (res: Response<TodoID>) => void
  ) => void;

  "todo:read": (id: TodoID, callback: (res: Response<Todo>) => void) => void;

  "todo:update": (
    payload: Todo,
    callback: (res?: Response<void>) => void
  ) => void;

  "todo:delete": (id: TodoID, callback: (res?: Response<void>) => void) => void;
}
