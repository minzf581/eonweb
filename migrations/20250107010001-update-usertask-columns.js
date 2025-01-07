'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
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

  down: async (queryInterface, Sequelize) => {
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
