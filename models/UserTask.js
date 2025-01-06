const { Model, DataTypes } = require('sequelize');

class UserTask extends Model {
    static associate(models) {
        // Define associations here if needed
        // This method will be called in models/index.js
    }
}

const initUserTask = (sequelize) => {
    UserTask.init({
        user_id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: 'Users',
                key: 'id'
            }
        },
        task_id: {
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
        started_at: {
            type: DataTypes.DATE,
            defaultValue: DataTypes.NOW
        },
        completed_at: {
            type: DataTypes.DATE
        }
    }, {
        sequelize,
        modelName: 'UserTask',
        indexes: [
            {
                unique: true,
                fields: ['user_id', 'task_id']
            }
        ]
    });

    return UserTask;
};

module.exports = initUserTask;
