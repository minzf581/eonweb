const bcrypt = require('bcryptjs');
const { Sequelize } = require('sequelize');
const crypto = require('crypto');

async function resetAdmin() {
    const isProduction = process.env.NODE_ENV === 'production';
    const socketPath = '/cloudsql/eonhome-445809:asia-southeast2:eon-db';

    // 创建数据库连接
    const sequelize = new Sequelize(
        process.env.DB_NAME || 'eon_protocol',
        process.env.DB_USER || 'eonuser',
        process.env.DB_PASSWORD, 
        {
            host: socketPath,
            dialect: 'postgres',
            dialectOptions: {
                socketPath: socketPath
            },
            logging: console.log
        }
    );

    // 定义 User 模型
    const User = sequelize.define('User', {
        email: {
            type: Sequelize.STRING,
            allowNull: false,
            unique: true
        },
        password: {
            type: Sequelize.STRING,
            allowNull: false
        },
        is_admin: {
            type: Sequelize.BOOLEAN,
            defaultValue: false
        }
    }, {
        tableName: 'users',
        underscored: true,
        timestamps: true
    });

    try {
        // 测试数据库连接
        await sequelize.authenticate();
        console.log('Database connection has been established successfully.');

        // 创建管理员账户
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash('admin123', salt);

        await User.create({
            email: 'lewis@eon-protocol.com',
            password: hashedPassword,
            is_admin: true
        });

        console.log('Admin user created successfully');
    } catch (error) {
        if (error.name === 'SequelizeUniqueConstraintError') {
            console.log('Admin user already exists');
        } else {
            console.error('Error:', error);
        }
    } finally {
        await sequelize.close();
    }
}

resetAdmin();
