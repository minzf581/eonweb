const { Model, DataTypes } = require('sequelize');

class UserTask extends Model {
    static associate(models) {
        UserTask.belongsTo(models.User, {
            foreignKey: 'user_id',
            as: 'user'
        });
        UserTask.belongsTo(models.Task, {
            foreignKey: 'task_id',
            as: 'task'
        });
    }
}

const initUserTask = (sequelize) => {
    UserTask.init({
        user_id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: 'users',
                key: 'id'
            }
        },
        task_id: {
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
        start_time: {
            type: DataTypes.DATE
        },
        end_time: {
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
        updatedAt: 'updated_at',
        deletedAt: 'deleted_at',
        paranoid: true
    });

    return UserTask;
};

module.exports = initUserTask;
