const { Sequelize } = require('sequelize');

// 数据库配置 - 优化连接池和超时设置
const sequelize = new Sequelize(
    process.env.DATABASE_URL || process.env.DB_URL || 'postgres://localhost:5432/eon_protocol',
    {
        dialect: 'postgres',
        logging: process.env.NODE_ENV === 'development' ? console.log : false,
        pool: {
            max: 20,              // 最大连接数
            min: 2,               // 保持最小连接数
            acquire: 60000,       // 获取连接超时时间60秒
            idle: 30000,          // 空闲连接超时时间
            evict: 10000          // 连接回收检查间隔
        },
        retry: {
            max: 5,               // 单次查询最大重试次数
            match: [
                /ETIMEDOUT/,
                /EHOSTUNREACH/,
                /ECONNREFUSED/,
                /ECONNRESET/,
                /ENOTFOUND/,
                /SequelizeConnectionError/,
                /SequelizeConnectionRefusedError/,
                /SequelizeHostNotFoundError/,
                /SequelizeHostNotReachableError/,
                /SequelizeInvalidConnectionError/,
                /SequelizeConnectionTimedOutError/
            ]
        },
        dialectOptions: process.env.NODE_ENV === 'production' ? {
            ssl: {
                require: true,
                rejectUnauthorized: false
            },
            connectTimeout: 60000,  // 连接超时60秒
            statement_timeout: 30000, // 查询超时30秒
            query_timeout: 30000
        } : {
            connectTimeout: 10000,
            statement_timeout: 10000,
            query_timeout: 10000
        }
    }
);

// 数据库连接状态
let dbConnected = false;

// 连接测试（启动时用，重试次数多、间隔长，等待数据库启动）
const testConnection = async (retries = 15, delay = 10000) => {
    for (let i = 0; i < retries; i++) {
        try {
            await sequelize.authenticate();
            console.log('[Database] 数据库连接成功');
            dbConnected = true;
            return true;
        } catch (error) {
            console.error(`[Database] 数据库连接失败 (尝试 ${i + 1}/${retries}):`, error.message);
            if (i < retries - 1) {
                console.log(`[Database] ${delay / 1000}秒后重试...`);
                await new Promise(resolve => setTimeout(resolve, delay));
            } else {
                console.error('[Database] 数据库连接失败，已达到最大重试次数');
                return false;
            }
        }
    }
    return false;
};

// 后台重连机制 - 当初始连接失败时在后台持续重试
const startBackgroundReconnect = (onConnected, interval = 15000) => {
    console.log('[Database] 启动后台重连机制...');
    const timer = setInterval(async () => {
        try {
            await sequelize.authenticate();
            console.log('[Database] 后台重连成功！');
            dbConnected = true;
            clearInterval(timer);
            if (onConnected) {
                await onConnected();
            }
        } catch (error) {
            console.log(`[Database] 后台重连尝试失败: ${error.message}`);
        }
    }, interval);
    
    // 返回 timer 以便需要时清除
    return timer;
};

const isConnected = () => dbConnected;

module.exports = { sequelize, testConnection, startBackgroundReconnect, isConnected };
