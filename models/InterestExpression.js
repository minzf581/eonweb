const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

/**
 * InterestExpression - 表达兴趣记录
 * 投资人对企业的兴趣表达
 */
const InterestExpression = sequelize.define('InterestExpression', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    company_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
            model: 'companies',
            key: 'id'
        }
    },
    investor_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
            model: 'users',
            key: 'id'
        }
    },
    // 兴趣类型
    interest_type: {
        type: DataTypes.STRING(30),
        defaultValue: 'general',
        comment: 'general, high, watching'
    },
    // 投资人留言
    message: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    // 状态
    status: {
        type: DataTypes.STRING(20),
        defaultValue: 'active',
        comment: 'active, withdrawn, converted'
    },
    // 管理员/企业跟进备注
    follow_up_notes: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    follow_up_by: {
        type: DataTypes.UUID,
        allowNull: true,
        references: {
            model: 'users',
            key: 'id'
        }
    },
    follow_up_at: {
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
    tableName: 'interest_expressions',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
        {
            unique: true,
            fields: ['company_id', 'investor_id']
        }
    ]
});

module.exports = InterestExpression;
