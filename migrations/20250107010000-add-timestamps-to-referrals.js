'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.sequelize.transaction(async (transaction) => {
      // Add deleted_at column to referrals table
      await queryInterface.addColumn('referrals', 'deleted_at', {
        type: Sequelize.DATE,
        allowNull: true
      }, { transaction });

      // Add created_at column if it doesn't exist
      await queryInterface.addColumn('referrals', 'created_at', {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }, { transaction }).catch(() => {});

      // Add updated_at column if it doesn't exist
      await queryInterface.addColumn('referrals', 'updated_at', {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }, { transaction }).catch(() => {});
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.removeColumn('referrals', 'deleted_at', { transaction });
      await queryInterface.removeColumn('referrals', 'created_at', { transaction }).catch(() => {});
      await queryInterface.removeColumn('referrals', 'updated_at', { transaction }).catch(() => {});
    });
  }
};
