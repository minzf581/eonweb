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
      user_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'Users',
          key: 'id'
        }
      },
      upload_speed: {
        type: Sequelize.INTEGER,
        allowNull: false,
        comment: '上传速度限制 (KB/s)'
      },
      download_speed: {
        type: Sequelize.INTEGER,
        allowNull: false,
        comment: '下载速度限制 (KB/s)'
      },
      duration: {
        type: Sequelize.INTEGER,
        allowNull: false,
        comment: '计划持续时间 (秒)'
      },
      actual_duration: {
        type: Sequelize.INTEGER,
        allowNull: true,
        comment: '实际持续时间 (秒)'
      },
      status: {
        type: Sequelize.ENUM('pending', 'running', 'completed', 'failed'),
        allowNull: false,
        defaultValue: 'pending'
      },
      started_at: {
        type: Sequelize.DATE,
        allowNull: true
      },
      completed_at: {
        type: Sequelize.DATE,
        allowNull: true
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

    await queryInterface.addIndex('BandwidthTasks', ['user_id']);
    await queryInterface.addIndex('BandwidthTasks', ['status']);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('BandwidthTasks');
  }
};
