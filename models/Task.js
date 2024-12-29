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
        allowNull: false,
        defaultValue: 'one-time'
    },
    requirements: {
        type: DataTypes.ARRAY(DataTypes.STRING),
        defaultValue: []
    },
    verificationMethod: {
        type: DataTypes.ENUM('automatic', 'manual'),
        allowNull: false,
        defaultValue: 'automatic'
    },
    isActive: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
    },
    status: {
        type: DataTypes.ENUM('active', 'completed', 'coming_soon'),
        allowNull: false,
        defaultValue: 'coming_soon'
    },
    startDate: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW
    },
    endDate: {
        type: DataTypes.DATE,
        allowNull: true
    }
}, {
    timestamps: true
});

module.exports = Task;
