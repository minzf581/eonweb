// 加载环境变量
require('dotenv').config();

const isLocal = process.env.NODE_ENV !== 'production';
console.log(`Running in ${isLocal ? 'local' : 'production'} mode`);

const dbConfig = {
    dialect: 'postgres',
    database: process.env.DB_NAME || 'eon_protocol',
    username: process.env.DB_USER || 'eonuser',
    password: process.env.DB_PASSWORD || 'eonprotocol',
    host: process.env.DB_HOST || '34.101.201.243',
    port: process.env.DB_PORT || 5432,
    dialectOptions: {
        ssl: {
            require: true,
            rejectUnauthorized: false 
        }
    },
    logging: console.log
};

// 打印配置信息（不包含敏感信息）
console.log('Using database configuration:', {
    host: dbConfig.host,
    database: dbConfig.database,
    username: dbConfig.username,
    ssl: dbConfig.dialectOptions?.ssl ? 'enabled' : 'disabled'
});

// Sequelize CLI 需要的格式
module.exports = {
    development: dbConfig,
    test: dbConfig,
    production: dbConfig
};

// 导出运行时配置
module.exports.dbConfig = dbConfig;
