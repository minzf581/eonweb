'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Add referral_code column to users table
    await queryInterface.addColumn('users', 'referral_code', {
      type: Sequelize.STRING,
      unique: true,
      allowNull: true
    });

    // Add referred_by column to users table
    await queryInterface.addColumn('users', 'referred_by', {
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
      referrer_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id'
        }
      },
      referred_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        unique: true,
        references: {
          model: 'users',
          key: 'id'
        }
      },
      points_earned: {
        type: Sequelize.INTEGER,
        defaultValue: 0
      },
      status: {
        type: Sequelize.ENUM('pending', 'completed'),
        defaultValue: 'pending'
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    // Add indexes
    await queryInterface.addIndex('referrals', ['referrer_id']);
    await queryInterface.addIndex('referrals', ['referred_id'], {
      unique: true
    });
  },

  async down(queryInterface, Sequelize) {
    // Drop referrals table
    await queryInterface.dropTable('referrals');

    // Remove columns from users table
    await queryInterface.removeColumn('users', 'referral_code');
    await queryInterface.removeColumn('users', 'referred_by');
  }
};
