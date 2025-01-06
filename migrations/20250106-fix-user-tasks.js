'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // 1. 创建用户任务状态枚举
    await queryInterface.sequelize.query(`DROP TYPE IF EXISTS "enum_UserTasks_status" CASCADE;`);
    await queryInterface.sequelize.query(`CREATE TYPE "enum_UserTasks_status" AS ENUM ('pending', 'in_progress', 'completed', 'failed');`);

    // 2. 创建用户任务表
    await queryInterface.createTable('UserTasks', {
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
      taskId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'Tasks',
          key: 'id'
        }
      },
      status: {
        type: "enum_UserTasks_status",
        defaultValue: 'pending'
      },
      startTime: {
        type: Sequelize.DATE
      },
      endTime: {
        type: Sequelize.DATE
      },
      points: {
        type: Sequelize.INTEGER,
        defaultValue: 0
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

    // 3. 创建索引
    await queryInterface.addIndex('UserTasks', ['userId']);
    await queryInterface.addIndex('UserTasks', ['taskId']);
    await queryInterface.addIndex('UserTasks', ['status']);
  },

  async down(queryInterface, Sequelize) {
    // 删除用户任务表
    await queryInterface.dropTable('UserTasks');
    
    // 删除枚举类型
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_UserTasks_status" CASCADE;');
  }
};
