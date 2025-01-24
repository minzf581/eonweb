const bcrypt = require('bcryptjs');
const { Sequelize } = require('sequelize');
const crypto = require('crypto');
require('dotenv').config();

async function resetAdmin() {
    const isProduction = process.env.NODE_ENV === 'production';
    const dbConfig = {
        database: process.env.DB_NAME || 'eon_protocol',
        username: process.env.DB_USER || 'eonuser',
        password: process.env.DB_PASSWORD || 'eonprotocol',
        host: isProduction ? '/cloudsql/eonhome-445809:asia-southeast2:eon-db' : 'localhost',
        dialect: 'postgres',
        logging: console.log
    };

    if (isProduction) {
        dbConfig.dialectOptions = {
            socketPath: '/cloudsql/eonhome-445809:asia-southeast2:eon-db'
        };
    }

    console.log('Database configuration:', {
        host: dbConfig.host,
        database: dbConfig.database,
        username: dbConfig.username,
        environment: process.env.NODE_ENV
    });

    // 创建数据库连接
    const sequelize = new Sequelize(
        dbConfig.database,
        dbConfig.username,
        dbConfig.password,
        dbConfig
    );

    // 定义 User 模型
    const User = sequelize.define('User', {
        email: {
            type: Sequelize.STRING,
            allowNull: false,
            unique: true
        },
        username: {
            type: Sequelize.STRING,
            allowNull: true
        },
        password: {
            type: Sequelize.STRING,
            allowNull: false
        },
        is_admin: {
            type: Sequelize.BOOLEAN,
            defaultValue: false
        },
        points: {
            type: Sequelize.INTEGER,
            defaultValue: 0
        },
        credits: {
            type: Sequelize.INTEGER,
            defaultValue: 0
        },
        referral_code: {
            type: Sequelize.STRING,
            unique: true
        }
    }, {
        tableName: 'users',
        underscored: true,
        timestamps: true
    });

    try {
        // 测试数据库连接
        await sequelize.authenticate();
        console.log('Database connection established successfully.');

        const email = 'admin@eon-protocol.com';
        const password = 'admin123';

        // 检查管理员用户是否已存在
        console.log('Finding admin user with email:', email);
        const existingUser = await User.findOne({
            where: { email }
        });

        // 哈希密码
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        if (existingUser) {
            console.log('Found existing admin user, updating...');
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
        } else {
            console.log('Admin user not found, creating new one...');
            // 生成推荐码
            const referralCode = crypto.randomBytes(4).toString('hex');

            // 创建管理员用户
            const admin = await User.create({
                email,
                username: 'admin',
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
        }
    } catch (error) {
        console.error('Error managing admin user:', error);
        process.exit(1);
    } finally {
        await sequelize.close();
        process.exit(0);
    }
}

// 运行初始化函数
resetAdmin();
