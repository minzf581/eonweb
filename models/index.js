const { Sequelize } = require('sequelize');
const { runtimeConfig } = require('../config/database');

// 创建 Sequelize 实例
const env = process.env.NODE_ENV || 'development';
const config = runtimeConfig[env];
const sequelize = new Sequelize(config);

const User = require('./User');
const Task = require('./Task');
const UserTask = require('./UserTask');
const PointHistory = require('./PointHistory');
const Settings = require('./Settings');
const Referral = require('./Referral');

// 初始化模型
const models = {
    User: User(sequelize),
    Task: Task(sequelize),
    UserTask: UserTask(sequelize),
    PointHistory: PointHistory(sequelize),
    Settings: Settings(sequelize),
    Referral: Referral(sequelize)
};

// Define relationships
models.User.hasMany(models.UserTask, {
    foreignKey: 'userId',
    as: 'tasks'
});
models.UserTask.belongsTo(models.User, {
    foreignKey: 'userId'
});

models.Task.hasMany(models.UserTask, {
    foreignKey: 'taskId',
    as: 'userTasks'
});
models.UserTask.belongsTo(models.Task, {
    foreignKey: 'taskId'
});

models.User.hasMany(models.PointHistory, {
    foreignKey: 'userId',
    as: 'pointHistory'
});
models.PointHistory.belongsTo(models.User, {
    foreignKey: 'userId'
});

// Referral relationships
models.User.hasMany(models.Referral, {
    foreignKey: 'referrerId',
    as: 'referralsGiven'  
});
models.Referral.belongsTo(models.User, {
    foreignKey: 'referrerId',
    as: 'referrer'
});

models.User.hasOne(models.Referral, {
    foreignKey: 'referredId',
    as: 'referralReceived'  
});
models.Referral.belongsTo(models.User, {
    foreignKey: 'referredId',
    as: 'referred'
});

// Add the sequelize instance to the models
Object.values(models).forEach(model => {
    if (model.associate) {
        model.associate(models);
    }
});

module.exports = {
    sequelize,
    ...models
};
