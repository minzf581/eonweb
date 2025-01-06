// 加载环境变量
require('dotenv').config();

const isLocal = process.env.NODE_ENV !== 'production';
console.log(`Running in ${isLocal ? 'local' : 'production'} mode`);

const dbConfig = {
    dialect: 'postgres',
    database: process.env.DB_NAME || 'eon_protocol',
    username: process.env.DB_USER || 'eonuser',
    password: process.env.DB_PASSWORD || 'eonprotocol',
    host: process.env.DB_HOST || '/cloudsql/eonhome-445809:asia-southeast2:eon-db',
    dialectOptions: {
        socketPath: process.env.DB_HOST || '/cloudsql/eonhome-445809:asia-southeast2:eon-db'
    },
    logging: console.log
};

// 打印配置信息（不包含敏感信息）
console.log('Using database configuration:', {
    host: dbConfig.host,
    database: dbConfig.database,
    username: dbConfig.username,
    socketPath: dbConfig.dialectOptions?.socketPath
});

// Sequelize CLI 需要的格式
module.exports = {
    development: dbConfig,
    test: dbConfig,
    production: dbConfig
};

// 导出运行时配置
module.exports.dbConfig = dbConfig;
