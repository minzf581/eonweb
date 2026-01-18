const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const InvestorProfile = sequelize.define('InvestorProfile', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    user_id: {
        type: DataTypes.UUID,
        allowNull: false,
        unique: true,
        references: {
            model: 'users',
            key: 'id'
        }
    },
    // 投资人/机构名称
    name: {
        type: DataTypes.STRING,
        allowNull: false,
        comment: '投资人/机构名称'
    },
    // 投资人类型 - 改用STRING避免Sequelize ENUM同步bug
    investor_type: {
        type: DataTypes.STRING(30),
        allowNull: false
    },
    // 公司/机构名称
    organization: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: '所属机构'
    },
    // 职位
    title: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: '职位'
    },
    // 联系方式
    phone: {
        type: DataTypes.STRING,
        allowNull: true
    },
    wechat: {
        type: DataTypes.STRING,
        allowNull: true
    },
    whatsapp: {
        type: DataTypes.STRING,
        allowNull: true
    },
    linkedin: {
        type: DataTypes.STRING,
        allowNull: true
    },
    // 投资偏好
    industries: {
        type: DataTypes.ARRAY(DataTypes.STRING),
        defaultValue: [],
        comment: '关注行业'
    },
    stages: {
        type: DataTypes.ARRAY(DataTypes.STRING),
        defaultValue: [],
        comment: '关注阶段'
    },
    ticket_size_min: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: true,
        comment: '最小投资金额'
    },
    ticket_size_max: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: true,
        comment: '最大投资金额'
    },
    regions: {
        type: DataTypes.ARRAY(DataTypes.STRING),
        defaultValue: [],
        comment: '关注地区'
    },
    // 简介
    bio: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: '投资人简介'
    },
    // 审核状态 - 改用STRING避免Sequelize ENUM同步bug
    status: {
        type: DataTypes.STRING(20),
        defaultValue: 'pending'
    },
    // 管理员备注
    admin_notes: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    reviewed_at: {
        type: DataTypes.DATE,
        allowNull: true
    },
    reviewed_by: {
        type: DataTypes.UUID,
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
    tableName: 'investor_profiles',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
});

module.exports = InvestorProfile;
