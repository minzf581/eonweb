const { Model, DataTypes } = require('sequelize');

class UserTask extends Model {
    static associate(models) {
        UserTask.belongsTo(models.User, {
            foreignKey: 'userid'
        });
        UserTask.belongsTo(models.Task, {
            foreignKey: 'taskid'
        });
    }
}

const initUserTask = (sequelize) => {
    UserTask.init({
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
            type: DataTypes.ENUM('pending', 'in_progress', 'completed', 'failed'),
            defaultValue: 'pending'
        },
        starttime: {
            type: DataTypes.DATE
        },
        endtime: {
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
        createdAt: 'createdat',
        updatedAt: 'updatedat'
    });

    return UserTask;
};

module.exports = initUserTask;
