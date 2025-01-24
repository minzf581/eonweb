const bcrypt = require('bcryptjs');
const { Sequelize } = require('sequelize');
const crypto = require('crypto');

async function resetAdmin() {
    // 创建数据库连接
    const sequelize = new Sequelize(process.env.DB_NAME, process.env.DB_USER, process.env.DB_PASSWORD, {
        host: process.env.DB_HOST,
        dialect: 'postgres',
        dialectOptions: {
            socketPath: process.env.DB_HOST
        }
    });

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
