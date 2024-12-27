const User = require('./User');
const Task = require('./Task');
const UserTask = require('./UserTask');
const PointHistory = require('./PointHistory');
const Settings = require('./Settings');
const Referral = require('./Referral');

// Define relationships
User.hasMany(UserTask, {
    foreignKey: 'userId',
    as: 'tasks'
});
UserTask.belongsTo(User, {
    foreignKey: 'userId'
});

Task.hasMany(UserTask, {
    foreignKey: 'taskId',
    as: 'userTasks'
});
UserTask.belongsTo(Task, {
    foreignKey: 'taskId'
});

User.hasMany(PointHistory, {
    foreignKey: 'userId',
    as: 'pointHistory'
});
PointHistory.belongsTo(User, {
    foreignKey: 'userId'
});

// Referral relationships
User.hasMany(Referral, {
    foreignKey: 'referrerId',
    as: 'referralsGiven'  
});
Referral.belongsTo(User, {
    foreignKey: 'referrerId',
    as: 'referrer'
});

User.hasOne(Referral, {
    foreignKey: 'referredId',
    as: 'referralReceived'  
});
Referral.belongsTo(User, {
    foreignKey: 'referredId',
    as: 'referred'
});

module.exports = {
    User,
    Task,
    UserTask,
    PointHistory,
    Settings,
    Referral
};
