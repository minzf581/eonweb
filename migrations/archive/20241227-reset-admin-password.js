const bcrypt = require('bcryptjs');

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const hashedPassword = await bcrypt.hash('vijTo9-kehmet-cessis', 10);
    
    await queryInterface.bulkUpdate(
      'Users',
      {
        password: hashedPassword,
        updatedAt: new Date()
      },
      {
        email: 'info@eon-protocol.com'
      }
    );
  },

  down: async (queryInterface, Sequelize) => {
    // 这里不需要实现回滚操作
  }
};
