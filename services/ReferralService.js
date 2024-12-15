const User = require('../models/User');
const PointRecord = require('../models/PointRecord');

class ReferralService {
    static async handleReferral(newUser, referralCode) {
        if (!referralCode) {
            // 没有推荐码，给予基础积分
            await this.awardPoints(newUser._id, 50, 'OTHER');
            return;
        }

        try {
            // 查找推荐人
            const referrer = await User.findOne({ referralCode });
            if (!referrer) {
                // 推荐码无效，给予基础积分
                await this.awardPoints(newUser._id, 50, 'OTHER');
                return;
            }

            // 更新新用户的推荐人
            await User.findByIdAndUpdate(newUser._id, { referredBy: referrer._id });

            // 给推荐人奖励积分
            await this.awardPoints(referrer._id, 100, 'REFERRAL', newUser._id);

            // 给新用户奖励积分
            await this.awardPoints(newUser._id, 100, 'REFERRED', referrer._id);

        } catch (error) {
            console.error('Error in handleReferral:', error);
            // 如果处理推荐出错，至少给予基础积分
            await this.awardPoints(newUser._id, 50, 'OTHER');
        }
    }

    static async awardPoints(userId, points, type, referralId = null) {
        try {
            // 创建积分记录
            await PointRecord.create({
                userId,
                points,
                type,
                referralId
            });

            // 更新用户总积分
            await User.findByIdAndUpdate(userId, { $inc: { points } });
        } catch (error) {
            console.error('Error in awardPoints:', error);
            throw error;
        }
    }
}

module.exports = ReferralService;
