const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const PointHistory = sequelize.define('PointHistory', {
    userId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'Users',
            key: 'id'
        }
    },
    points: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    type: {
        type: DataTypes.ENUM('earned', 'referral', 'bonus', 'deducted'),
        allowNull: false
    },
    description: {
        type: DataTypes.STRING,
        allowNull: false
    }
}, {
    timestamps: true,
    updatedAt: false
});

module.exports = PointHistory;
