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
      foreignKey: 'taskid'
    });
  };

  return UserTask;
};
