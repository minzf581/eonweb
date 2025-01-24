'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // Add timestamps to referrals table
    await queryInterface.addColumn('referrals', 'created_at', {
      type: Sequelize.DATE,
      allowNull: false,
      defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
    });

    await queryInterface.addColumn('referrals', 'updated_at', {
      type: Sequelize.DATE,
      allowNull: false,
      defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
    });

    // Add timestamps to point_histories table
    await queryInterface.addColumn('point_histories', 'created_at', {
      type: Sequelize.DATE,
      allowNull: false,
      defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
    });

    await queryInterface.addColumn('point_histories', 'updated_at', {
      type: Sequelize.DATE,
      allowNull: false,
      defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
    });
  },

  async down(queryInterface, Sequelize) {
    // Remove timestamps from referrals table
    await queryInterface.removeColumn('referrals', 'created_at');
    await queryInterface.removeColumn('referrals', 'updated_at');

    // Remove timestamps from point_histories table
    await queryInterface.removeColumn('point_histories', 'created_at');
    await queryInterface.removeColumn('point_histories', 'updated_at');
  }
};
