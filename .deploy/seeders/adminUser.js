const bcrypt = require('bcryptjs');
const { User } = require('../models');
const crypto = require('crypto');

async function seedAdminUser() {
    try {
        // 检查管理员用户是否已存在
        const existingAdmin = await User.findOne({
            where: { email: 'info@eon-protocol.com' }
        });

        if (!existingAdmin) {
            // 创建管理员用户
            const hashedPassword = await bcrypt.hash('vijTo9-kehmet-cessis', 10);
            
            await User.create({
                email: 'info@eon-protocol.com',
                password: hashedPassword,
                referralCode: crypto.randomBytes(4).toString('hex'),
                isAdmin: true,
                points: 0
            });
            
            console.log('Admin user created successfully');
        } else {
            console.log('Admin user already exists');
        }
    } catch (error) {
        console.error('Error seeding admin user:', error);
    }
}

// 如果直接运行此文件则执行种子
if (require.main === module) {
    seedAdminUser()
        .then(() => process.exit(0))
        .catch(error => {
            console.error(error);
            process.exit(1);
        });
}

module.exports = seedAdminUser;
