'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('BandwidthTasks', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      userId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'Users',
          key: 'id'
        }
      },
      uploadSpeed: {
        type: Sequelize.INTEGER,
        allowNull: false,
        comment: '上传速度限制 (KB/s)'
      },
      downloadSpeed: {
        type: Sequelize.INTEGER,
        allowNull: false,
        comment: '下载速度限制 (KB/s)'
      },
      duration: {
        type: Sequelize.INTEGER,
        allowNull: false,
        comment: '计划持续时间 (秒)'
      },
      actualDuration: {
        type: Sequelize.INTEGER,
        allowNull: true,
        comment: '实际持续时间 (秒)'
      },
      status: {
        type: Sequelize.ENUM('pending', 'running', 'completed', 'failed'),
        allowNull: false,
        defaultValue: 'pending'
      },
      startedAt: {
        type: Sequelize.DATE,
        allowNull: true
      },
      completedAt: {
        type: Sequelize.DATE,
        allowNull: true
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    await queryInterface.addIndex('BandwidthTasks', ['userId']);
    await queryInterface.addIndex('BandwidthTasks', ['status']);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('BandwidthTasks');
  }
};
