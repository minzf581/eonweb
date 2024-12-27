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
        console.log('Fetching referral data for user:', userId);
        
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
        
        // 获取最近的推荐历史
        const recentReferrals = await Referral.findAll({
            where: { referrerId: userId },
            include: [{
                model: User,
                as: 'referred',
                attributes: ['email']
            }],
            order: [['createdAt', 'DESC']],
            limit: 5
        });

        const referralHistory = recentReferrals.map(ref => ({
            email: ref.referred.email,
            pointsEarned: ref.pointsEarned,
            date: ref.createdAt
        }));

        console.log('Referral data:', {
            referralCode: user.referralCode,
            referralCount,
            totalPoints,
            referralHistory
        });

        res.json({
            success: true,
            data: {
                referralCode: user.referralCode,
                referralCount,
                totalPoints,
                referralHistory
            }
        });
    } catch (error) {
        console.error('Error in referral data endpoint:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch referral data',
            error: error.message
        });
    }
});

// 处理推荐逻辑
async function processReferral(userId, referralCode) {
    if (!referralCode) return null;

    try {
        // 查找推荐人
        const referrer = await User.findOne({
            where: { referralCode }
        });

        if (!referrer) return null;

        // 创建推荐记录
        const referral = await Referral.create({
            referrerId: referrer.id,
            referredId: userId,
            pointsEarned: 100 // 默认奖励积分
        });

        // 更新推荐人的积分
        await User.increment('points', {
            by: referral.pointsEarned,
            where: { id: referrer.id }
        });

        // 创建积分历史记录
        await PointHistory.create({
            userId: referrer.id,
            points: referral.pointsEarned,
            type: 'REFERRAL',
            description: `Referral bonus for user ${userId}`
        });

        return referral;
    } catch (error) {
        console.error('Error processing referral:', error);
        return null;
    }
}

module.exports = { router, processReferral };
