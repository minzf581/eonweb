const User = require('../models/User');
const PointRecord = require('../models/PointRecord');

class ReferralService {
    static async handleReferral(newUser, referralCode) {
        if (!referralCode) {
            // No referral code, give base points
            await this.awardPoints(newUser._id, 50, 'OTHER');
            return;
        }

        try {
            // Find referrer
            const referrer = await User.findOne({ referralCode });
            if (!referrer) {
                // Invalid referral code, give base points
                await this.awardPoints(newUser._id, 50, 'OTHER');
                return;
            }

            // Update new user's referrer
            await User.findByIdAndUpdate(newUser._id, { referredBy: referrer._id });

            // Award points to referrer
            await this.awardPoints(referrer._id, 100, 'REFERRAL', newUser._id);

            // Award points to new user
            await this.awardPoints(newUser._id, 100, 'REFERRED', referrer._id);

        } catch (error) {
            console.error('Error in handleReferral:', error);
            // If referral processing fails, at least give base points
            await this.awardPoints(newUser._id, 50, 'OTHER');
        }
    }

    static async awardPoints(userId, points, type, referralId = null) {
        try {
            // Create points record
            await PointRecord.create({
                userId,
                points,
                type,
                referralId
            });

            // Update user total points
            await User.findByIdAndUpdate(userId, { $inc: { points } });
        } catch (error) {
            console.error('Error in awardPoints:', error);
            throw error;
        }
    }
}

module.exports = ReferralService;
