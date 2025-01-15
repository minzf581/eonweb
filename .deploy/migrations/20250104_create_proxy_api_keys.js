const { DataTypes } = require('sequelize');

module.exports = {
    up: async (queryInterface, Sequelize) => {
        await queryInterface.createTable('ProxyApiKeys', {
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
            },
            createdAt: {
                type: DataTypes.DATE,
                allowNull: false
            },
            updatedAt: {
                type: DataTypes.DATE,
                allowNull: false
            }
        });

        await queryInterface.addIndex('ProxyApiKeys', ['status']);
        await queryInterface.addIndex('ProxyApiKeys', ['lastUsedAt']);

        // 插入默认API密钥
        await queryInterface.bulkInsert('ProxyApiKeys', [{
            key: 'proxy_api_key_d1e8a37b5c4f9',
            name: 'Default Proxy API Key',
            status: 'active',
            createdBy: 'system',
            createdAt: new Date(),
            updatedAt: new Date()
        }]);
    },

    down: async (queryInterface, Sequelize) => {
        await queryInterface.dropTable('ProxyApiKeys');
    }
};
