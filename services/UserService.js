const pool = require('../config/database');
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
                const settings = await Settings.findOne({ key: 'referralPoints' });
                const points = settings ? settings.value : 10; // 默认10点
                
                referrer.points += points;
                await referrer.save();
                
                // 记录积分历史
                await PointHistory.create({
                    userId: referrer._id,
                    points,
                    type: 'referral',
                    description: `Referral reward for user ${email}`
                });
            }
        }
        
        return user.id;
    }

    // 验证用户
    static async verifyUser(email, password) {
        const user = await User.findOne({ email });
        if (!user) return null;
        
        const isValid = await bcrypt.compare(password, user.password);
        return isValid ? user : null;
    }

    // 通过ID查找用户
    static async findById(id) {
        return User.findById(id);
    }

    // 通过邮箱查找用户
    static async findUserByEmail(email) {
        console.log('Finding user by email:', email);
        const user = await User.findOne({ email });
        console.log('Found user:', user);
        return user;
    }

    // 获取所有用户（管理员用）
    static async getAllUsers() {
        return User.find().select('-password').sort('-createdAt');
    }

    // 更新用户信息
    static async updateUser(userId, userData) {
        const { email, status, isAdmin } = userData;
        const updateData = {};
        
        if (email) updateData.email = email;
        if (status) updateData.status = status;
        if (typeof isAdmin !== 'undefined') updateData.isAdmin = isAdmin;
        
        return User.findByIdAndUpdate(userId, updateData, { new: true }).select('-password');
    }

    // 删除用户
    static async deleteUser(userId) {
        // 删除用户相关的所有数据
        await Promise.all([
            PointHistory.deleteMany({ userId }),
            UserTask.deleteMany({ userId }),
            User.findByIdAndDelete(userId)
        ]);
        return true;
    }

    // 获取用户统计信息
    static async getUserStats() {
        const stats = await User.aggregate([
            {
                $group: {
                    _id: null,
                    totalUsers: { $sum: 1 },
                    activeUsers: { 
                        $sum: { 
                            $cond: [{ $eq: ['$status', 'active'] }, 1, 0] 
                        }
                    },
                    totalPoints: { $sum: '$points' }
                }
            }
        ]);
        return stats[0];
    }

    // 获取用户的推荐历史
    static async getUserReferrals(userId) {
        const user = await User.findById(userId);
        if (!user) throw new Error('User not found');

        const referrals = await User.find({ referredBy: user.referralCode })
            .select('email createdAt points')
            .sort('-createdAt');

        return {
            referralCode: user.referralCode,
            totalReferrals: referrals.length,
            referralHistory: referrals.map(ref => ({
                email: ref.email,
                date: ref.createdAt,
                points: ref.points
            }))
        };
    }

    // 重置用户密码
    static async resetPassword(userId, newPassword) {
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        await User.findByIdAndUpdate(userId, { password: hashedPassword });
        return true;
    }

    // 更新用户积分
    static async updateUserPoints(userId, points, type, description) {
        const user = await User.findById(userId);
        if (!user) throw new Error('User not found');

        user.points += points;
        await user.save();

        // 记录积分历史
        await PointHistory.create({
            userId,
            points,
            type,
            description
        });

        return user.points;
    }
}

module.exports = UserService;
