const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const settings = require('../models/settings');
const user = require('../models/user');
const pointhistory = require('../models/pointhistory');
const usertask = require('../models/usertask');

class userservice {
    // 创建用户
    static async createuser(email, password, referralcode = null, isadmin = false) {
        console.log('creating user:', email, 'isadmin:', isadmin);
        
        // 检查邮箱是否已存在
        const existinguser = await user.findOne({ email });
        if (existinguser) {
            throw new error('email already exists');
        }

        // 获取设置
        const settingsdoc = await settings.findOne({});
        const referralpoints = settingsdoc?.referralpoints || 100;
        const basereferralpoints = settingsdoc?.basereferralpoints || 50;
        const dailyreferrallimit = settingsdoc?.dailyreferrallimit || 10;

        // 生成唯一的推荐码
        const userreferralcode = crypto.randombytes(5).tostring('hex');
        
        const hashedpassword = await bcrypt.hash(password, 10);
        const newuser = new user({
            email,
            password: hashedpassword,
            isadmin,
            referralcode: userreferralcode,
            referredby: null  // 先设为 null，后面再更新
        });
        
        // 如果有推荐码，验证并处理推荐逻辑
        if (referralcode) {
            const referrer = await user.findOne({ referralcode });
            if (referrer) {
                // 检查推荐人今日推荐次数
                const today = new date();
                today.sethours(0, 0, 0, 0);
                const referralcount = await pointhistory.countdocuments({
                    userid: referrer._id,
                    type: 'referral',
                    createdat: { $gte: today }
                });

                if (referralcount >= dailyreferrallimit) {
                    // 如果超过限制，仍然可以注册，但推荐人不会获得积分
                    console.log(`referrer ${referrer.email} has reached daily limit`);
                } else {
                    // 更新用户的推荐人
                    newuser.referredby = referrer._id;

                    // 更新推荐人积分
                    referrer.points += referralpoints;
                    await referrer.save();

                    // 记录推荐人获得积分的历史
                    const referrerpointhistory = new pointhistory({
                        userid: referrer._id,
                        points: referralpoints,
                        type: 'referral',
                        description: `referral bonus for inviting ${email}`
                    });
                    await referrerpointhistory.save();

                    // 给新用户添加被推荐奖励积分
                    newuser.points = referralpoints;
                    
                    // 记录新用户获得积分的历史
                    const userpointhistory = new pointhistory({
                        userid: newuser._id,
                        points: referralpoints,
                        type: 'referral',
                        description: `welcome bonus from referral by ${referrer.email}`
                    });
                    await userpointhistory.save();
                }
            }
        } else {
            // 无推荐码，给予基础积分
            newuser.points = basereferralpoints;
            
            // 记录基础积分历史
            const pointhistory = new pointhistory({
                userid: newuser._id,
                points: basereferralpoints,
                type: 'bonus',
                description: 'welcome bonus for new user'
            });
            await pointhistory.save();
        }
        
        await newuser.save();
        console.log('user created:', newuser);
        
        return newuser._id;
    }

    // 验证用户
    static async verifyuser(email, password) {
        const user = await user.findOne({ email });
        if (!user) {
            return null;
        }

        const isvalid = await bcrypt.compare(password, user.password);
        if (!isvalid) {
            return null;
        }

        return {
            id: user._id,
            email: user.email,
            isadmin: user.isadmin,
            points: user.points
        };
    }

    // 获取所有用户
    static async getallusers() {
        const users = await user.find({}).sort({ createdat: -1 });
        return users.map(user => ({
            _id: user._id,
            email: user.email,
            isadmin: user.isadmin,
            points: user.points || 0,
            referralcode: user.referralcode || 'n/a',
            status: user.status || 'active',
            createdat: user.createdat
        }));
    }

    // 获取用户信息
    static async getuserbyid(userid) {
        const user = await user.findbyid(userid);
        if (!user) {
            throw new error('user not found');
        }
        return {
            id: user._id,
            email: user.email,
            isadmin: user.isadmin,
            points: user.points,
            referralcode: user.referralcode,
            referredby: user.referredby
        };
    }

    // 更新用户信息
    static async updateuser(userid, updates) {
        const user = await user.findbyid(userid);
        if (!user) {
            throw new error('user not found');
        }

        // 只允许更新特定字段
        const allowedupdates = ['email', 'isadmin', 'points'];
        object.keys(updates).foreach(key => {
            if (allowedupdates.includes(key)) {
                user[key] = updates[key];
            }
        });

        await user.save();
        return user;
    }

    // 删除用户
    static async deleteuser(userid) {
        const user = await user.findbyid(userid);
        if (!user) {
            throw new error('user not found');
        }

        await user.deletone({ _id: userid });
        // 清理相关数据
        await pointhistory.deletemany({ userid });
        await usertask.deletemany({ userid });
    }
}

module.exports = userservice;
