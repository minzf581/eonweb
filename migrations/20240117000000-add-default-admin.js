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

      // 查找现有的管理员账户
      const [existingAdmins] = await queryInterface.sequelize.query(
        `SELECT * FROM users WHERE email IN ('admin@eon-protocol.com', 'lewis@eon-protocol.com', 'info@eon-protocol.com') AND deleted_at IS NULL`
      );

      // 如果找到现有管理员，更新它们
      if (existingAdmins && existingAdmins.length > 0) {
        console.log('[Migration] Updating existing admin accounts');
        for (const admin of existingAdmins) {
          await queryInterface.sequelize.query(
            `UPDATE users SET deleted_at = NOW() WHERE id = :id`,
            {
              replacements: { id: admin.id }
            }
          );
        }
      }

      // 检查 info@eon-protocol.com 是否已存在
      const [existingUser] = await queryInterface.sequelize.query(
        `SELECT * FROM users WHERE email = 'info@eon-protocol.com' AND deleted_at IS NULL`
      );

      if (!existingUser || existingUser.length === 0) {
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
      } else {
        // 更新现有账户
        console.log('[Migration] Updating existing admin account');
        await queryInterface.sequelize.query(
          `UPDATE users SET 
            password = :password,
            is_admin = true,
            updated_at = NOW()
          WHERE email = 'info@eon-protocol.com'`,
          {
            replacements: { password: hashedPassword }
          }
        );
      }

      // 验证新创建的账户
      const [user] = await queryInterface.sequelize.query(
        `SELECT * FROM users WHERE email = 'info@eon-protocol.com' AND deleted_at IS NULL`
      );

      console.log('[Migration] Admin account setup completed successfully:', {
        email: 'info@eon-protocol.com',
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
    // 使用软删除而不是硬删除
    return queryInterface.sequelize.query(
      `UPDATE users SET deleted_at = NOW() WHERE email = 'info@eon-protocol.com'`
    );
  }
}; 