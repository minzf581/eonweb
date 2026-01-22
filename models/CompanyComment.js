const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

/**
 * CompanyComment 模型
 * 用于管理员、Staff和企业之间的持续反馈交流
 */
const CompanyComment = sequelize.define('CompanyComment', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    // 关联的企业
    company_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
            model: 'companies',
            key: 'id'
        }
    },
    // 评论者
    user_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
            model: 'users',
            key: 'id'
        }
    },
    // 评论内容
    content: {
        type: DataTypes.TEXT,
        allowNull: false
    },
    // 评论者角色（冗余存储，方便查询展示）
    user_role: {
        type: DataTypes.STRING(20),
        allowNull: false,
        comment: 'admin, staff, company'
    },
    // 企业是否已读
    is_read_by_company: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    // 管理员/Staff 是否已读
    is_read_by_admin: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    // 上次管理员读取时间
    admin_read_at: {
        type: DataTypes.DATE,
        allowNull: true
    },
    // 上次企业读取时间
    company_read_at: {
        type: DataTypes.DATE,
        allowNull: true
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
    tableName: 'company_comments',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
});

module.exports = CompanyComment;
