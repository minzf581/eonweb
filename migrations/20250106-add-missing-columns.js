'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Add referral related columns
    await queryInterface.addColumn('users', 'referral_code', {
      type: Sequelize.STRING,
      unique: true,
      allowNull: false
    });

    await queryInterface.addColumn('users', 'referred_by', {
      type: Sequelize.STRING,
      allowNull: true
    });

    await queryInterface.addColumn('users', 'referral_count', {
      type: Sequelize.INTEGER,
      defaultValue: 0,
      allowNull: false
    });

    // Add missing columns from original file
    await queryInterface.addColumn('users', 'points', {
      type: Sequelize.INTEGER,
      defaultValue: 0,
      allowNull: false
    });

    await queryInterface.addColumn('users', 'credits', {
      type: Sequelize.INTEGER,
      defaultValue: 0,
      allowNull: false
    });

    await queryInterface.addColumn('users', 'is_admin', {
      type: Sequelize.BOOLEAN,
      defaultValue: false,
      allowNull: false
    });

    await queryInterface.addColumn('users', 'created_at', {
      type: Sequelize.DATE,
      allowNull: false,
      defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
    });

    await queryInterface.addColumn('users', 'updated_at', {
      type: Sequelize.DATE,
      allowNull: false,
      defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
    });
  },

  async down(queryInterface, Sequelize) {
    // Remove all added columns
    await queryInterface.removeColumn('users', 'referral_code');
    await queryInterface.removeColumn('users', 'referred_by');
    await queryInterface.removeColumn('users', 'referral_count');
    await queryInterface.removeColumn('users', 'points');
    await queryInterface.removeColumn('users', 'credits');
    await queryInterface.removeColumn('users', 'is_admin');
    await queryInterface.removeColumn('users', 'created_at');
    await queryInterface.removeColumn('users', 'updated_at');
  }
};
