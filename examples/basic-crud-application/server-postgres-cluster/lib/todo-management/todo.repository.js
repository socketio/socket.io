import { Errors } from "../util.js";
import { Model, DataTypes } from "sequelize";

class CrudRepository {
  findAll() {}
  findById(id) {}
  save(entity) {}
  deleteById(id) {}
}

export class TodoRepository extends CrudRepository {}

class Todo extends Model {}

export class PostgresTodoRepository extends TodoRepository {
  constructor(sequelize) {
    super();
    this.sequelize = sequelize;

    Todo.init(
      {
        id: {
          type: DataTypes.STRING,
          primaryKey: true,
          allowNull: false,
        },
        title: {
          type: DataTypes.STRING,
        },
        completed: {
          type: DataTypes.BOOLEAN,
        },
      },
      {
        sequelize,
        tableName: "todos",
      }
    );
  }

  findAll() {
    return this.sequelize.transaction((transaction) => {
      return Todo.findAll({ transaction });
    });
  }

  async findById(id) {
    return this.sequelize.transaction(async (transaction) => {
      const todo = await Todo.findByPk(id, { transaction });

      if (!todo) {
        throw Errors.ENTITY_NOT_FOUND;
      }

      return todo;
    });
  }

  save(entity) {
    return this.sequelize.transaction((transaction) => {
      return Todo.upsert(entity, { transaction });
    });
  }

  async deleteById(id) {
    return this.sequelize.transaction(async (transaction) => {
      const count = await Todo.destroy({ where: { id }, transaction });

      if (count === 0) {
        throw Errors.ENTITY_NOT_FOUND;
      }
    });
  }
}
