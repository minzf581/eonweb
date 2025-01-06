const { Sequelize } = require('sequelize');
const { sequelize } = require('../config/sequelize');

// Import model initializers
const initUser = require('./User');
const initTask = require('./Task');
const initUserTask = require('./UserTask');
const initPointHistory = require('./PointHistory');
const initSettings = require('./Settings');
const initReferral = require('./Referral');
const initProxyApiKey = require('./ProxyApiKey');
const initNodeStatus = require('./NodeStatus');

// Initialize models
const User = initUser(sequelize);
const Task = initTask(sequelize);
const UserTask = initUserTask(sequelize);
const PointHistory = initPointHistory(sequelize);
const Settings = initSettings(sequelize);
const Referral = initReferral(sequelize);
const ProxyApiKey = initProxyApiKey(sequelize);
const NodeStatus = initNodeStatus(sequelize);

// Define models object
const models = {
    User,
    Task,
    UserTask,
    PointHistory,
    Settings,
    Referral,
    ProxyApiKey,
    NodeStatus,
    sequelize
};

// Define associations
User.hasMany(PointHistory, {
    foreignKey: 'userid',
    as: 'pointHistory'
});
PointHistory.belongsTo(User, {
    foreignKey: 'userid',
    as: 'user'
});

User.hasMany(UserTask, {
    foreignKey: 'userid',
    as: 'userTasks'
});
Task.hasMany(UserTask, {
    foreignKey: 'taskid',
    as: 'userTasks'
});
UserTask.belongsTo(User, {
    foreignKey: 'userid',
    as: 'user'
});
UserTask.belongsTo(Task, {
    foreignKey: 'taskid',
    as: 'task'
});

User.hasMany(Referral, {
    foreignKey: 'referrer_id',
    as: 'referrals'
});
User.hasMany(Referral, {
    foreignKey: 'referred_id',
    as: 'referredUsers'  // Changed from referredBy to avoid naming collision
});
Referral.belongsTo(User, {
    foreignKey: 'referrer_id',
    as: 'referrer'
});
Referral.belongsTo(User, {
    foreignKey: 'referred_id',
    as: 'referred'
});

User.hasMany(NodeStatus, {
    foreignKey: 'userid',
    as: 'nodes'
});
NodeStatus.belongsTo(User, {
    foreignKey: 'userid',
    as: 'user'
});

// Export models and sequelize instance
module.exports = models;
