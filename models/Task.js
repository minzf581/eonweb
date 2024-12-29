const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Task = sequelize.define('Task', {
    title: {
        type: DataTypes.STRING,
        allowNull: false
    },
    description: {
        type: DataTypes.TEXT,
        allowNull: false
    },
    points: {
        type: DataTypes.INTEGER,
        allowNull: false,
        validate: {
            min: 0
        }
    },
    type: {
        type: DataTypes.ENUM('daily', 'weekly', 'one-time'),
        allowNull: false
    },
    requirements: {
        type: DataTypes.ARRAY(DataTypes.STRING),
        defaultValue: []
    },
    verificationMethod: {
        type: DataTypes.ENUM('automatic', 'manual'),
        defaultValue: 'automatic'
    },
    isActive: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
    },
    status: {
        type: DataTypes.STRING,
        defaultValue: 'coming_soon',
        validate: {
            isIn: [['active', 'completed', 'coming_soon']]
        }
    },
    startDate: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    },
    endDate: {
        type: DataTypes.DATE
    }
}, {
    timestamps: true
});

module.exports = Task;
