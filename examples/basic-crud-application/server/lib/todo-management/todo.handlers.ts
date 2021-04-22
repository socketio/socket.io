import { Errors, mapErrorDetails, sanitizeErrorMessage } from "../util";
import { v4 as uuid } from "uuid";
import { Components } from "../app";
import Joi = require("joi");
import { Todo, TodoID } from "./todo.repository";
import { ClientEvents, Response, ServerEvents } from "../events";
import { Socket } from "socket.io";

const idSchema = Joi.string().guid({
  version: "uuidv4",
});

const todoSchema = Joi.object({
  id: idSchema.alter({
    create: (schema) => schema.forbidden(),
    update: (schema) => schema.required(),
  }),
  title: Joi.string().max(256).required(),
  completed: Joi.boolean().required(),
});

export default function (components: Components) {
  const { todoRepository } = components;
  return {
    createTodo: async function (
      payload: Omit<Todo, "id">,
      callback: (res: Response<TodoID>) => void
    ) {
      // @ts-ignore
      const socket: Socket<ClientEvents, ServerEvents> = this;

      // validate the payload
      const { error, value } = todoSchema.tailor("create").validate(payload, {
        abortEarly: false,
        stripUnknown: true,
      });

      if (error) {
        return callback({
          error: Errors.INVALID_PAYLOAD,
          errorDetails: mapErrorDetails(error.details),
        });
      }

      value.id = uuid();

      // persist the entity
      try {
        await todoRepository.save(value);
      } catch (e) {
        return callback({
          error: sanitizeErrorMessage(e),
        });
      }

      // acknowledge the creation
      callback({
        data: value.id,
      });

      // notify the other users
      socket.broadcast.emit("todo:created", value);
    },

    readTodo: async function (
      id: TodoID,
      callback: (res: Response<Todo>) => void
    ) {
      const { error } = idSchema.validate(id);

      if (error) {
        return callback({
          error: Errors.ENTITY_NOT_FOUND,
        });
      }

      try {
        const todo = await todoRepository.findById(id);
        callback({
          data: todo,
        });
      } catch (e) {
        callback({
          error: sanitizeErrorMessage(e),
        });
      }
    },

    updateTodo: async function (
      payload: Todo,
      callback: (res?: Response<void>) => void
    ) {
      // @ts-ignore
      const socket: Socket<ClientEvents, ServerEvents> = this;

      const { error, value } = todoSchema.tailor("update").validate(payload, {
        abortEarly: false,
        stripUnknown: true,
      });

      if (error) {
        return callback({
          error: Errors.INVALID_PAYLOAD,
          errorDetails: mapErrorDetails(error.details),
        });
      }

      try {
        await todoRepository.save(value);
      } catch (e) {
        return callback({
          error: sanitizeErrorMessage(e),
        });
      }

      callback();
      socket.broadcast.emit("todo:updated", value);
    },

    deleteTodo: async function (
      id: TodoID,
      callback: (res?: Response<void>) => void
    ) {
      // @ts-ignore
      const socket: Socket<ClientEvents, ServerEvents> = this;

      const { error } = idSchema.validate(id);

      if (error) {
        return callback({
          error: Errors.ENTITY_NOT_FOUND,
        });
      }

      try {
        await todoRepository.deleteById(id);
      } catch (e) {
        return callback({
          error: sanitizeErrorMessage(e),
        });
      }

      callback();
      socket.broadcast.emit("todo:deleted", id);
    },

    listTodo: async function (callback: (res: Response<Todo[]>) => void) {
      try {
        callback({
          data: await todoRepository.findAll(),
        });
      } catch (e) {
        callback({
          error: sanitizeErrorMessage(e),
        });
      }
    },
  };
}
