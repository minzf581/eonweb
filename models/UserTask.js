const { Model, DataTypes } = require('sequelize');

class UserTask extends Model {
    static associate(models) {
        // Define associations here if needed
        // This method will be called in models/index.js
    }
}

const initUserTask = (sequelize) => {
    UserTask.init({
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
        sequelize,
        modelName: 'UserTask',
        indexes: [
            {
                unique: true,
                fields: ['userId', 'taskId']
            }
        ]
    });

    return UserTask;
};

module.exports = initUserTask;
