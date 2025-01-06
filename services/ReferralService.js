const user = require('../models/User');
const pointrecord = require('../models/PointRecord');
const referral = require('../models/Referral');

class Referralservice {
    static async handlereferral(newuser, referralcode) {
        if (!referralcode) {
            // No referral code, give base points
            await this.awardpoints(newuser._id, 50, 'other');
            return;
        }

        try {
            // Find referrer
            const referrer = await user.findOne({ referralcode });
            if (!referrer) {
                // Invalid referral code, give base points
                await this.awardpoints(newuser._id, 50, 'other');
                return;
            }

            // Update new user's referrer
            await user.findByIdAndUpdate(newuser._id, { referredby: referrer._id });

            // Award points to referrer
            await this.awardpoints(referrer._id, 100, 'referral', newuser._id);

            // Award points to new user
            await this.awardpoints(newuser._id, 100, 'referred', referrer._id);

        } catch (error) {
            console.error('Error in handlereferral:', error);
            // If referral processing fails, at least give base points
            await this.awardpoints(newuser._id, 50, 'other');
        }
    }

    static async awardpoints(userid, points, type, referralid = null) {
        try {
            // Create points record
            await pointrecord.create({
                userid,
                points,
                type,
                referralid
            });

            // Update user total points
            await user.findByIdAndUpdate(userid, { $inc: { points } });
        } catch (error) {
            console.error('Error in awardpoints:', error);
            throw error;
        }
    }

    static async handlereferral(newuser, referralcode) {
        if (!referralcode) {
            return;
        }

        try {
            // Find the referrer
            const referrer = await user.findOne({ where: { referralcode } });
            if (!referrer) {
                console.log('Referrer not found for code:', referralcode);
                return;
            }

            // Create referral record
            await referral.create({
                referrerid: referrer.id,
                referredid: newuser.id,
                status: 'pending'
            });

            console.log('Referral created:', {
                referrer: referrer.id,
                referred: newuser.id
            });
        } catch (error) {
            console.error('Error handling referral:', error);
            throw error;
        }
    }
}

module.exports = Referralservice;
