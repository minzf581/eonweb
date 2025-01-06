const { Model, DataTypes } = require('sequelize');

class UserTask extends Model {
    static associate(models) {
        UserTask.belongsTo(models.User, {
            foreignKey: 'userId',
            as: 'user'
        });
        UserTask.belongsTo(models.Task, {
            foreignKey: 'taskId',
            as: 'task'
        });
    }
}

const initUserTask = (sequelize) => {
    UserTask.init({
        userId: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: 'users',
                key: 'id'
            }
        },
        taskId: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: 'tasks',
                key: 'id'
            }
        },
        status: {
            type: DataTypes.ENUM('pending', 'in_progress', 'completed', 'failed'),
            defaultValue: 'pending'
        },
        startTime: {
            type: DataTypes.DATE
        },
        endTime: {
            type: DataTypes.DATE
        },
        points: {
            type: DataTypes.INTEGER,
            defaultValue: 0
        }
    }, {
        sequelize,
        modelName: 'UserTask',
        tableName: 'user_tasks',
        underscored: true,
        timestamps: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at'
    });

    return UserTask;
};

module.exports = initUserTask;
