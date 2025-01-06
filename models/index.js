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
User.hasMany(PointHistory);
PointHistory.belongsTo(User);

User.hasMany(UserTask, { as: 'userTasks' });
Task.hasMany(UserTask, { as: 'userTasks' });
UserTask.belongsTo(User, { as: 'user' });
UserTask.belongsTo(Task, { as: 'task' });

User.hasMany(Referral, { foreignKey: 'referrerId', as: 'referrals' });
User.hasMany(Referral, { foreignKey: 'referredId', as: 'referredBy' });
Referral.belongsTo(User, { foreignKey: 'referrerId', as: 'referrer' });
Referral.belongsTo(User, { foreignKey: 'referredId', as: 'referred' });

User.hasMany(NodeStatus, { foreignKey: 'userId', as: 'nodes' });
NodeStatus.belongsTo(User, { foreignKey: 'userId', as: 'user' });

// Export models and sequelize instance
module.exports = models;
