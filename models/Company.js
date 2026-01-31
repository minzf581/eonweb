const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Company = sequelize.define('Company', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    user_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
            model: 'users',
            key: 'id'
        }
    },
    // 创建者（普通管理员创建企业时使用）
    created_by: {
        type: DataTypes.UUID,
        allowNull: true,
        references: {
            model: 'users',
            key: 'id'
        },
        comment: '创建此企业的管理员用户ID'
    },
    // 基本信息（所有字段可选，只需要 name_cn 或 name_en 其中一个）
    name_cn: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: '公司中文名称'
    },
    name_en: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: '公司英文名称'
    },
    website: {
        type: DataTypes.STRING,
        allowNull: true
    },
    linkedin: {
        type: DataTypes.STRING,
        allowNull: true
    },
    // 行业信息
    industry_primary: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: '主要行业'
    },
    industry_secondary: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: '次要行业'
    },
    // 地区
    location_headquarters: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: '总部所在地'
    },
    location_rd: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: '研发中心所在地'
    },
    // 公司简介
    description: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: '一句话产品简介'
    },
    description_detail: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: '详细公司介绍'
    },
    // 阶段 - 改用STRING避免Sequelize ENUM同步bug
    stage: {
        type: DataTypes.STRING(20),
        allowNull: true
    },
    // 联系人信息
    contact_name: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: '联系人姓名'
    },
    contact_title: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: '联系人职务'
    },
    contact_email: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: '联系人邮箱'
    },
    contact_phone: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: '联系人电话'
    },
    contact_wechat: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: '联系人微信'
    },
    contact_whatsapp: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: '联系人WhatsApp'
    },
    // 状态和审核 - 改用STRING避免Sequelize ENUM同步bug
    status: {
        type: DataTypes.STRING(20),
        defaultValue: 'draft'
    },
    // 可见性: private(私有), admin_only(仅管理员), partial(部分公开-可见信息不可见BP/DataRoom), public(完全公开-可见信息和BP)
    visibility: {
        type: DataTypes.STRING(20),
        defaultValue: 'private',
        comment: '可见性: private, admin_only, partial, public'
    },
    // 管理员备注
    admin_notes: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: '管理员内部备注'
    },
    admin_feedback: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: '给企业的反馈'
    },
    tags: {
        type: DataTypes.ARRAY(DataTypes.STRING),
        defaultValue: [],
        comment: '标签'
    },
    // 交易状态：new（新项目）、dd（尽职调查中）、term_sheet（条款清单阶段）、closed（已关闭）
    deal_status: {
        type: DataTypes.STRING(20),
        defaultValue: 'new',
        comment: '交易状态: new, dd, term_sheet, closed'
    },
    // 新加坡准备情况
    sg_ready: {
        type: DataTypes.STRING(20),
        defaultValue: 'not_ready',
        comment: 'SG准备状态: not_ready, in_progress, ready'
    },
    // Data Room 是否启用
    data_room_enabled: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        comment: '是否启用资料库'
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
    tableName: 'companies',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
});

// 返回脱敏信息（用于投资人浏览）
Company.prototype.toPublicObject = function() {
    return {
        id: this.id,
        name_cn: this.name_cn,
        name_en: this.name_en,
        industry_primary: this.industry_primary,
        industry_secondary: this.industry_secondary,
        location_headquarters: this.location_headquarters,
        description: this.description,
        stage: this.stage,
        tags: this.tags,
        created_at: this.created_at
        // 不包含联系人信息
    };
};

module.exports = Company;
