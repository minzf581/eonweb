'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
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
          model: 'users',
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

    // Add indexes if they don't exist
    try {
      await queryInterface.sequelize.query(`
        DO $$ 
        BEGIN 
          IF NOT EXISTS (
            SELECT 1 FROM pg_indexes 
            WHERE tablename = 'bandwidth_tasks' 
            AND indexname = 'bandwidth_tasks_user_id_idx'
          ) THEN
            CREATE INDEX bandwidth_tasks_user_id_idx ON bandwidth_tasks (user_id);
          END IF;
          
          IF NOT EXISTS (
            SELECT 1 FROM pg_indexes 
            WHERE tablename = 'bandwidth_tasks' 
            AND indexname = 'bandwidth_tasks_status_idx'
          ) THEN
            CREATE INDEX bandwidth_tasks_status_idx ON bandwidth_tasks (status);
          END IF;
        END $$;
      `);
    } catch (error) {
      console.error('Error creating indexes:', error);
      // Continue even if index creation fails
    }

    // Add column comments
    try {
      await queryInterface.sequelize.query(`
        COMMENT ON COLUMN bandwidth_tasks.upload_speed IS '上传速度限制 (KB/s)';
        COMMENT ON COLUMN bandwidth_tasks.download_speed IS '下载速度限制 (KB/s)';
        COMMENT ON COLUMN bandwidth_tasks.duration IS '计划持续时间 (秒)';
        COMMENT ON COLUMN bandwidth_tasks.actual_duration IS '实际持续时间 (秒)';
      `);
    } catch (error) {
      console.error('Error adding column comments:', error);
      // Continue even if comments fail
    }
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('bandwidth_tasks');
    await queryInterface.sequelize.query(`DROP TYPE IF EXISTS "enum_bandwidth_tasks_status";`);
  }
};
