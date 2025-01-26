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
      await queryInterface.sequelize.query(
        `DELETE FROM users WHERE email IN ('admin@eon-protocol.com', 'lewis@eon-protocol.com', 'info@eon-protocol.com')`
      );

      // 创建新的管理员账户
      console.log('[Migration] Creating new admin account');
      const now = new Date();
      await queryInterface.sequelize.query(
        `INSERT INTO users (
          email, 
          username, 
          password, 
          is_admin, 
          points, 
          credits, 
          referral_code, 
          created_at, 
          updated_at
        ) VALUES (
          'info@eon-protocol.com',
          'admin',
          :password,
          TRUE,
          0,
          0,
          :referralCode,
          :now,
          :now
        )`,
        {
          replacements: {
            password: hashedPassword,
            referralCode,
            now
          }
        }
      );

      // 验证新创建的账户
      const [users] = await queryInterface.sequelize.query(
        `SELECT id, email, is_admin, referral_code FROM users WHERE email = 'info@eon-protocol.com'`
      );

      if (users.length === 0) {
        throw new Error('Admin user was not created successfully');
      }

      console.log('[Migration] Admin account created successfully:', {
        id: users[0].id,
        email: users[0].email,
        isAdmin: users[0].is_admin,
        referralCode: users[0].referral_code
      });

      return Promise.resolve();
    } catch (error) {
      console.error('[Migration] Error setting up admin account:', error);
      throw error;
    }
  },

  async down(queryInterface, Sequelize) {
    console.log('[Migration] Rolling back admin account creation');
    return queryInterface.sequelize.query(
      `DELETE FROM users WHERE email = 'info@eon-protocol.com'`
    );
  }
}; 