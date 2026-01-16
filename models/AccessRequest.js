const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const AccessRequest = sequelize.define('AccessRequest', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    // 请求发起者（投资人）
    investor_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
            model: 'users',
            key: 'id'
        }
    },
    // 目标企业
    company_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
            model: 'companies',
            key: 'id'
        }
    },
    // 请求类型
    request_type: {
        type: DataTypes.ENUM('bp_access', 'referral', 'meeting', 'dataroom'),
        allowNull: false,
        comment: '请求类型：BP访问/引荐/会议/数据室'
    },
    // 请求说明
    message: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: '投资人留言'
    },
    // 状态
    status: {
        type: DataTypes.ENUM('pending', 'approved', 'rejected', 'expired'),
        defaultValue: 'pending',
        comment: '请求状态'
    },
    // 管理员处理
    admin_response: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: '管理员回复'
    },
    processed_at: {
        type: DataTypes.DATE,
        allowNull: true
    },
    processed_by: {
        type: DataTypes.UUID,
        allowNull: true
    },
    // 访问权限有效期
    expires_at: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: '权限过期时间'
    },
    // 访问记录
    accessed_at: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: '最后访问时间'
    },
    access_count: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        comment: '访问次数'
    },
    created_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    },
    updated_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    }
}, {
    tableName: 'access_requests',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
});

module.exports = AccessRequest;
