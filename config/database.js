// 加载环境变量
require('dotenv').config();

const isLocal = process.env.NODE_ENV !== 'production';
console.log(`Running in ${isLocal ? 'local' : 'production'} mode`);

const config = {
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
    host: config.host,
    database: config.database,
    username: config.username,
    ssl: config.dialectOptions?.ssl ? 'enabled' : 'disabled'
});

const { Sequelize } = require('sequelize');
const sequelize = new Sequelize(
    config.database,
    config.username,
    config.password,
    config
);

async function connectWithRetry(maxRetries = 5, delay = 5000) {
    let retries = 0;
    while (retries < maxRetries) {
        try {
            await sequelize.authenticate();
            console.log('Database connection has been established successfully.');
            break;
        } catch (error) {
            retries++;
            if (retries === maxRetries) {
                throw error;
            }
            console.log(`Failed to connect to database (attempt ${retries}/${maxRetries}). Retrying in ${delay/1000} seconds...`);
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
}

// Initialize connection
connectWithRetry()
    .catch(err => {
        console.error('Unable to connect to the database:', err);
        process.exit(1);
    });

// 导出配置
module.exports = sequelize;
module.exports.config = config;
