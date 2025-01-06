const { Model, DataTypes } = require('sequelize');

class Task extends Model {
    static associate(models) {
        Task.hasMany(models.UserTask, {
            foreignKey: 'taskid'
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
            type: DataTypes.ENUM('daily', 'weekly', 'monthly', 'one_time'),
            allowNull: false
        },
        points: {
            type: DataTypes.INTEGER,
            defaultValue: 0
        },
        status: {
            type: DataTypes.ENUM('active', 'inactive'),
            defaultValue: 'active'
        }
    }, {
        sequelize,
        modelName: 'Task',
        tableName: 'tasks',
        underscored: true,
        timestamps: true,
        createdAt: 'createdat',
        updatedAt: 'updatedat'
    });

    return Task;
};

module.exports = initTask;
