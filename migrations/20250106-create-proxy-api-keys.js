'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
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

    await queryInterface.addIndex('ProxyApiKeys', ['status']);
    await queryInterface.addIndex('ProxyApiKeys', ['lastUsedAt']);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('ProxyApiKeys');
  }
};
