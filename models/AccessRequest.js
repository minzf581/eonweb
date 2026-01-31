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
    // 请求类型 - 改用STRING避免Sequelize ENUM同步bug
    request_type: {
        type: DataTypes.STRING(20),
        allowNull: false
    },
    // 请求说明
    message: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: '投资人留言'
    },
    // 状态 - 改用STRING避免Sequelize ENUM同步bug
    status: {
        type: DataTypes.STRING(20),
        defaultValue: 'pending'
    },
    // 处理回复
    admin_response: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: '处理回复（可由管理员或企业/staff填写）'
    },
    processed_at: {
        type: DataTypes.DATE,
        allowNull: true
    },
    processed_by: {
        type: DataTypes.UUID,
        allowNull: true,
        comment: '处理人ID（可以是管理员、企业或staff）'
    },
    // 处理人角色
    processed_by_role: {
        type: DataTypes.STRING(20),
        allowNull: true,
        comment: '处理人角色: admin, company, staff'
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
