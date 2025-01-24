const { User } = require('../models');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

async function resetAdmin() {
    try {
        console.log('Environment:', process.env.NODE_ENV);
        console.log('Database Host:', process.env.DB_HOST);
        
        // 1. 查找现有管理员用户
        console.log('Finding existing admin user...');
        const existingUser = await User.findOne({
            where: { email: 'admin@eon-protocol.com' }
        });

        if (!existingUser) {
            console.log('Admin user not found, creating new one...');
            // 创建新管理员
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash('admin123', salt);

            const admin = await User.create({
                email: 'admin@eon-protocol.com',
                username: 'admin',
                password: hashedPassword,
                is_admin: true,
                points: 0,
                credits: 0,
                referral_code: crypto.randomBytes(3).toString('hex')
            });

            console.log('Admin user created successfully:', {
                id: admin.id,
                email: admin.email,
                referral_code: admin.referral_code
            });
        } else {
            console.log('Updating existing admin user...');
            // 更新现有管理员
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash('admin123', salt);

            await existingUser.update({
                password: hashedPassword,
                is_admin: true,
                updated_at: new Date()
            });

            console.log('Admin user updated successfully:', {
                id: existingUser.id,
                email: existingUser.email,
                is_admin: true
            });
        }

        process.exit(0);
    } catch (error) {
        console.error('Error resetting admin user:', error);
        process.exit(1);
    }
}

// Execute reset
resetAdmin();
