// 加载环境变量
if (process.env.NODE_ENV === 'production') {
    require('dotenv').config({ path: '.env.production' });
} else {
    require('dotenv').config();
}

const { Sequelize } = require('sequelize');

// 配置数据库连接
const config = {
    dialect: 'postgres',
    database: process.env.DB_NAME || 'eon_protocol',
    username: process.env.DB_USER || 'eonuser',
    password: process.env.DB_PASSWORD || 'eonprotocol',
    host: process.env.DB_HOST,
    dialectOptions: {
        socketPath: process.env.DB_HOST
    },
    logging: false
};

async function resetPassword() {
    const sequelize = new Sequelize(config);

    try {
        // 测试连接
        await sequelize.authenticate();
        console.log('Database connection established.');

        // 更新密码
        const [result] = await sequelize.query(`
            UPDATE "Users"
            SET "password" = '$2a$10$LjhDXCgvSPfmmj5X8z7Nn.eNZIj8ftPJG8D1P4dMkFi4aDu4mZ.eq',
                "updatedAt" = NOW()
            WHERE "email" = 'info@eon-protocol.com'
            RETURNING "id", "email", "updatedAt";
        `);

        if (result && result.length > 0) {
            console.log('Password reset successful for user:', {
                id: result[0].id,
                email: result[0].email,
                updatedAt: result[0].updatedAt
            });
        } else {
            console.log('No user found with email: info@eon-protocol.com');
        }
    } catch (error) {
        console.error('Error:', error);
    } finally {
        await sequelize.close();
    }
}

resetPassword();
