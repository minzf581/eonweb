'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('referrals', 'deleted_at', {
      type: Sequelize.DATE,
      allowNull: true
    });
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
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('referrals', 'deleted_at');
    await queryInterface.removeColumn('referrals', 'created_at');
    await queryInterface.removeColumn('referrals', 'updated_at');
  }
};
