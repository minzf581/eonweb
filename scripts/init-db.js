/**
 * 数据库初始化脚本
 * 用于创建初始管理员账户和同步数据库结构
 * 
 * 使用方法：
 * node scripts/init-db.js
 * 
 * 环境变量：
 * DATABASE_URL - PostgreSQL 连接字符串
 * ADMIN_EMAIL - 管理员邮箱（默认：admin@eonprotocol.com）
 * ADMIN_PASSWORD - 管理员密码（默认：admin123456）
 */

require('dotenv').config();

const { sequelize, User, syncDatabase } = require('../models');
const { testConnection } = require('../config/database');

async function initializeDatabase() {
    console.log('='.repeat(50));
    console.log('EON Protocol 数据库初始化');
    console.log('='.repeat(50));

    try {
        // 测试数据库连接
        console.log('\n[1/3] 测试数据库连接...');
        const connected = await testConnection();
        if (!connected) {
            throw new Error('无法连接到数据库，请检查 DATABASE_URL 环境变量');
        }
        console.log('✓ 数据库连接成功');

        // 同步数据库结构
        console.log('\n[2/3] 同步数据库结构...');
        await syncDatabase(false); // false = 不强制删除现有表
        console.log('✓ 数据库结构同步完成');

        // 创建管理员账户
        console.log('\n[3/3] 创建管理员账户...');
        const adminEmail = process.env.ADMIN_EMAIL || 'admin@eonprotocol.com';
        const adminPassword = process.env.ADMIN_PASSWORD || 'admin123456';

        let admin = await User.findOne({ where: { email: adminEmail } });
        
        if (admin) {
            console.log(`✓ 管理员账户已存在: ${adminEmail}`);
        } else {
            admin = await User.create({
                email: adminEmail,
                password: adminPassword,
                role: 'admin',
                status: 'active',
                name: 'Administrator'
            });
            console.log(`✓ 管理员账户创建成功: ${adminEmail}`);
            console.log(`  密码: ${adminPassword}`);
            console.log('  ⚠️ 请登录后立即修改密码！');
        }

        console.log('\n' + '='.repeat(50));
        console.log('数据库初始化完成！');
        console.log('='.repeat(50));
        console.log('\n可用的门户入口：');
        console.log('  - 企业门户: /company');
        console.log('  - 投资人门户: /investor');
        console.log('  - 管理后台: /admin/fundraising.html');
        console.log('\n');

    } catch (error) {
        console.error('\n❌ 初始化失败:', error.message);
        console.error(error.stack);
        process.exit(1);
    } finally {
        await sequelize.close();
    }
}

// 运行初始化
initializeDatabase();
