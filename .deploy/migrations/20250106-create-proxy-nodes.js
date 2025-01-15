'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // 1. 先删除已存在的表（如果存在）
    await queryInterface.dropTable('proxy_nodes', { cascade: true });
    
    // 2. 删除并重新创建枚举类型
    await queryInterface.sequelize.query(`DROP TYPE IF EXISTS "enum_proxy_nodes_status" CASCADE;`);
    await queryInterface.sequelize.query(`CREATE TYPE "enum_proxy_nodes_status" AS ENUM ('online', 'offline');`);

    // 3. 创建代理节点表
    await queryInterface.createTable('proxy_nodes', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      node_id: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true
      },
      user_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      ip: {
        type: Sequelize.STRING,
        allowNull: false
      },
      port: {
        type: Sequelize.INTEGER,
        allowNull: false
      },
      status: {
        type: "enum_proxy_nodes_status",
        defaultValue: 'offline'
      },
      bandwidth: {
        type: Sequelize.BIGINT,
        defaultValue: 0
      },
      last_online: {
        type: Sequelize.DATE
      },
      last_offline: {
        type: Sequelize.DATE
      },
      last_report: {
        type: Sequelize.DATE
      },
      created_at: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updated_at: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    // Create indexes
    await queryInterface.addIndex('proxy_nodes', ['node_id']);
    await queryInterface.addIndex('proxy_nodes', ['status']);
    await queryInterface.addIndex('proxy_nodes', ['last_online']);
    await queryInterface.addIndex('proxy_nodes', ['last_offline']);
    await queryInterface.addIndex('proxy_nodes', ['last_report']);

    // Create node statuses table
    await queryInterface.createTable('node_statuses', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      node_id: {
        type: Sequelize.STRING,
        allowNull: false,
        references: {
          model: 'proxy_nodes',
          key: 'node_id'
        }
      },
      status: {
        type: Sequelize.ENUM('online', 'offline', 'active'),
        allowNull: false
      },
      bandwidth: {
        type: Sequelize.BIGINT,
        defaultValue: 0
      },
      connections: {
        type: Sequelize.INTEGER,
        defaultValue: 0
      },
      uptime: {
        type: Sequelize.INTEGER,
        defaultValue: 0
      },
      timestamp: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      created_at: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updated_at: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    // Create indexes
    await queryInterface.addIndex('node_statuses', ['node_id']);
    await queryInterface.addIndex('node_statuses', ['status']);
    await queryInterface.addIndex('node_statuses', ['timestamp']);
  },

  async down(queryInterface, Sequelize) {
    // 删除代理节点表
    await queryInterface.dropTable('node_statuses');
    await queryInterface.dropTable('proxy_nodes');
    
    // 删除枚举类型
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_proxy_nodes_status" CASCADE;');
  }
};
