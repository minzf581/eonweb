const { sequelize } = require('../config/database');
const User = require('./User');
const Company = require('./Company');
const FundraisingInfo = require('./FundraisingInfo');
const Document = require('./Document');
const InvestorProfile = require('./InvestorProfile');
const AccessRequest = require('./AccessRequest');

// 设置关联关系

// User - Company (一对一)
User.hasOne(Company, { foreignKey: 'user_id', as: 'company' });
Company.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

// User - InvestorProfile (一对一)
User.hasOne(InvestorProfile, { foreignKey: 'user_id', as: 'investorProfile' });
InvestorProfile.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

// Company - FundraisingInfo (一对一)
Company.hasOne(FundraisingInfo, { foreignKey: 'company_id', as: 'fundraisingInfo' });
FundraisingInfo.belongsTo(Company, { foreignKey: 'company_id', as: 'company' });

// Company - Document (一对多)
Company.hasMany(Document, { foreignKey: 'company_id', as: 'documents' });
Document.belongsTo(Company, { foreignKey: 'company_id', as: 'company' });

// AccessRequest 关联
User.hasMany(AccessRequest, { foreignKey: 'investor_id', as: 'accessRequests' });
AccessRequest.belongsTo(User, { foreignKey: 'investor_id', as: 'investor' });

Company.hasMany(AccessRequest, { foreignKey: 'company_id', as: 'accessRequests' });
AccessRequest.belongsTo(Company, { foreignKey: 'company_id', as: 'company' });

// 同步数据库
const syncDatabase = async (force = false) => {
    try {
        await sequelize.sync({ force, alter: !force });
        console.log('[Database] 数据库模型同步完成');
        return true;
    } catch (error) {
        console.error('[Database] 数据库同步失败:', error.message);
        return false;
    }
};

module.exports = {
    sequelize,
    User,
    Company,
    FundraisingInfo,
    Document,
    InvestorProfile,
    AccessRequest,
    syncDatabase
};
