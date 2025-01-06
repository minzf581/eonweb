const { User, Referral } = require('../models');

class ReferralService {
    /**
     * Handle referral process for a new user
     * @param {Object} new_user - The newly registered user
     * @param {string} referral_code - Referral code used during registration
     */
    static async handleReferral(new_user, referral_code) {
        if (!referral_code) {
            console.log('No referral code provided');
            return;
        }

        try {
            console.log('Processing referral for new user:', {
                user_id: new_user.id,
                referral_code
            });

            // Find the referrer using the referral code
            const referrer = await User.findOne({ where: { referral_code } });

            if (!referrer) {
                console.log('Referrer not found for code:', referral_code);
                return;
            }

            console.log('Found referrer:', {
                referrer_id: referrer.id,
                referrer_email: referrer.email
            });

            // Create referral record
            await Referral.create({
                referrer_id: referrer.id,
                referred_id: new_user.id,
                points_earned: 0,
                status: 'pending'
            });

            console.log('Referral record created successfully');

            // Update points for both users
            await User.increment('points', { by: 10, where: { id: referrer.id } });
            await User.increment('points', { by: 5, where: { id: new_user.id } });

            console.log('Points updated for both users');

        } catch (error) {
            console.error('Error processing referral:', error);
            throw error;
        }
    }
}

module.exports = ReferralService;
