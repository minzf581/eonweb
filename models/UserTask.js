const { Model, DataTypes } = require('sequelize');

class UserTask extends Model {
    static associate(models) {
        UserTask.belongsTo(models.User, {
            foreignKey: 'userid',
            as: 'user'
        });
        UserTask.belongsTo(models.Task, {
            foreignKey: 'taskid',
            as: 'task'
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
            },
            field: 'userid'
        },
        taskid: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: 'tasks',
                key: 'id'
            },
            field: 'taskid'
        },
        status: {
            type: DataTypes.ENUM('pending', 'in_progress', 'completed', 'failed'),
            defaultValue: 'pending'
        },
        startTime: {
            type: DataTypes.DATE,
            field: 'starttime'
        },
        endTime: {
            type: DataTypes.DATE,
            field: 'endtime'
        },
        points: {
            type: DataTypes.INTEGER,
            defaultValue: 0
        },
        deletedAt: {
            type: DataTypes.DATE,
            allowNull: true,
            field: 'deleted_at'
        },
        createdAt: {
            type: DataTypes.DATE,
            field: 'created_at'
        },
        updatedAt: {
            type: DataTypes.DATE,
            field: 'updated_at'
        }
    }, {
        sequelize,
        modelName: 'UserTask',
        tableName: 'user_tasks',
        timestamps: true,
        paranoid: true,
        underscored: false, 
        createdAt: 'created_at',
        updatedAt: 'updated_at',
        deletedAt: 'deleted_at'
    });

    return UserTask;
};

module.exports = initUserTask;
