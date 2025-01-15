const { Model, DataTypes } = require('sequelize');

class Settings extends Model {
    static associate(models) {
        // Define associations here if needed
        // This method will be called in models/index.js
    }
}

const initSettings = (sequelize) => {
    Settings.init({
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
        sequelize,
        modelName: 'Settings',
        timestamps: true
    });

    return Settings;
};

module.exports = initSettings;
