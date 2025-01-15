'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // 检查表是否已存在
    const tables = await queryInterface.showAllTables();
    if (!tables.includes('ProxyApiKeys')) {
      await queryInterface.createTable('ProxyApiKeys', {
        key: {
          type: Sequelize.STRING,
          primaryKey: true,
          allowNull: false,
          comment: 'API密钥'
        },
        name: {
          type: Sequelize.STRING,
          allowNull: false,
          comment: '密钥名称'
        },
        status: {
          type: Sequelize.ENUM('active', 'inactive'),
          allowNull: false,
          defaultValue: 'active',
          comment: '密钥状态'
        },
        lastUsedAt: {
          type: Sequelize.DATE,
          allowNull: true,
          comment: '最后使用时间'
        },
        expiresAt: {
          type: Sequelize.DATE,
          allowNull: true,
          comment: '过期时间'
        },
        createdBy: {
          type: Sequelize.STRING,
          allowNull: false,
          defaultValue: 'system',
          comment: '创建者'
        },
        createdAt: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
        },
        updatedAt: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
        }
      });

      // 检查索引是否存在
      try {
        const indexes = await queryInterface.showIndex('ProxyApiKeys');
        const statusIndexExists = indexes.some(index => index.name === 'proxy_api_keys_status');
        const lastUsedAtIndexExists = indexes.some(index => index.name === 'proxy_api_keys_last_used_at');

        if (!statusIndexExists) {
          await queryInterface.addIndex('ProxyApiKeys', ['status'], {
            name: 'proxy_api_keys_status'
          });
        }

        if (!lastUsedAtIndexExists) {
          await queryInterface.addIndex('ProxyApiKeys', ['lastUsedAt'], {
            name: 'proxy_api_keys_last_used_at'
          });
        }
      } catch (error) {
        // 如果表不存在，showIndex会抛出错误，这种情况下我们直接创建索引
        await queryInterface.addIndex('ProxyApiKeys', ['status'], {
          name: 'proxy_api_keys_status'
        });
        await queryInterface.addIndex('ProxyApiKeys', ['lastUsedAt'], {
          name: 'proxy_api_keys_last_used_at'
        });
      }

      // 添加默认API密钥
      await queryInterface.bulkInsert('ProxyApiKeys', [{
        key: 'proxy_api_key_d1e8a37b5c4f9',
        name: 'Default Proxy API Key',
        status: 'active',
        createdBy: 'system',
        createdAt: new Date(),
        updatedAt: new Date()
      }]);
    }
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('ProxyApiKeys');
  }
};
