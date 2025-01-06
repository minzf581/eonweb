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
      const [users] = await queryInterface.sequelize.query(
        'SELECT id, email FROM users WHERE username = $1',
        {
          bind: ['user_' + Date.now()]
        }
      );

      for (const user of users) {
        await queryInterface.sequelize.query(
          'UPDATE users SET username = $1 WHERE id = $2',
          {
            bind: [user.email.split('@')[0], user.id]
          }
        );
      }
    }
  },

  async down(queryInterface, Sequelize) {
    const tableInfo = await queryInterface.describeTable('users');
    
    if (tableInfo.username) {
      await queryInterface.removeColumn('users', 'username');
    }
  }
};
