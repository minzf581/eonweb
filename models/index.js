const { Sequelize } = require('sequelize');
const path = require('path');

// 加载环境变量
if (process.env.NODE_ENV === 'production') {
    require('dotenv').config({ path: path.join(__dirname, '../.env.production') });
} else {
    require('dotenv').config({ path: path.join(__dirname, '../.env') });
}

// 创建 Sequelize 实例
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

// 导入模型定义
const User = require('./User')(sequelize);
const Task = require('./Task')(sequelize);
const UserTask = require('./UserTask')(sequelize);
const PointHistory = require('./PointHistory')(sequelize);
const Settings = require('./Settings')(sequelize);
const Referral = require('./Referral')(sequelize);

// 初始化模型
const models = {
    User,
    Task,
    UserTask,
    PointHistory,
    Settings,
    Referral
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
