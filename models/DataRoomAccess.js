const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

/**
 * DataRoomAccess - 资料库访问权限
 * 控制投资人/Staff对特定公司资料库的访问层级
 */
const DataRoomAccess = sequelize.define('DataRoomAccess', {
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
    user_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
            model: 'users',
            key: 'id'
        }
    },
    granted_by: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
            model: 'users',
            key: 'id'
        },
        comment: '授权人用户ID'
    },
    // 访问层级：overview（概览）, nda（签署NDA后）, full_dd（全面尽职调查）
    access_level: {
        type: DataTypes.STRING(20),
        allowNull: false,
        defaultValue: 'overview',
        comment: '访问层级: overview, nda, full_dd'
    },
    // NDA 签署状态
    nda_signed: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        comment: 'NDA是否已签署'
    },
    nda_signed_at: {
        type: DataTypes.DATE,
        allowNull: true
    },
    nda_document_id: {
        type: DataTypes.UUID,
        allowNull: true,
        comment: '签署的NDA文档ID'
    },
    // 访问权限状态
    status: {
        type: DataTypes.STRING(20),
        defaultValue: 'active',
        comment: 'active, suspended, revoked'
    },
    // 过期时间
    expires_at: {
        type: DataTypes.DATE,
        allowNull: true
    },
    // 备注
    notes: {
        type: DataTypes.TEXT,
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
    tableName: 'data_room_access',
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

// 访问层级定义
DataRoomAccess.ACCESS_LEVELS = {
    overview: { level: 1, name: '概览', name_en: 'Overview' },
    nda: { level: 2, name: 'NDA签署后', name_en: 'Post-NDA' },
    full_dd: { level: 3, name: '全面尽职调查', name_en: 'Full DD' }
};

// 检查访问权限
DataRoomAccess.checkAccess = function(userAccessLevel, requiredLevel) {
    const levels = DataRoomAccess.ACCESS_LEVELS;
    const userLevel = levels[userAccessLevel]?.level || 0;
    const reqLevel = levels[requiredLevel]?.level || 0;
    return userLevel >= reqLevel;
};

module.exports = DataRoomAccess;
