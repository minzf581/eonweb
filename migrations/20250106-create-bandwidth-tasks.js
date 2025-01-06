'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // First create enum type
    await queryInterface.sequelize.query(`
      DO $$ 
      BEGIN 
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_bandwidth_tasks_status') THEN
          CREATE TYPE "enum_bandwidth_tasks_status" AS ENUM ('pending', 'running', 'completed', 'failed');
        END IF;
      END
      $$;
    `);

    // Create table
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
        type: "enum_bandwidth_tasks_status",
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

    // Add index after table creation
    await queryInterface.sequelize.query(`
      DO $$ 
      BEGIN 
        IF NOT EXISTS (
          SELECT 1 FROM pg_indexes 
          WHERE schemaname = 'public' 
          AND tablename = 'bandwidth_tasks' 
          AND indexname = 'bandwidth_tasks_user_id'
        ) THEN
          CREATE INDEX "bandwidth_tasks_user_id" ON "bandwidth_tasks" ("user_id");
        END IF;
      END
      $$;
    `);

    // Add column comments after table creation
    try {
      await queryInterface.sequelize.query(`
        COMMENT ON COLUMN "bandwidth_tasks"."upload_speed" IS '上传速度限制 (KB/s)';
        COMMENT ON COLUMN "bandwidth_tasks"."download_speed" IS '下载速度限制 (KB/s)';
        COMMENT ON COLUMN "bandwidth_tasks"."duration" IS '计划持续时间 (秒)';
        COMMENT ON COLUMN "bandwidth_tasks"."actual_duration" IS '实际持续时间 (秒)';
      `);
    } catch (error) {
      console.warn('Warning: Failed to add column comments:', error.message);
    }
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('bandwidth_tasks');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_bandwidth_tasks_status"');
  }
};
