'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // 1. 创建用户任务状态枚举
    await queryInterface.sequelize.query(`DROP TYPE IF EXISTS "enum_user_tasks_status" CASCADE;`);
    await queryInterface.sequelize.query(`CREATE TYPE "enum_user_tasks_status" AS ENUM ('pending', 'in_progress', 'completed', 'failed');`);

    // 2. 创建用户任务表
    await queryInterface.createTable('user_tasks', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      userid: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id'
        }
      },
      taskid: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'tasks',
          key: 'id'
        }
      },
      status: {
        type: "enum_user_tasks_status",
        defaultValue: 'pending'
      },
      starttime: {
        type: Sequelize.DATE
      },
      endtime: {
        type: Sequelize.DATE
      },
      points: {
        type: Sequelize.INTEGER,
        defaultValue: 0
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

    // 3. 创建索引
    await queryInterface.addIndex('user_tasks', ['userid']);
    await queryInterface.addIndex('user_tasks', ['taskid']);
    await queryInterface.addIndex('user_tasks', ['status']);
  },

  async down(queryInterface, Sequelize) {
    // 删除用户任务表
    await queryInterface.dropTable('user_tasks');
    
    // 删除枚举类型
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_user_tasks_status" CASCADE;');
  }
};
