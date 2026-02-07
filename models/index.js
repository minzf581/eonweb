const { sequelize } = require('../config/database');
const User = require('./User');
const Company = require('./Company');
const FundraisingInfo = require('./FundraisingInfo');
const Document = require('./Document');
const InvestorProfile = require('./InvestorProfile');
const AccessRequest = require('./AccessRequest');
const Message = require('./Message');
const CompanyComment = require('./CompanyComment');
const CompanyPermission = require('./CompanyPermission');
const DataRoomFolder = require('./DataRoomFolder');
const DataRoomFile = require('./DataRoomFile');
const DataRoomAccess = require('./DataRoomAccess');
const DataRoomMessage = require('./DataRoomMessage');
const DataRoomViewLog = require('./DataRoomViewLog');
const InterestExpression = require('./InterestExpression');

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

// Message 关联
User.hasMany(Message, { foreignKey: 'sender_id', as: 'sentMessages' });
Message.belongsTo(User, { foreignKey: 'sender_id', as: 'sender' });

User.hasMany(Message, { foreignKey: 'recipient_id', as: 'receivedMessages' });
Message.belongsTo(User, { foreignKey: 'recipient_id', as: 'recipient' });

Company.hasMany(Message, { foreignKey: 'company_id', as: 'messages' });
Message.belongsTo(Company, { foreignKey: 'company_id', as: 'company' });

// CompanyComment 关联 (持续反馈系统)
Company.hasMany(CompanyComment, { foreignKey: 'company_id', as: 'comments' });
CompanyComment.belongsTo(Company, { foreignKey: 'company_id', as: 'company' });

User.hasMany(CompanyComment, { foreignKey: 'user_id', as: 'companyComments' });
CompanyComment.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

// CompanyPermission 关联 (权限控制)
Company.hasMany(CompanyPermission, { foreignKey: 'company_id', as: 'permissions' });
CompanyPermission.belongsTo(Company, { foreignKey: 'company_id', as: 'company' });

User.hasMany(CompanyPermission, { foreignKey: 'user_id', as: 'companyPermissions' });
CompanyPermission.belongsTo(User, { foreignKey: 'user_id', as: 'permittedUser' });

User.hasMany(CompanyPermission, { foreignKey: 'granted_by', as: 'grantedPermissions' });
CompanyPermission.belongsTo(User, { foreignKey: 'granted_by', as: 'grantedByUser' });

// DataRoomFolder 关联
Company.hasMany(DataRoomFolder, { foreignKey: 'company_id', as: 'dataRoomFolders' });
DataRoomFolder.belongsTo(Company, { foreignKey: 'company_id', as: 'company' });

// DataRoomFile 关联
Company.hasMany(DataRoomFile, { foreignKey: 'company_id', as: 'dataRoomFiles' });
DataRoomFile.belongsTo(Company, { foreignKey: 'company_id', as: 'company' });

DataRoomFolder.hasMany(DataRoomFile, { foreignKey: 'folder_id', as: 'files' });
DataRoomFile.belongsTo(DataRoomFolder, { foreignKey: 'folder_id', as: 'folder' });

User.hasMany(DataRoomFile, { foreignKey: 'uploaded_by', as: 'uploadedFiles' });
DataRoomFile.belongsTo(User, { foreignKey: 'uploaded_by', as: 'uploader' });

// DataRoomAccess 关联
Company.hasMany(DataRoomAccess, { foreignKey: 'company_id', as: 'dataRoomAccess' });
DataRoomAccess.belongsTo(Company, { foreignKey: 'company_id', as: 'company' });

User.hasMany(DataRoomAccess, { foreignKey: 'user_id', as: 'dataRoomPermissions' });
DataRoomAccess.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

User.hasMany(DataRoomAccess, { foreignKey: 'granted_by', as: 'grantedDataRoomAccess' });
DataRoomAccess.belongsTo(User, { foreignKey: 'granted_by', as: 'grantedByUser' });

// DataRoomMessage 关联
Company.hasMany(DataRoomMessage, { foreignKey: 'company_id', as: 'dataRoomMessages' });
DataRoomMessage.belongsTo(Company, { foreignKey: 'company_id', as: 'company' });

User.hasMany(DataRoomMessage, { foreignKey: 'investor_id', as: 'investorDataRoomMessages' });
DataRoomMessage.belongsTo(User, { foreignKey: 'investor_id', as: 'investor' });

User.hasMany(DataRoomMessage, { foreignKey: 'sender_id', as: 'sentDataRoomMessages' });
DataRoomMessage.belongsTo(User, { foreignKey: 'sender_id', as: 'messageSender' });

DataRoomFile.hasMany(DataRoomMessage, { foreignKey: 'file_id', as: 'messages' });
DataRoomMessage.belongsTo(DataRoomFile, { foreignKey: 'file_id', as: 'file' });

// DataRoomViewLog 关联
Company.hasMany(DataRoomViewLog, { foreignKey: 'company_id', as: 'dataRoomViewLogs' });
DataRoomViewLog.belongsTo(Company, { foreignKey: 'company_id', as: 'company' });

User.hasMany(DataRoomViewLog, { foreignKey: 'user_id', as: 'viewLogs' });
DataRoomViewLog.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

DataRoomFolder.hasMany(DataRoomViewLog, { foreignKey: 'folder_id', as: 'viewLogs' });
DataRoomViewLog.belongsTo(DataRoomFolder, { foreignKey: 'folder_id', as: 'folder' });

DataRoomFile.hasMany(DataRoomViewLog, { foreignKey: 'file_id', as: 'viewLogs' });
DataRoomViewLog.belongsTo(DataRoomFile, { foreignKey: 'file_id', as: 'file' });

// InterestExpression 关联
Company.hasMany(InterestExpression, { foreignKey: 'company_id', as: 'interestExpressions' });
InterestExpression.belongsTo(Company, { foreignKey: 'company_id', as: 'company' });

User.hasMany(InterestExpression, { foreignKey: 'investor_id', as: 'expressedInterests' });
InterestExpression.belongsTo(User, { foreignKey: 'investor_id', as: 'investor' });

User.hasMany(InterestExpression, { foreignKey: 'follow_up_by', as: 'followedInterests' });
InterestExpression.belongsTo(User, { foreignKey: 'follow_up_by', as: 'followUpUser' });

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
    Message,
    CompanyComment,
    CompanyPermission,
    DataRoomFolder,
    DataRoomFile,
    DataRoomAccess,
    DataRoomMessage,
    DataRoomViewLog,
    InterestExpression,
    syncDatabase
};
