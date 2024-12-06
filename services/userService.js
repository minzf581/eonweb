const pool = require('../config/database');
const bcrypt = require('bcrypt');
const crypto = require('crypto');

class UserService {
    static async createUser(username, email, password, referralCode = null) {
        const connection = await pool.getConnection();
        try {
            await connection.beginTransaction();

            // 从邮箱中提取用户名（如果没有提供）
            if (!username) {
                username = email.split('@')[0];
            }

            // 生成密码哈希
            const passwordHash = await bcrypt.hash(password, 10);
            
            // 生成唯一推荐码
            const newReferralCode = crypto.randomBytes(5).toString('hex');

            // 确保所有值都不是 undefined
            const params = {
                username: username || null,
                email: email || null,
                password_hash: passwordHash || null,
                referral_code: newReferralCode || null,
                referred_by: referralCode || null
            };

            // 创建用户
            const [result] = await connection.execute(
                'INSERT INTO users (username, email, password_hash, referral_code, referred_by) VALUES (?, ?, ?, ?, ?)',
                [params.username, params.email, params.password_hash, params.referral_code, params.referred_by]
            );

            await connection.commit();
            return result.insertId;
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    }

    static async verifyUser(email, password) {
        try {
            // 查找用户
            const [users] = await pool.execute(
                'SELECT * FROM users WHERE email = ?',
                [email]
            );

            if (users.length === 0) {
                return null;
            }

            const user = users[0];
            
            // 验证密码
            const validPassword = await bcrypt.compare(password, user.password_hash);
            
            if (!validPassword) {
                return null;
            }

            return user;
        } catch (error) {
            console.error('Verify user error:', error);
            throw error;
        }
    }

    static async getUserPoints(userId) {
        const [rows] = await pool.execute(
            'SELECT points FROM users WHERE id = ?',
            [userId]
        );
        return rows[0]?.points || 0;
    }
}

module.exports = UserService; 