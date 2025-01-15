const { User } = require('../models');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

async function resetAdmin() {
    try {
        // 1. Delete existing admin user
        console.log('Deleting existing admin user...');
        await User.destroy({
            where: { isAdmin: true }
        });
        console.log('Existing admin user deleted');

        // 2. Create new admin user
        console.log('Creating new admin user...');
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash('admin123', salt);

        const admin = await User.create({
            email: 'admin@example.com',
            password: hashedPassword,
            isAdmin: true,
            points: 0,
            referralCode: crypto.randomBytes(3).toString('hex')
        });

        console.log('Admin user reset successful:', {
            id: admin.id,
            email: admin.email,
            referralCode: admin.referralCode,
            passwordHash: hashedPassword
        });
    } catch (error) {
        console.error('Error resetting admin user:', error);
        process.exit(1);
    } finally {
        process.exit(0);
    }
}

// Execute reset
resetAdmin()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });
