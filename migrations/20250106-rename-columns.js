'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Rename columns in users table
    await queryInterface.renameColumn('users', 'referralcode', 'referral_code');
    await queryInterface.renameColumn('users', 'isadmin', 'is_admin');
    await queryInterface.renameColumn('users', 'createdat', 'created_at');
    await queryInterface.renameColumn('users', 'updatedat', 'updated_at');

    // Rename columns in referrals table
    await queryInterface.renameColumn('referrals', 'referrerid', 'referrer_id');
    await queryInterface.renameColumn('referrals', 'referredid', 'referred_id');
    await queryInterface.renameColumn('referrals', 'pointsearned', 'points_earned');
    await queryInterface.renameColumn('referrals', 'createdat', 'created_at');
    await queryInterface.renameColumn('referrals', 'updatedat', 'updated_at');
  },

  async down(queryInterface, Sequelize) {
    // Revert column names in users table
    await queryInterface.renameColumn('users', 'referral_code', 'referralcode');
    await queryInterface.renameColumn('users', 'is_admin', 'isadmin');
    await queryInterface.renameColumn('users', 'created_at', 'createdat');
    await queryInterface.renameColumn('users', 'updated_at', 'updatedat');

    // Revert column names in referrals table
    await queryInterface.renameColumn('referrals', 'referrer_id', 'referrerid');
    await queryInterface.renameColumn('referrals', 'referred_id', 'referredid');
    await queryInterface.renameColumn('referrals', 'points_earned', 'pointsearned');
    await queryInterface.renameColumn('referrals', 'created_at', 'createdat');
    await queryInterface.renameColumn('referrals', 'updated_at', 'updatedat');
  }
};
