'use strict';

const bcrypt = require('bcryptjs');
const crypto = require('crypto');

module.exports = {
  async up(queryInterface, Sequelize) {
    console.log('[Migration] Starting admin user setup');

    try {
      // 生成密码哈希
      const salt = await bcrypt.genSalt(10);
      const password = 'vijTo9-kehmet-cessis';
      const hashedPassword = await bcrypt.hash(password, salt);
      const referralCode = crypto.randomBytes(4).toString('hex');

      console.log('[Migration] Generated password hash and referral code');

      // 删除旧的管理员账户
      console.log('[Migration] Removing old admin accounts');
      await queryInterface.bulkDelete('users', {
        email: {
          [Sequelize.Op.in]: ['admin@eon-protocol.com', 'lewis@eon-protocol.com', 'info@eon-protocol.com']
        }
      });

      // 创建新的管理员账户
      console.log('[Migration] Creating new admin account');
      await queryInterface.bulkInsert('users', [{
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

      // 验证新创建的账户
      const [user] = await queryInterface.sequelize.query(
        `SELECT * FROM users WHERE email = 'info@eon-protocol.com'`
      );

      console.log('[Migration] Admin account created successfully:', {
        email: 'info@eon-protocol.com',
        referralCode,
        isAdmin: true
      });

      return Promise.resolve();
    } catch (error) {
      console.error('[Migration] Error setting up admin account:', error);
      throw error;
    }
  },

  async down(queryInterface, Sequelize) {
    console.log('[Migration] Rolling back admin account creation');
    return queryInterface.bulkDelete('users', {
      email: 'info@eon-protocol.com'
    });
  }
}; 