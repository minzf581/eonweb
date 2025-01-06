const { Sequelize } = require('sequelize');
const sequelize = require('../config/database');

// Import model initializers
const initUser = require('./User');
const initTask = require('./Task');
const initUserTask = require('./UserTask');
const initPointHistory = require('./PointHistory');
const initSettings = require('./Settings');
const initReferral = require('./Referral');
const initProxyApiKey = require('./ProxyApiKey');

// Initialize models
const User = initUser(sequelize);
const Task = initTask(sequelize);
const UserTask = initUserTask(sequelize);
const PointHistory = initPointHistory(sequelize);
const Settings = initSettings(sequelize);
const Referral = initReferral(sequelize);
const ProxyApiKey = initProxyApiKey(sequelize);

// Define models object
const models = {
    User,
    Task,
    UserTask,
    PointHistory,
    Settings,
    Referral,
    ProxyApiKey,
    sequelize
};

// Define associations
models.User.hasMany(models.PointHistory);
models.PointHistory.belongsTo(models.User);

models.User.hasMany(models.UserTask, {
    foreignKey: 'userId',
    as: 'tasks'
});
models.Task.hasMany(models.UserTask, {
    foreignKey: 'taskId',
    as: 'userTasks'
});
models.UserTask.belongsTo(models.User, {
    foreignKey: 'userId'
});
models.UserTask.belongsTo(models.Task, {
    foreignKey: 'taskId'
});

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

// Export models and sequelize instance
module.exports = models;
