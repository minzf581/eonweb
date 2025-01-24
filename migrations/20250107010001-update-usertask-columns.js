'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // Add new columns from fix-user-tasks.js
    await queryInterface.addColumn('user_tasks', 'status', {
      type: Sequelize.ENUM('pending', 'in_progress', 'completed', 'failed'),
      defaultValue: 'pending',
      allowNull: false
    });

    await queryInterface.addColumn('user_tasks', 'start_time', {
      type: Sequelize.DATE,
      allowNull: true
    });

    await queryInterface.addColumn('user_tasks', 'completion_time', {
      type: Sequelize.DATE,
      allowNull: true
    });

    // Original columns from update-usertask-columns.js
    await queryInterface.addColumn('user_tasks', 'points_awarded', {
      type: Sequelize.INTEGER,
      defaultValue: 0,
      allowNull: false
    });

    await queryInterface.addColumn('user_tasks', 'credits_awarded', {
      type: Sequelize.INTEGER,
      defaultValue: 0,
      allowNull: false
    });

    await queryInterface.sequelize.transaction(async (transaction) => {
      // Rename user_id to userid if it exists
      await queryInterface.renameColumn('user_tasks', 'user_id', 'userid', { transaction }).catch(() => {});

      // Add deleted_at column if it doesn't exist
      await queryInterface.addColumn('user_tasks', 'deleted_at', {
        type: Sequelize.DATE,
        allowNull: true
      }, { transaction }).catch(() => {});

      // Add created_at column if it doesn't exist
      await queryInterface.addColumn('user_tasks', 'created_at', {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }, { transaction }).catch(() => {});

      // Add updated_at column if it doesn't exist
      await queryInterface.addColumn('user_tasks', 'updated_at', {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }, { transaction }).catch(() => {});
    });
  },

  async down(queryInterface, Sequelize) {
    // Remove all added columns
    await queryInterface.removeColumn('user_tasks', 'status');
    await queryInterface.removeColumn('user_tasks', 'start_time');
    await queryInterface.removeColumn('user_tasks', 'completion_time');
    await queryInterface.removeColumn('user_tasks', 'points_awarded');
    await queryInterface.removeColumn('user_tasks', 'credits_awarded');

    await queryInterface.sequelize.transaction(async (transaction) => {
      // Rename userid back to user_id
      await queryInterface.renameColumn('user_tasks', 'userid', 'user_id', { transaction }).catch(() => {});

      // Remove timestamp columns
      await queryInterface.removeColumn('user_tasks', 'deleted_at', { transaction }).catch(() => {});
      await queryInterface.removeColumn('user_tasks', 'created_at', { transaction }).catch(() => {});
      await queryInterface.removeColumn('user_tasks', 'updated_at', { transaction }).catch(() => {});
    });
  }
};
