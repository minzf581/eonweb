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
        let user = await User.findByPk(userId);
        
        // 如果用户没有推荐码，生成一个
        if (!user.referralcode) {
            let code;
            do {
                code = generateReferralCode();
                // Check if code already exists
                const existingUser = await User.findOne({ where: { referralcode: code } });
                if (!existingUser) {
                    await user.update({ referralcode: code });
                    // Refresh user data
                    user = await User.findByPk(userId);
                    break;
                }
            } while (true);
        }
        
        // 获取推荐统计
        const referralCount = await Referral.count({
            where: { referrerid: userId }
        });
        
        const totalPoints = await Referral.sum('pointsearned', {
            where: {
                referrerid: userId
            }
        }) || 0; // 如果没有记录，返回0

        // 获取推荐历史
        const referrals = await Referral.findAll({
            where: { referrerid: userId },
            include: [{
                model: User,
                as: 'referred',
                attributes: ['email']
            }],
            order: [['createdat', 'DESC']]
        });

        res.json({
            success: true,
            data: {
                referralcode: user.referralcode,
                referralCount,
                totalPoints,
                referrals: referrals.map(ref => ({
                    id: ref.id,
                    email: ref.referred.email,
                    pointsearned: ref.pointsearned,
                    createdat: ref.createdat
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
            where: { referralcode: referralCode }
        });

        if (!referrer) {
            throw new Error('Invalid referral code');
        }

        if (referrer.id === userId) {
            throw new Error('Cannot use own referral code');
        }

        // 检查是否已经被推荐
        const existingReferral = await Referral.findOne({
            where: { referredid: userId }
        });

        if (existingReferral) {
            throw new Error('User already referred');
        }

        // 创建推荐记录
        const REFERRAL_POINTS = 100; // 推荐奖励积分
        const referral = await Referral.create({
            referrerid: referrer.id,
            referredid: userId,
            status: 'completed',
            pointsearned: REFERRAL_POINTS
        });

        // 更新推荐人的积分
        await User.increment('points', {
            by: REFERRAL_POINTS,
            where: { id: referrer.id }
        });

        // 记录积分历史
        await PointHistory.create({
            userid: referrer.id,
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
