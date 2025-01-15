const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const ProxyApiKey = sequelize.define('ProxyApiKey', {
        key: {
            type: DataTypes.STRING,
            primaryKey: true,
            allowNull: false,
            comment: 'API密钥'
        },
        name: {
            type: DataTypes.STRING,
            allowNull: false,
            comment: '密钥名称'
        },
        status: {
            type: DataTypes.ENUM('active', 'inactive'),
            allowNull: false,
            defaultValue: 'active',
            comment: '密钥状态'
        },
        lastUsedAt: {
            type: DataTypes.DATE,
            allowNull: true,
            comment: '最后使用时间'
        },
        expiresAt: {
            type: DataTypes.DATE,
            allowNull: true,
            comment: '过期时间'
        },
        createdBy: {
            type: DataTypes.STRING,
            allowNull: false,
            defaultValue: 'system',
            comment: '创建者'
        }
    }, {
        indexes: [
            {
                fields: ['status']
            },
            {
                fields: ['lastUsedAt']
            }
        ]
    });

    return ProxyApiKey;
};
