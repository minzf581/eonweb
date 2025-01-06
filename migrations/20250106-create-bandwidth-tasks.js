'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // 先创建 enum 类型
    await queryInterface.sequelize.query(`
      DO $$ 
      BEGIN 
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_bandwidthtasks_status') THEN
          CREATE TYPE "enum_bandwidthtasks_status" AS ENUM ('pending', 'running', 'completed', 'failed');
        END IF;
      END
      $$;
    `);

    await queryInterface.createTable('bandwidth_tasks', {
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
        allowNull: false
      },
      download_speed: {
        type: Sequelize.INTEGER,
        allowNull: false
      },
      duration: {
        type: Sequelize.INTEGER,
        allowNull: false
      },
      actual_duration: {
        type: Sequelize.INTEGER,
        allowNull: true
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
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    // 添加字段注释，并添加错误处理
    try {
      await queryInterface.sequelize.query(`
        COMMENT ON COLUMN "bandwidth_tasks"."upload_speed" IS '上传速度限制 (KB/s)';
        COMMENT ON COLUMN "bandwidth_tasks"."download_speed" IS '下载速度限制 (KB/s)';
        COMMENT ON COLUMN "bandwidth_tasks"."duration" IS '计划持续时间 (秒)';
        COMMENT ON COLUMN "bandwidth_tasks"."actual_duration" IS '实际持续时间 (秒)';
      `);
    } catch (error) {
      console.error('Error adding column comments:', error);
      // Continue even if comments fail - they're not critical
    }

    await queryInterface.addIndex('bandwidth_tasks', ['user_id']);
    await queryInterface.addIndex('bandwidth_tasks', ['status']);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('bandwidth_tasks');
    await queryInterface.sequelize.query(`DROP TYPE IF EXISTS "enum_bandwidthtasks_status";`);
  }
};
