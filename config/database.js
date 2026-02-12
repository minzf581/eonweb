const { Sequelize } = require('sequelize');

// 数据库配置 - 优化连接池和超时设置
const sequelize = new Sequelize(
    process.env.DATABASE_URL || process.env.DB_URL || 'postgres://localhost:5432/eon_protocol',
    {
        dialect: 'postgres',
        logging: process.env.NODE_ENV === 'development' ? console.log : false,
        pool: {
            max: 20,              // 增加最大连接数
            min: 2,              // 保持最小连接数
            acquire: 60000,      // 增加获取连接超时时间到60秒
            idle: 30000,         // 增加空闲连接超时时间
            evict: 10000         // 连接回收检查间隔
        },
        retry: {
            max: 3,              // 最大重试次数
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

// 连接重试机制
const testConnection = async (retries = 3, delay = 5000) => {
    for (let i = 0; i < retries; i++) {
        try {
            await sequelize.authenticate();
            console.log('[Database] 数据库连接成功');
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

// 监听连接错误
sequelize.connectionManager.pool.on('error', (err) => {
    console.error('[Database] 连接池错误:', err);
});

module.exports = { sequelize, testConnection };
