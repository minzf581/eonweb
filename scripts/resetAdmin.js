const { Sequelize } = require('sequelize');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const dotenv = require('dotenv');

// Load environment variables
const envFile = process.env.NODE_ENV === 'production' ? '.env.production' : '.env';
dotenv.config({ path: envFile });
console.log('Loading environment from:', envFile);

async function resetAdmin() {
    const isProduction = process.env.NODE_ENV === 'production';
    console.log('Running in', isProduction ? 'production' : 'development', 'mode');

    // 配置数据库连接
    const dbConfig = {
        database: process.env.DB_NAME || 'eon_protocol',
        username: process.env.DB_USER || 'eonuser',
        password: process.env.DB_PASSWORD,
        host: isProduction ? process.env.DB_HOST : 'localhost',
        port: process.env.DB_PORT || 5432,
        dialect: 'postgres',
        logging: console.log
    };

    // 在生产环境中使用 Cloud SQL socket
    if (isProduction) {
        dbConfig.dialectOptions = {
            socketPath: process.env.DB_HOST
        };
        delete dbConfig.host;
        delete dbConfig.port;
    }

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
        console.log('Database connection established successfully');

        // 查找现有管理员用户
        console.log('Finding existing admin user...');
        const existingUser = await User.findOne({
            where: { email: 'admin@eon-protocol.com' }
        });

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash('admin123', salt);

        if (!existingUser) {
            console.log('Creating new admin user...');
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
    } catch (error) {
        console.error('Error managing admin user:', error);
        process.exit(1);
    } finally {
        await sequelize.close();
        process.exit(0);
    }
}

// Execute reset
resetAdmin();
