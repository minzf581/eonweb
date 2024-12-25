const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const UserTask = sequelize.define('UserTask', {
    userId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'Users',
            key: 'id'
        }
    },
    taskId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'Tasks',
            key: 'id'
        }
    },
    status: {
        type: DataTypes.ENUM('started', 'completed', 'failed'),
        defaultValue: 'started'
    },
    startedAt: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    },
    completedAt: {
        type: DataTypes.DATE
    }
}, {
    indexes: [
        {
            unique: true,
            fields: ['userId', 'taskId']
        }
    ]
});

module.exports = UserTask;
