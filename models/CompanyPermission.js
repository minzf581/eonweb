const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

/**
 * CompanyPermission 模型
 * 用于管理员指定公司信息可被哪些 Staff 或 Investor 查看/审批
 */
const CompanyPermission = sequelize.define('CompanyPermission', {
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
    // 被授权的用户（Staff 或 Investor）
    user_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
            model: 'users',
            key: 'id'
        }
    },
    // 权限类型
    permission_type: {
        type: DataTypes.STRING(20),
        allowNull: false,
        defaultValue: 'view',
        comment: 'view: 仅查看, review: 可审核, full: 完全访问'
    },
    // 授权者
    granted_by: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
            model: 'users',
            key: 'id'
        }
    },
    // 过期时间（可选）
    expires_at: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: '权限过期时间，null表示永久有效'
    },
    // 备注
    notes: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    // 是否活跃
    is_active: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
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
    tableName: 'company_permissions',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
        {
            unique: true,
            fields: ['company_id', 'user_id']
        }
    ]
});

module.exports = CompanyPermission;
