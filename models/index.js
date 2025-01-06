const { Sequelize } = require('sequelize');
const sequelize = require('../config/sequelize');

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
User.hasMany(PointHistory);
PointHistory.belongsTo(User);

User.hasMany(UserTask);
Task.hasMany(UserTask);
UserTask.belongsTo(User);
UserTask.belongsTo(Task);

User.hasMany(Referral, { foreignKey: 'referrerId', as: 'Referrals' });
User.hasMany(Referral, { foreignKey: 'referredId', as: 'ReferredBy' });
Referral.belongsTo(User, { foreignKey: 'referrerId', as: 'Referrer' });
Referral.belongsTo(User, { foreignKey: 'referredId', as: 'Referred' });

// Export models and sequelize instance
module.exports = models;
