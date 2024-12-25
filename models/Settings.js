const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Settings = sequelize.define('Settings', {
    key: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true
    },
    value: {
        type: DataTypes.JSON,
        allowNull: false
    },
    description: {
        type: DataTypes.STRING
    },
    referralPoints: {
        type: DataTypes.INTEGER,
        defaultValue: 100,  // 有推荐码时的积分奖励
        allowNull: false
    },
    baseReferralPoints: {
        type: DataTypes.INTEGER,
        defaultValue: 50,   // 无推荐码时的基础积分
        allowNull: false
    },
    dailyReferralLimit: {
        type: DataTypes.INTEGER,
        defaultValue: 10,   // 每日推荐人数限制
        allowNull: false
    }
}, {
    timestamps: true
});

module.exports = Settings;
