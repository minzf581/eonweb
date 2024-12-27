const { User } = require('../models');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

async function resetAdmin() {
    try {
        // 1. 删除现有管理员用户
        console.log('Deleting existing admin user...');
        await User.destroy({
            where: { email: 'info@eon-protocol.com' }
        });
        console.log('Existing admin user deleted');

        // 2. 创建新的管理员用户
        console.log('Creating new admin user...');
        const hashedPassword = await bcrypt.hash('vijTo9-kehmet-cessis', 10);
        
        const admin = await User.create({
            email: 'info@eon-protocol.com',
            password: hashedPassword,
            referralCode: crypto.randomBytes(4).toString('hex').toUpperCase(),
            isAdmin: true,
            points: 0
        });
        
        console.log('New admin user created successfully:', {
            id: admin.id,
            email: admin.email,
            referralCode: admin.referralCode,
            passwordHash: hashedPassword
        });
    } catch (error) {
        console.error('Error resetting admin user:', error);
        process.exit(1);
    }
}

// 执行重置
resetAdmin()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });
