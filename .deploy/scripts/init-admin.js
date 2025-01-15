const bcrypt = require('bcryptjs');
const { User } = require('../models');
const crypto = require('crypto');

async function initAdmin() {
    try {
        const email = 'info@eon-protocol.com';
        const password = 'vijTo9-kehmet-cessis';

        // 检查管理员用户是否已存在
        const existingAdmin = await User.findOne({
            where: { email }
        });

        if (existingAdmin) {
            console.log('Admin user already exists');
            return;
        }

        // 哈希密码
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // 生成推荐码
        const referralCode = crypto.randomBytes(4).toString('hex');

        // 创建管理员用户
        const admin = await User.create({
            email,
            username: email.split('@')[0],
            password: hashedPassword,
            is_admin: true,
            points: 0,
            credits: 0,
            referral_code: referralCode
        });

        console.log('Admin user created successfully:', {
            id: admin.id,
            email: admin.email,
            is_admin: admin.is_admin,
            referral_code: admin.referral_code
        });
    } catch (error) {
        console.error('Error creating admin user:', error);
    }
}

// 运行初始化函数
initAdmin();
