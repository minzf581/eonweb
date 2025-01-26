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

      // 查找现有的用户(包括已删除的)
      const [existingUser] = await queryInterface.sequelize.query(
        `SELECT * FROM users WHERE email = 'info@eon-protocol.com' OR username = 'admin'`
      );

      if (existingUser && existingUser.length > 0) {
        // 更新现有用户
        console.log('[Migration] Updating existing user');
        await queryInterface.sequelize.query(
          `UPDATE users 
           SET email = 'info@eon-protocol.com',
               username = 'admin',
               password = :password,
               is_admin = true,
               deleted_at = NULL,
               updated_at = NOW()
           WHERE id = :id`,
          {
            replacements: { 
              password: hashedPassword,
              id: existingUser[0].id
            }
          }
        );
      } else {
        // 创建新用户
        console.log('[Migration] Creating new admin user');
        await queryInterface.sequelize.query(
          `INSERT INTO users (
            email, username, password, is_admin, points, credits, 
            referral_code, created_at, updated_at
          ) VALUES (
            'info@eon-protocol.com', 'admin', :password, true, 0, 0,
            :referralCode, NOW(), NOW()
          )`,
          {
            replacements: { 
              password: hashedPassword,
              referralCode: referralCode
            }
          }
        );
      }

      // 验证用户
      const [user] = await queryInterface.sequelize.query(
        `SELECT * FROM users WHERE email = 'info@eon-protocol.com' AND deleted_at IS NULL`
      );

      console.log('[Migration] Admin account setup completed successfully:', {
        email: 'info@eon-protocol.com',
        isAdmin: true,
        exists: user && user.length > 0
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
      `UPDATE users SET deleted_at = NOW() WHERE email = 'info@eon-protocol.com'`
    );
  }
}; 