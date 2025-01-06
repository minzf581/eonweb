'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const tables = await queryInterface.showAllTables();
    const usersExists = tables.includes('users');
    const referralsExists = tables.includes('referrals');

    if (usersExists) {
      const userColumns = await queryInterface.describeTable('users');
      
      // Rename columns in users table if they exist
      if (userColumns.referralcode) {
        await queryInterface.renameColumn('users', 'referralcode', 'referral_code');
      }
      if (userColumns.isadmin) {
        await queryInterface.renameColumn('users', 'isadmin', 'is_admin');
      }
      if (userColumns.createdat) {
        await queryInterface.renameColumn('users', 'createdat', 'created_at');
      }
      if (userColumns.updatedat) {
        await queryInterface.renameColumn('users', 'updatedat', 'updated_at');
      }
    }

    if (referralsExists) {
      const referralColumns = await queryInterface.describeTable('referrals');
      
      // Rename columns in referrals table if they exist
      if (referralColumns.referrerid) {
        await queryInterface.renameColumn('referrals', 'referrerid', 'referrer_id');
      }
      if (referralColumns.referredid) {
        await queryInterface.renameColumn('referrals', 'referredid', 'referred_id');
      }
      if (referralColumns.pointsearned) {
        await queryInterface.renameColumn('referrals', 'pointsearned', 'points_earned');
      }
      if (referralColumns.createdat) {
        await queryInterface.renameColumn('referrals', 'createdat', 'created_at');
      }
      if (referralColumns.updatedat) {
        await queryInterface.renameColumn('referrals', 'updatedat', 'updated_at');
      }
    }
  },

  async down(queryInterface, Sequelize) {
    const tables = await queryInterface.showAllTables();
    const usersExists = tables.includes('users');
    const referralsExists = tables.includes('referrals');

    if (usersExists) {
      const userColumns = await queryInterface.describeTable('users');
      
      // Revert column names in users table if they exist
      if (userColumns.referral_code) {
        await queryInterface.renameColumn('users', 'referral_code', 'referralcode');
      }
      if (userColumns.is_admin) {
        await queryInterface.renameColumn('users', 'is_admin', 'isadmin');
      }
      if (userColumns.created_at) {
        await queryInterface.renameColumn('users', 'created_at', 'createdat');
      }
      if (userColumns.updated_at) {
        await queryInterface.renameColumn('users', 'updated_at', 'updatedat');
      }
    }

    if (referralsExists) {
      const referralColumns = await queryInterface.describeTable('referrals');
      
      // Revert column names in referrals table if they exist
      if (referralColumns.referrer_id) {
        await queryInterface.renameColumn('referrals', 'referrer_id', 'referrerid');
      }
      if (referralColumns.referred_id) {
        await queryInterface.renameColumn('referrals', 'referred_id', 'referredid');
      }
      if (referralColumns.points_earned) {
        await queryInterface.renameColumn('referrals', 'points_earned', 'pointsearned');
      }
      if (referralColumns.created_at) {
        await queryInterface.renameColumn('referrals', 'created_at', 'createdat');
      }
      if (referralColumns.updated_at) {
        await queryInterface.renameColumn('referrals', 'updated_at', 'updatedat');
      }
    }
  }
};
