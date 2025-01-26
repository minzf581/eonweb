'use strict';

const bcrypt = require('bcryptjs');
const crypto = require('crypto');

module.exports = {
  async up(queryInterface, Sequelize) {
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash('vijTo9-kehmet-cessis', salt);
    const referralCode = crypto.randomBytes(4).toString('hex');

    // 删除旧的管理员账户
    await queryInterface.bulkDelete('users', {
      email: {
        [Sequelize.Op.in]: ['admin@eon-protocol.com', 'lewis@eon-protocol.com', 'info@eon-protocol.com']
      }
    });

    // 创建新的管理员账户
    return queryInterface.bulkInsert('users', [{
      email: 'info@eon-protocol.com',
      username: 'admin',
      password: hashedPassword,
      is_admin: true,
      points: 0,
      credits: 0,
      referral_code: referralCode,
      created_at: new Date(),
      updated_at: new Date()
    }]);
  },

  async down(queryInterface, Sequelize) {
    return queryInterface.bulkDelete('users', {
      email: 'info@eon-protocol.com'
    });
  }
}; 