const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const UserTask = sequelize.define('UserTask', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    userid: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id'
      }
    },
    taskid: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'tasks',
        key: 'id'
      }
    },
    status: {
      type: DataTypes.STRING,
      defaultValue: 'pending'
    },
    points: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    start_time: {
      type: DataTypes.DATE
    },
    end_time: {
      type: DataTypes.DATE
    }
  }, {
    tableName: 'user_tasks',
    underscored: true,
    timestamps: true,
    paranoid: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    deletedAt: 'deleted_at'
  });

  UserTask.associate = (models) => {
    UserTask.belongsTo(models.User, {
      foreignKey: 'userid'
    });
    UserTask.belongsTo(models.Task, {
      foreignKey: 'taskid',
      as: 'task'
    });
  };

  return UserTask;
};
