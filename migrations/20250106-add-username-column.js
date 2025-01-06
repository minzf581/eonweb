'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const tableInfo = await queryInterface.describeTable('users');
    
    if (!tableInfo.username) {
      await queryInterface.addColumn('users', 'username', {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true,
        defaultValue: 'user_' + Date.now() // Temporary default value for existing rows
      });

      // Update existing users to have a username based on their email
      await queryInterface.sequelize.query(
        'UPDATE users SET username = SPLIT_PART(email, \'@\', 1) WHERE username = $1',
        {
          bind: ['user_' + Date.now()]
        }
      );
    }

    // Add other missing columns if they don't exist
    if (!tableInfo.role) {
      await queryInterface.addColumn('users', 'role', {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: 'user'
      });
    }

    if (!tableInfo.status) {
      await queryInterface.addColumn('users', 'status', {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: 'active'
      });
    }

    if (!tableInfo.balance) {
      await queryInterface.addColumn('users', 'balance', {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0.00
      });
    }
  },

  async down(queryInterface, Sequelize) {
    const tableInfo = await queryInterface.describeTable('users');
    
    const columns = ['username', 'role', 'status', 'balance'];
    const changes = columns
      .filter(column => tableInfo[column])
      .map(column => queryInterface.removeColumn('users', column));
    
    await Promise.all(changes);
  }
};
