const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const FundraisingInfo = sequelize.define('FundraisingInfo', {
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
    // 融资目的
    purpose: {
        type: DataTypes.ARRAY(DataTypes.STRING),
        allowNull: false,
        comment: '融资目的：出海建厂/并购/营运资金等'
    },
    // 融资类型偏好
    financing_type: {
        type: DataTypes.ARRAY(DataTypes.STRING),
        allowNull: false,
        comment: '融资类型：股权/债/项目融资/RWA等'
    },
    // 融资金额
    amount_min: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: false,
        comment: '最低融资金额（美元）'
    },
    amount_max: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: false,
        comment: '最高融资金额（美元）'
    },
    amount_currency: {
        type: DataTypes.STRING,
        defaultValue: 'USD',
        comment: '金额币种'
    },
    // 时间窗口 - 改用STRING避免Sequelize ENUM同步bug
    timeline: {
        type: DataTypes.STRING(20),
        allowNull: false
    },
    // 估值预期
    valuation_expectation: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: '估值预期'
    },
    // 资金用途
    use_of_funds: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: '资金用途详细说明'
    },
    // 海外结构现状
    overseas_structure: {
        type: DataTypes.JSONB,
        defaultValue: {},
        comment: '海外结构：{ sg: boolean, hk: boolean, us: boolean, other: string }'
    },
    // IP 归属
    ip_ownership: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: 'IP 归属情况'
    },
    ip_transferable: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        comment: 'IP 是否可迁移'
    },
    ip_notes: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'IP 相关备注'
    },
    // 数据敏感性 - 改用STRING避免Sequelize ENUM同步bug
    data_sensitivity: {
        type: DataTypes.STRING(20),
        defaultValue: 'medium'
    },
    data_sensitivity_notes: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: '数据敏感性说明'
    },
    // 其他信息
    additional_info: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: '其他补充信息'
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
    tableName: 'fundraising_info',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
});

// 返回脱敏信息
FundraisingInfo.prototype.toPublicObject = function() {
    return {
        id: this.id,
        purpose: this.purpose,
        financing_type: this.financing_type,
        amount_min: this.amount_min,
        amount_max: this.amount_max,
        amount_currency: this.amount_currency,
        timeline: this.timeline,
        // 不包含详细财务信息
    };
};

module.exports = FundraisingInfo;
