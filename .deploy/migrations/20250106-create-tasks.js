'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // 1. 先删除已存在的表（如果存在）
    await queryInterface.dropTable('tasks', { cascade: true });
    
    // 2. 删除并重新创建枚举类型
    await queryInterface.sequelize.query(`DROP TYPE IF EXISTS "enum_tasks_type" CASCADE;`);
    await queryInterface.sequelize.query(`DROP TYPE IF EXISTS "enum_tasks_status" CASCADE;`);
    
    await queryInterface.sequelize.query(`CREATE TYPE "enum_tasks_type" AS ENUM ('daily', 'bandwidth', 'proxy');`);
    await queryInterface.sequelize.query(`CREATE TYPE "enum_tasks_status" AS ENUM ('active', 'inactive');`);

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
        type: "enum_tasks_type",
        allowNull: false
      },
      points: {
        type: Sequelize.INTEGER,
        defaultValue: 0
      },
      status: {
        type: "enum_tasks_status",
        defaultValue: 'active'
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

    // 4. 添加默认任务
    return queryInterface.bulkInsert('tasks', [
      {
        name: '每日签到',
        description: '完成每日签到可获得积分奖励',
        type: 'daily',
        points: 10,
        status: 'active',
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        name: '代理节点共享',
        description: '共享代理节点可获得积分奖励',
        type: 'proxy',
        points: 50,
        status: 'active',
        created_at: new Date(),
        updated_at: new Date()
      }
    ]);
  },

  async down(queryInterface, Sequelize) {
    // 删除任务表
    await queryInterface.dropTable('tasks');
    
    // 删除枚举类型
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_tasks_type" CASCADE;');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_tasks_status" CASCADE;');
  }
};
