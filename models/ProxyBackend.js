const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const ProxyBackend = sequelize.define('ProxyBackend', {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true,
        },
        name: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        apiKey: {
            type: DataTypes.STRING,
            allowNull: false,
            unique: true,
        },
        status: {
            type: DataTypes.ENUM('active', 'inactive'),
            defaultValue: 'active',
            allowNull: false,
        },
        lastSyncTime: {
            type: DataTypes.DATE,
            allowNull: true,
        },
        totalNodes: {
            type: DataTypes.INTEGER,
            defaultValue: 0,
        },
        activeNodes: {
            type: DataTypes.INTEGER,
            defaultValue: 0,
        }
    });

    return ProxyBackend;
};
