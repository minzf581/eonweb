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
        if (!user.referralCode) {
            let code;
            do {
                code = generateReferralCode();
                // Check if code already exists
                const existingUser = await User.findOne({ where: { referralCode: code } });
                if (!existingUser) {
                    await user.update({ referralCode: code });
                    // Refresh user data
                    user = await User.findByPk(userId);
                    break;
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

        // 获取被推荐用户列表
        const referrals = await Referral.findAll({
            where: { referrerId: userId },
            include: [{
                model: User,
                as: 'referred',
                attributes: ['id', 'email', 'createdAt']
            }],
            order: [['createdAt', 'DESC']]
        });

        // 检查是否有数据
        if (!referrals || referrals.length === 0) {
            return res.json({
                success: true,
                data: {
                    referralCode: user.referralCode,
                    referralCount: 0,
                    totalPoints: 0,
                    referredUsers: []
                }
            });
        }

        const referredUsers = referrals.map(ref => ({
            email: ref.referred.email,
            joinedAt: ref.referred.createdAt,
            pointsEarned: ref.pointsEarned
        }));

        res.json({
            success: true,
            data: {
                referralCode: user.referralCode,
                referralCount,
                totalPoints,
                referredUsers
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
    try {
        if (!referralCode) {
            throw new Error('Referral code is required');
        }

        // 查找推荐人
        const referrer = await User.findOne({
            where: { referralCode }
        });

        if (!referrer) {
            throw new Error('Invalid referral code');
        }

        if (referrer.id === userId) {
            throw new Error('Cannot use own referral code');
        }

        // 检查是否已经被推荐
        const existingReferral = await Referral.findOne({
            where: { referredId: userId }
        });

        if (existingReferral) {
            throw new Error('User already referred');
        }

        // 创建推荐记录
        const referral = await Referral.create({
            referrerId: referrer.id,
            referredId: userId,
            status: 'pending',
            pointsEarned: 0 // 初始积分为0，等待完成任务后再奖励
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
