const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const settings = require('../models/settings');
const user = require('../models/user');
const pointhistory = require('../models/pointhistory');
const usertask = require('../models/usertask');

class UserService {
    // 创建用户
    static async createUser(email, password, referral_code = null, is_admin = false) {
        console.log('creating user:', email, 'is_admin:', is_admin);
        
        // 检查邮箱是否已存在
        const existingUser = await user.findOne({ email });
        if (existingUser) {
            throw new Error('email already exists');
        }

        // 获取设置
        const settingsDoc = await settings.findOne({});
        const referralPoints = settingsDoc?.referral_points || 100;
        const baseReferralPoints = settingsDoc?.base_referral_points || 50;
        const dailyReferralLimit = settingsDoc?.daily_referral_limit || 10;

        // 生成唯一的推荐码
        const userReferralCode = crypto.randomBytes(5).toString('hex');
        
        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = new user({
            email,
            password: hashedPassword,
            is_admin,
            referral_code: userReferralCode,
            referred_by: null  // 先设为 null，后面再更新
        });
        
        // 如果有推荐码，验证并处理推荐逻辑
        if (referral_code) {
            const referrer = await user.findOne({ referral_code });
            if (referrer) {
                // 检查推荐人今日推荐次数
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const referralCount = await pointhistory.countDocuments({
                    user_id: referrer._id,
                    type: 'referral',
                    created_at: { $gte: today }
                });

                if (referralCount >= dailyReferralLimit) {
                    // 如果超过限制，仍然可以注册，但推荐人不会获得积分
                    console.log(`referrer ${referrer.email} has reached daily limit`);
                } else {
                    // 更新用户的推荐人
                    newUser.referred_by = referrer._id;

                    // 更新推荐人积分
                    referrer.points += referralPoints;
                    await referrer.save();

                    // 记录推荐人获得积分的历史
                    const referrerPointHistory = new pointhistory({
                        user_id: referrer._id,
                        points: referralPoints,
                        type: 'referral',
                        description: `referral bonus for inviting ${email}`
                    });
                    await referrerPointHistory.save();

                    // 给新用户添加被推荐奖励积分
                    newUser.points = referralPoints;
                    
                    // 记录新用户获得积分的历史
                    const userPointHistory = new pointhistory({
                        user_id: newUser._id,
                        points: referralPoints,
                        type: 'referral',
                        description: `welcome bonus from referral by ${referrer.email}`
                    });
                    await userPointHistory.save();
                }
            }
        } else {
            // 无推荐码，给予基础积分
            newUser.points = baseReferralPoints;
            
            // 记录基础积分历史
            const pointHistory = new pointhistory({
                user_id: newUser._id,
                points: baseReferralPoints,
                type: 'bonus',
                description: 'welcome bonus for new user'
            });
            await pointHistory.save();
        }
        
        await newUser.save();
        console.log('user created:', newUser);
        
        return newUser._id;
    }

    // 验证用户
    static async verifyUser(email, password) {
        const user = await user.findOne({ email });
        if (!user) {
            return null;
        }

        const isValid = await bcrypt.compare(password, user.password);
        if (!isValid) {
            return null;
        }

        return {
            id: user._id,
            email: user.email,
            is_admin: user.is_admin,
            points: user.points
        };
    }

    // 获取所有用户
    static async getAllUsers() {
        const users = await user.find({}).sort({ created_at: -1 });
        return users.map(user => ({
            _id: user._id,
            email: user.email,
            is_admin: user.is_admin,
            points: user.points || 0,
            referral_code: user.referral_code || 'n/a',
            status: user.status || 'active',
            created_at: user.created_at
        }));
    }

    // 获取用户信息
    static async getUserById(user_id) {
        const user = await user.findById(user_id);
        if (!user) {
            throw new Error('user not found');
        }
        return {
            id: user._id,
            email: user.email,
            is_admin: user.is_admin,
            points: user.points,
            referral_code: user.referral_code,
            referred_by: user.referred_by
        };
    }

    // 更新用户信息
    static async updateUser(user_id, updates) {
        const user = await user.findById(user_id);
        if (!user) {
            throw new Error('user not found');
        }

        // 只允许更新特定字段
        const allowedUpdates = ['email', 'is_admin', 'points'];
        Object.keys(updates).forEach(key => {
            if (allowedUpdates.includes(key)) {
                user[key] = updates[key];
            }
        });

        await user.save();
        return user;
    }

    // 删除用户
    static async deleteUser(user_id) {
        const user = await user.findById(user_id);
        if (!user) {
            throw new Error('user not found');
        }

        await user.deleteOne({ _id: user_id });
        // 清理相关数据
        await pointhistory.deleteMany({ user_id });
        await usertask.deleteMany({ user_id });
    }
}

module.exports = UserService;
