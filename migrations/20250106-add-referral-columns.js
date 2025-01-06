'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Add referralcode column to users table
    await queryInterface.addColumn('users', 'referralcode', {
      type: Sequelize.STRING,
      unique: true,
      allowNull: true
    });

    // Add referredby column to users table
    await queryInterface.addColumn('users', 'referredby', {
      type: Sequelize.STRING,
      allowNull: true
    });

    // Create referrals table
    await queryInterface.createTable('referrals', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      referrerid: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id'
        }
      },
      referredid: {
        type: Sequelize.INTEGER,
        allowNull: false,
        unique: true,
        references: {
          model: 'users',
          key: 'id'
        }
      },
      pointsearned: {
        type: Sequelize.INTEGER,
        defaultValue: 0
      },
      status: {
        type: Sequelize.ENUM('pending', 'completed'),
        defaultValue: 'pending'
      },
      createdat: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updatedat: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    // Add indexes
    await queryInterface.addIndex('referrals', ['referrerid']);
    await queryInterface.addIndex('referrals', ['referredid'], {
      unique: true
    });
  },

  async down(queryInterface, Sequelize) {
    // Drop referrals table
    await queryInterface.dropTable('referrals');

    // Remove columns from users table
    await queryInterface.removeColumn('users', 'referralcode');
    await queryInterface.removeColumn('users', 'referredby');
  }
};
