const { Model, DataTypes } = require('sequelize');

class Task extends Model {
    static associate(models) {
        Task.hasMany(models.UserTask, {
            foreignKey: 'taskid',
            as: 'userTasks'
        });
    }
}

const initTask = (sequelize) => {
    Task.init({
        name: {
            type: DataTypes.STRING,
            allowNull: false
        },
        description: {
            type: DataTypes.TEXT
        },
        type: {
            type: DataTypes.ENUM('daily', 'bandwidth', 'proxy'),
            allowNull: false
        },
        points: {
            type: DataTypes.INTEGER,
            defaultValue: 0
        },
        status: {
            type: DataTypes.ENUM('active', 'inactive'),
            defaultValue: 'active'
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
        modelName: 'Task',
        tableName: 'tasks',
        underscored: false,
        timestamps: true,
        paranoid: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at',
        deletedAt: 'deleted_at'
    });

    return Task;
};

module.exports = initTask;
