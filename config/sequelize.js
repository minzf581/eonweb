'use strict';

// 加载环境变量
if (process.env.NODE_ENV === 'production') {
    console.log('Loading environment from: .env.production');
    require('dotenv').config({ path: '.env.production' });
} else {
    require('dotenv').config();
}

const isLocal = process.env.NODE_ENV !== 'production';
console.log(`Running in ${isLocal ? 'local' : 'production'} mode`);

const productionConfig = {
    dialect: 'postgres',
    database: process.env.DB_NAME || 'eon_protocol',
    username: process.env.DB_USER || 'eonuser',
    password: process.env.DB_PASSWORD || 'eonprotocol',
    host: process.env.DB_HOST || '/cloudsql/eonhome-445809:asia-southeast2:eon-db',
    dialectOptions: {
        socketPath: process.env.DB_HOST || '/cloudsql/eonhome-445809:asia-southeast2:eon-db'
    },
    logging: console.log,
    retry: {
        max: 5,
        timeout: 3000
    }
};

const developmentConfig = {
    dialect: 'postgres',
    database: process.env.DB_NAME || 'eon_protocol',
    username: process.env.DB_USER || 'eonuser',
    password: process.env.DB_PASSWORD || 'eonprotocol',
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    logging: console.log,
    retry: {
        max: 5,
        timeout: 3000
    }
};

// Choose configuration based on environment
const dbConfig = isLocal ? developmentConfig : productionConfig;
console.log('Using database configuration:', {
    host: dbConfig.host,
    database: dbConfig.database,
    username: dbConfig.username,
    ssl: dbConfig.dialectOptions?.ssl ? 'enabled' : 'disabled'
});

if (!isLocal) {
    console.log('Using Cloud SQL configuration:', {
        host: dbConfig.host,
        socketPath: dbConfig.dialectOptions?.socketPath,
        database: dbConfig.database,
        username: dbConfig.username
    });
} else {
    console.log('Using local configuration:', {
        host: dbConfig.host,
        port: dbConfig.port,
        database: dbConfig.database,
        username: dbConfig.username
    });
}

// 导出配置供 Sequelize CLI 使用
module.exports = {
    development: developmentConfig,
    production: productionConfig,
    dbConfig // 添加这一行，导出当前环境的配置
};

// 初始化 Sequelize 实例
const { Sequelize } = require('sequelize');
const sequelize = new Sequelize(
    dbConfig.database,
    dbConfig.username,
    dbConfig.password,
    {
        ...dbConfig,
        retry: {
            max: 5,
            timeout: 3000
        }
    }
);

async function connectWithRetry(maxRetries = 5, delay = 5000) {
    let retries = 0;
    while (retries < maxRetries) {
        try {
            await sequelize.authenticate();
            console.log('Database connection has been established successfully.');
            break;
        } catch (error) {
            console.error('Connection error:', error.message);
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

// 导出 sequelize 实例
module.exports.sequelize = sequelize;
