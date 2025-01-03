const { Sequelize } = require('sequelize');
const path = require('path');

// Load environment variables
if (process.env.NODE_ENV === 'production') {
    require('dotenv').config({ path: path.join(__dirname, '../.env.production') });
} else {
    require('dotenv').config({ path: path.join(__dirname, '../.env') });
}

// Create Sequelize instance
const env = process.env.NODE_ENV || 'development';
const config = {
    dialect: 'postgres',
    database: process.env.DB_NAME || 'eon_protocol',
    username: process.env.DB_USER || 'eonuser',
    password: process.env.DB_PASSWORD,
    host: process.env.DB_HOST || '/cloudsql/eonhome-445809:asia-southeast2:eon-db',
    dialectOptions: env === 'production' ? {
        socketPath: process.env.DB_HOST || '/cloudsql/eonhome-445809:asia-southeast2:eon-db'
    } : undefined,
    pool: {
        max: 5,
        min: 0,
        acquire: 30000,
        idle: 10000
    },
    logging: console.log
};

const sequelize = new Sequelize(config);

// Import model initializers
const initUser = require('./User');
const initTask = require('./Task');
const initUserTask = require('./UserTask');
const initPointHistory = require('./PointHistory');
const initSettings = require('./Settings');
const initReferral = require('./Referral');

// Initialize models
const User = initUser(sequelize);
const Task = initTask(sequelize);
const UserTask = initUserTask(sequelize);
const PointHistory = initPointHistory(sequelize);
const Settings = initSettings(sequelize);
const Referral = initReferral(sequelize);

// Define models object
const models = {
    User,
    Task,
    UserTask,
    PointHistory,
    Settings,
    Referral,
    sequelize
};

// Call associate methods if they exist
Object.values(models).forEach(model => {
    if (model.associate && typeof model.associate === 'function') {
        model.associate(models);
    }
});

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

// Export models and sequelize instance
module.exports = models;
