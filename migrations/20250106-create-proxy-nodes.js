'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Create proxy nodes table
    await queryInterface.createTable('proxy_nodes', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      nodeid: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true
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
        type: Sequelize.ENUM('online', 'offline'),
        defaultValue: 'offline'
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
      lastonline: {
        type: Sequelize.DATE
      },
      lastoffline: {
        type: Sequelize.DATE
      },
      lastreport: {
        type: Sequelize.DATE
      },
      createdat: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updatedat: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    // Create indexes
    await queryInterface.addIndex('proxy_nodes', ['nodeid']);
    await queryInterface.addIndex('proxy_nodes', ['status']);
    await queryInterface.addIndex('proxy_nodes', ['lastonline']);
    await queryInterface.addIndex('proxy_nodes', ['lastoffline']);
    await queryInterface.addIndex('proxy_nodes', ['lastreport']);

    // Create node statuses table
    await queryInterface.createTable('node_statuses', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      nodeid: {
        type: Sequelize.STRING,
        allowNull: false,
        references: {
          model: 'proxy_nodes',
          key: 'nodeid'
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
      createdat: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updatedat: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    // Create indexes
    await queryInterface.addIndex('node_statuses', ['nodeid']);
    await queryInterface.addIndex('node_statuses', ['status']);
    await queryInterface.addIndex('node_statuses', ['timestamp']);
  },

  async down(queryInterface, Sequelize) {
    // Drop tables in reverse order
    await queryInterface.dropTable('node_statuses');
    await queryInterface.dropTable('proxy_nodes');
  }
};
