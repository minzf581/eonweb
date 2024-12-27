const express = require('express');
const router = express.Router();
const db = require('../db');
const authenticate = require('../middleware/auth');

// 生成推荐码
function generateReferralCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 排除容易混淆的字符
    let code = '';
    for (let i = 0; i < 8; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}

// 获取推荐数据API
router.get('/api/users/referral', authenticate, async (req, res) => {
    try {
        const userId = req.user.id;
        
        // 获取用户的推荐码
        const user = await db.query(
            'SELECT referral_code FROM users WHERE id = $1',
            [userId]
        );
        
        // 如果用户没有推荐码，生成一个
        let referralCode = user.rows[0]?.referral_code;
        if (!referralCode) {
            do {
                referralCode = generateReferralCode();
                try {
                    await db.query(
                        'UPDATE users SET referral_code = $1 WHERE id = $2',
                        [referralCode, userId]
                    );
                    break;
                } catch (err) {
                    if (err.code === '23505') { // 唯一约束冲突
                        continue; // 重新生成
                    }
                    throw err;
                }
            } while (true);
        }
        
        // 获取推荐统计
        const stats = await db.query(`
            SELECT 
                COUNT(DISTINCT referred_id) as referral_count,
                COALESCE(SUM(points_earned), 0) as total_points
            FROM referrals 
            WHERE referrer_id = $1
        `, [userId]);
        
        res.json({
            referralCode,
            referralCount: stats.rows[0].referral_count || 0,
            referralPoints: stats.rows[0].total_points || 0
        });
    } catch (error) {
        console.error('Error in /api/users/referral:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// 验证推荐码
router.post('/api/users/referral/verify', async (req, res) => {
    const { referralCode } = req.body;
    
    try {
        const referrer = await db.query(
            'SELECT id, username FROM users WHERE referral_code = $1',
            [referralCode]
        );
        
        if (referrer.rows.length === 0) {
            return res.status(404).json({ error: 'Invalid referral code' });
        }
        
        res.json({ valid: true });
    } catch (error) {
        console.error('Error verifying referral code:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// 使用推荐码（在注册时调用）
async function processReferral(userId, referralCode) {
    try {
        // 查找推荐人
        const referrer = await db.query(
            'SELECT id FROM users WHERE referral_code = $1',
            [referralCode]
        );
        
        if (referrer.rows.length === 0) {
            return false;
        }

        const referrerId = referrer.rows[0].id;
        
        // 确保不能自己推荐自己
        if (referrerId === userId) {
            return false;
        }
        
        // 添加推荐记录
        await db.query(
            'INSERT INTO referrals (referrer_id, referred_id, points_earned) VALUES ($1, $2, $3)',
            [referrerId, userId, 100] // 每次推荐奖励100积分
        );
        
        // 更新推荐人的积分
        await db.query(
            'UPDATE users SET points = points + $1 WHERE id = $2',
            [100, referrerId]
        );
        
        return true;
    } catch (error) {
        console.error('Error processing referral:', error);
        return false;
    }
}

module.exports = { router, processReferral };
