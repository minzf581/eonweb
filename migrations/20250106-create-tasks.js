'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // 1. 创建任务类型枚举
    await queryInterface.sequelize.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_tasks_type') THEN
          CREATE TYPE "enum_tasks_type" AS ENUM ('daily', 'bandwidth', 'proxy');
        END IF;
      END
      $$;
    `);

    // 2. 创建任务状态枚举
    await queryInterface.sequelize.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_tasks_status') THEN
          CREATE TYPE "enum_tasks_status" AS ENUM ('active', 'inactive');
        END IF;
      END
      $$;
    `);

    // 3. 创建任务表
    await queryInterface.createTable('tasks', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      name: {
        type: Sequelize.STRING,
        allowNull: false
      },
      description: {
        type: Sequelize.TEXT
      },
      type: {
        type: Sequelize.ENUM('daily', 'bandwidth', 'proxy'),
        allowNull: false
      },
      points: {
        type: Sequelize.INTEGER,
        defaultValue: 0
      },
      status: {
        type: Sequelize.ENUM('active', 'inactive'),
        defaultValue: 'active'
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

    // 4. 添加默认任务
    return queryInterface.bulkInsert('tasks', [
      {
        name: '每日签到',
        description: '完成每日签到可获得积分奖励',
        type: 'daily',
        points: 10,
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        name: '代理节点共享',
        description: '共享代理节点可获得积分奖励',
        type: 'proxy',
        points: 50,
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ]);
  },

  async down(queryInterface, Sequelize) {
    // 删除任务表
    await queryInterface.dropTable('tasks');
    
    // 删除枚举类型
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_tasks_type";');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_tasks_status";');
  }
};
