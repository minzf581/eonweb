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

        // 生成唯一的推荐码
        const userReferralCode = crypto.randomBytes(5).toString('hex');
        
        const hashedPassword = await bcrypt.hash(password, 10);
        const user = new User({
            email,
            password: hashedPassword,
            isAdmin,
            referralCode: userReferralCode,
            referredBy: referralCode
        });
        
        await user.save();
        console.log('User created:', user);
        
        // 如果有推荐人，更新推荐人的积分
        if (referralCode) {
            const referrer = await User.findOne({ referralCode });
            if (referrer) {
                // 获取推荐奖励积分设置
                const settings = await Settings.findOne({});
                const referralPoints = settings?.referralPoints || 50;

                // 更新推荐人积分
                referrer.points += referralPoints;
                await referrer.save();

                // 记录积分历史
                const pointHistory = new PointHistory({
                    userId: referrer._id,
                    points: referralPoints,
                    type: 'referral',
                    description: `Referral bonus for inviting ${email}`
                });
                await pointHistory.save();
            }
        }
        
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
