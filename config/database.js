const { Sequelize } = require('sequelize');

// 数据库配置
const sequelize = new Sequelize(
    process.env.DATABASE_URL || process.env.DB_URL || 'postgres://localhost:5432/eon_protocol',
    {
        dialect: 'postgres',
        logging: process.env.NODE_ENV === 'development' ? console.log : false,
        pool: {
            max: 5,
            min: 0,
            acquire: 30000,
            idle: 10000
        },
        dialectOptions: process.env.NODE_ENV === 'production' ? {
            ssl: {
                require: true,
                rejectUnauthorized: false
            }
        } : {}
    }
);

// 测试连接
const testConnection = async () => {
    try {
        await sequelize.authenticate();
        console.log('[Database] 数据库连接成功');
        return true;
    } catch (error) {
        console.error('[Database] 数据库连接失败:', error.message);
        return false;
    }
};

module.exports = { sequelize, testConnection };
