const express = require('express');
const router = express.Router();
const { User, PointHistory, Referral } = require('../models');
const { Op } = require('sequelize');
const { authenticateToken } = require('../middleware/auth');

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
router.get('/', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        console.log('Fetching referral data for user:', userId);
        
        // 获取用户的推荐码
        let user = await User.findByPk(userId, { paranoid: false });
        
        // 如果用户没有推荐码，生成一个
        if (!user.referral_code) {
            let code;
            do {
                code = generateReferralCode();
                // Check if code already exists
                const existingUser = await User.findOne({ where: { referral_code: code }, paranoid: false });
                if (!existingUser) {
                    await user.update({ referral_code: code });
                    // Refresh user data
                    user = await User.findByPk(userId, { paranoid: false });
                    break;
                }
            } while (true);
        }
        
        // 获取推荐统计
        const referralCount = await Referral.count({
            where: {
                referrer_id: req.user.id,
                deleted_at: null
            }
        });
        
        const totalPoints = await Referral.sum('points_earned', {
            where: {
                referrer_id: req.user.id,
                deleted_at: null
            }
        }) || 0; // 如果没有记录，返回0

        // 获取推荐历史
        const referrals = await Referral.findAll({
            where: { 
                referrer_id: req.user.id,
                deleted_at: null
            },
            include: [{
                model: User,
                as: 'referred',
                attributes: ['email'],
                paranoid: false
            }],
            order: [['created_at', 'DESC']]
        });

        res.json({
            success: true,
            data: {
                referral_code: user.referral_code,
                referralCount,
                totalPoints,
                referrals: referrals.map(ref => ({
                    id: ref.id,
                    email: ref.referred.email,
                    points_earned: ref.points_earned,
                    created_at: ref.created_at
                }))
            }
        });
    } catch (error) {
        console.error('Error fetching referral data:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch referral data',
            error: error.message
        });
    }
});

// 处理推荐逻辑
async function processReferral(userId, referralCode) {
    try {
        if (!referralCode) {
            throw new Error('Referral code is required');
        }

        // 查找推荐人
        const referrer = await User.findOne({
            where: { referral_code: referralCode },
            paranoid: false
        });

        if (!referrer) {
            throw new Error('Invalid referral code');
        }

        if (referrer.id === userId) {
            throw new Error('Cannot use own referral code');
        }

        // 检查是否已经被推荐
        const existingReferral = await Referral.findOne({
            where: { referred_id: userId }
        });

        if (existingReferral) {
            throw new Error('User already referred');
        }

        // 创建推荐记录
        const REFERRAL_POINTS = 100; // 推荐奖励积分
        const referral = await Referral.create({
            referrer_id: referrer.id,
            referred_id: userId,
            status: 'completed',
            points_earned: REFERRAL_POINTS
        });

        // 更新推荐人的积分
        await User.increment('points', {
            by: REFERRAL_POINTS,
            where: { id: referrer.id }
        });

        // 记录积分历史
        await PointHistory.create({
            user_id: referrer.id,
            points: REFERRAL_POINTS,
            type: 'referral',
            description: `Referral bonus for user ${userId}`,
            status: 'completed'
        });

        return referral;
    } catch (error) {
        console.error('Error processing referral:', error);
        throw error;
    }
}

// 导出路由和处理函数
exports.router = router;
exports.processReferral = processReferral;
