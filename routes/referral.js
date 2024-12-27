const express = require('express');
const router = express.Router();
const { User, PointHistory, Referral } = require('../models');
const { Op } = require('sequelize');
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
router.get('/api/referral', authenticate, async (req, res) => {
    try {
        const userId = req.user.id;
        
        // 获取用户的推荐码
        let user = await User.findByPk(userId);
        
        // 如果用户没有推荐码，生成一个
        if (!user.referralCode) {
            do {
                const code = generateReferralCode();
                try {
                    await user.update({ referralCode: code });
                    break;
                } catch (err) {
                    if (err.name === 'SequelizeUniqueConstraintError') {
                        continue; // 重新生成
                    }
                    throw err;
                }
            } while (true);
        }
        
        // 获取推荐统计
        const referralCount = await Referral.count({
            where: { referrerId: userId }
        });
        
        const totalPoints = await Referral.sum('pointsEarned', {
            where: {
                referrerId: userId
            }
        }) || 0; // 如果没有记录，返回0
        
        res.json({
            referralCode: user.referralCode,
            referralCount,
            totalPoints: totalPoints
        });
        
    } catch (error) {
        console.error('Error in /api/users/referral:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// 验证推荐码
router.post('/api/referral/verify', async (req, res) => {
    const { referralCode } = req.body;
    
    try {
        const referrer = await User.findOne({
            where: { referralCode }
        });
        
        if (!referrer) {
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
        const referrer = await User.findOne({
            where: { referralCode }
        });
        
        if (!referrer) {
            return false;
        }

        const referrerId = referrer.id;
        
        // 确保不能自己推荐自己
        if (referrerId === userId) {
            return false;
        }
        
        // 添加推荐记录
        await Referral.create({
            referrerId,
            referredId: userId,
            pointsEarned: 100 // 每次推荐奖励100积分
        });
        
        // 更新推荐人的积分
        await User.increment('points', { by: 100, where: { id: referrerId } });
        
        return true;
    } catch (error) {
        console.error('Error processing referral:', error);
        return false;
    }
}

module.exports = { router, processReferral };
