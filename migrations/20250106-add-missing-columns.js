'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const tableInfo = await queryInterface.describeTable('users');
    
    // Add columns if they don't exist
    const changes = [];
    
    if (!tableInfo.referral_code) {
      changes.push(
        queryInterface.addColumn('users', 'referral_code', {
          type: Sequelize.STRING,
          unique: true,
          allowNull: true
        })
      );
    }

    if (!tableInfo.points) {
      changes.push(
        queryInterface.addColumn('users', 'points', {
          type: Sequelize.INTEGER,
          defaultValue: 0
        })
      );
    }

    if (!tableInfo.is_admin) {
      changes.push(
        queryInterface.addColumn('users', 'is_admin', {
          type: Sequelize.BOOLEAN,
          defaultValue: false
        })
      );
    }

    if (!tableInfo.created_at) {
      changes.push(
        queryInterface.addColumn('users', 'created_at', {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
        })
      );
    }

    if (!tableInfo.updated_at) {
      changes.push(
        queryInterface.addColumn('users', 'updated_at', {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
        })
      );
    }

    await Promise.all(changes);
  },

  async down(queryInterface, Sequelize) {
    const tableInfo = await queryInterface.describeTable('users');
    const columns = ['referral_code', 'points', 'is_admin', 'created_at', 'updated_at'];
    
    const changes = columns
      .filter(column => tableInfo[column])
      .map(column => queryInterface.removeColumn('users', column));
    
    await Promise.all(changes);
  }
};
