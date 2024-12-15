const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const Settings = require('../models/Settings');
const User = require('../models/User');
const PointHistory = require('../models/PointHistory');
const UserTask = require('../models/UserTask');

class UserService {
    // 创建用户
    static async createUser(email, password, referralCode = null, isAdmin = false) {
        console.log('Creating user:', email, 'isAdmin:', isAdmin);
        
        // 检查邮箱是否已存在
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            throw new Error('Email already exists');
        }

        // 获取设置
        const settings = await Settings.findOne({});
        const referralPoints = settings?.referralPoints || 100;
        const baseReferralPoints = settings?.baseReferralPoints || 50;
        const dailyReferralLimit = settings?.dailyReferralLimit || 10;

        // 生成唯一的推荐码
        const userReferralCode = crypto.randomBytes(5).toString('hex');
        
        const hashedPassword = await bcrypt.hash(password, 10);
        const user = new User({
            email,
            password: hashedPassword,
            isAdmin,
            referralCode: userReferralCode,
            referredBy: null  // 先设为 null，后面再更新
        });
        
        // 如果有推荐码，验证并处理推荐逻辑
        if (referralCode) {
            const referrer = await User.findOne({ referralCode });
            if (referrer) {
                // 检查推荐人今日推荐次数
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const referralCount = await PointHistory.countDocuments({
                    userId: referrer._id,
                    type: 'referral',
                    createdAt: { $gte: today }
                });

                if (referralCount >= dailyReferralLimit) {
                    // 如果超过限制，仍然可以注册，但推荐人不会获得积分
                    console.log(`Referrer ${referrer.email} has reached daily limit`);
                } else {
                    // 更新用户的推荐人
                    user.referredBy = referrer._id;

                    // 更新推荐人积分
                    referrer.points += referralPoints;
                    await referrer.save();

                    // 记录推荐人获得积分的历史
                    const referrerPointHistory = new PointHistory({
                        userId: referrer._id,
                        points: referralPoints,
                        type: 'referral',
                        description: `Referral bonus for inviting ${email}`
                    });
                    await referrerPointHistory.save();

                    // 给新用户添加被推荐奖励积分
                    user.points = referralPoints;
                    
                    // 记录新用户获得积分的历史
                    const userPointHistory = new PointHistory({
                        userId: user._id,
                        points: referralPoints,
                        type: 'referral',
                        description: `Welcome bonus from referral by ${referrer.email}`
                    });
                    await userPointHistory.save();
                }
            }
        } else {
            // 无推荐码，给予基础积分
            user.points = baseReferralPoints;
            
            // 记录基础积分历史
            const pointHistory = new PointHistory({
                userId: user._id,
                points: baseReferralPoints,
                type: 'bonus',
                description: 'Welcome bonus for new user'
            });
            await pointHistory.save();
        }
        
        await user.save();
        console.log('User created:', user);
        
        return user._id;
    }

    // 验证用户
    static async verifyUser(email, password) {
        const user = await User.findOne({ email });
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
            isAdmin: user.isAdmin,
            points: user.points
        };
    }

    // 获取所有用户
    static async getAllUsers() {
        const users = await User.find({});
        return users.map(user => ({
            id: user._id,
            email: user.email,
            isAdmin: user.isAdmin,
            points: user.points,
            referralCode: user.referralCode,
            referredBy: user.referredBy,
            createdAt: user.createdAt
        }));
    }

    // 获取用户信息
    static async getUserById(userId) {
        const user = await User.findById(userId);
        if (!user) {
            throw new Error('User not found');
        }
        return {
            id: user._id,
            email: user.email,
            isAdmin: user.isAdmin,
            points: user.points,
            referralCode: user.referralCode,
            referredBy: user.referredBy
        };
    }

    // 更新用户信息
    static async updateUser(userId, updates) {
        const user = await User.findById(userId);
        if (!user) {
            throw new Error('User not found');
        }

        // 只允许更新特定字段
        const allowedUpdates = ['email', 'isAdmin', 'points'];
        Object.keys(updates).forEach(key => {
            if (allowedUpdates.includes(key)) {
                user[key] = updates[key];
            }
        });

        await user.save();
        return user;
    }

    // 删除用户
    static async deleteUser(userId) {
        const user = await User.findById(userId);
        if (!user) {
            throw new Error('User not found');
        }

        await User.deleteOne({ _id: userId });
        // 清理相关数据
        await PointHistory.deleteMany({ userId });
        await UserTask.deleteMany({ userId });
    }
}

module.exports = UserService;
