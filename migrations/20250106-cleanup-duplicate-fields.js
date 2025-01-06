'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Drop duplicate columns
    await queryInterface.removeColumn('users', 'password_hash');
    await queryInterface.removeColumn('users', 'isAdmin');
    await queryInterface.removeColumn('users', 'referralCode');
    
    // Rename balance to credits if it exists
    const tableInfo = await queryInterface.describeTable('users');
    if (tableInfo.balance) {
      await queryInterface.renameColumn('users', 'balance', 'credits');
    }

    // Add referred_by if it doesn't exist
    if (!tableInfo.referred_by) {
      await queryInterface.addColumn('users', 'referred_by', {
        type: Sequelize.STRING,
        allowNull: true
      });
    }

    // Add last_login_at if it doesn't exist
    if (!tableInfo.last_login_at) {
      await queryInterface.addColumn('users', 'last_login_at', {
        type: Sequelize.DATE,
        allowNull: true
      });
    }
  },

  async down(queryInterface, Sequelize) {
    // We don't want to restore duplicate columns in down migration
    // as it could cause data inconsistency
    return Promise.resolve();
  }
};
