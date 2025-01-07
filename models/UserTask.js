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
      allowNull: false
    },
    taskid: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    status: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'pending'
    },
    points: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    created_at: {
      type: DataTypes.DATE
    },
    updated_at: {
      type: DataTypes.DATE
    },
    deleted_at: {
      type: DataTypes.DATE,
      allowNull: true
    }
  }, {
    tableName: 'user_tasks',
    underscored: true,
    timestamps: true,
    paranoid: true
  });

  UserTask.associate = (models) => {
    UserTask.belongsTo(models.User, {
      foreignKey: 'userid'
    });
    UserTask.belongsTo(models.Task, {
      foreignKey: 'taskid'
    });
  };

  return UserTask;
};
