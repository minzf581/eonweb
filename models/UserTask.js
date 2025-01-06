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
      field: 'userid'  // Explicitly map to database column
    },
    taskid: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'taskid'  // Explicitly map to database column
    },
    status: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'pending'
    },
    startTime: {
      type: DataTypes.DATE,
      field: 'starttime'  // Explicitly map to database column
    },
    endTime: {
      type: DataTypes.DATE,
      field: 'endtime'  // Explicitly map to database column
    },
    points: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    }
  }, {
    tableName: 'user_tasks',
    underscored: true,  // Use snake_case for auto-generated fields
    timestamps: true,
    paranoid: true,
    createdAt: 'createdat',  // Map to actual database column names
    updatedAt: 'updatedat',
    deletedAt: 'deletedat'
  });

  UserTask.associate = (models) => {
    UserTask.belongsTo(models.User, {
      foreignKey: 'userid',
      as: 'user'
    });
    UserTask.belongsTo(models.Task, {
      foreignKey: 'taskid',
      as: 'task'
    });
  };

  return UserTask;
};
