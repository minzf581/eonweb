// 加载环境变量
if (process.env.NODE_ENV === 'production') {
    require('dotenv').config({ path: '.env.production' });
} else {
    require('dotenv').config();
}

const productionConfig = {
    dialect: 'postgres',
    database: process.env.DB_NAME || 'eon_protocol',
    username: process.env.DB_USER || 'eonuser',
    password: process.env.DB_PASSWORD || 'eonprotocol',
    host: '127.0.0.1',  // 使用 localhost 通过 Cloud SQL Auth Proxy 连接
    port: process.env.DB_PORT || 5432,
    dialectOptions: {
        // 在这里可以添加 SSL 配置如果需要
    }
};

// Sequelize CLI 配置
const config = {
    development: {
        dialect: 'postgres',
        database: process.env.DB_NAME || 'eon_protocol',
        username: process.env.DB_USER || 'eonuser',
        password: process.env.DB_PASSWORD || 'eonprotocol',
        host: 'localhost',
        port: process.env.DB_PORT || 5432
    },
    production: productionConfig
};

// 应用运行时配置
const runtimeConfig = {
    development: {
        ...config.development,
        pool: {
            max: 5,
            min: 0,
            acquire: 30000,
            idle: 10000
        },
        logging: console.log
    },
    production: {
        ...config.production,
        pool: {
            max: 5,
            min: 0,
            acquire: 30000,
            idle: 10000
        },
        logging: console.log
    }
};

const env = process.env.NODE_ENV || 'development';
const currentConfig = runtimeConfig[env];

if (env === 'production') {
    console.log('Using Cloud SQL configuration:', {
        host: currentConfig.host,
        port: currentConfig.port,
        database: currentConfig.database,
        username: currentConfig.username
    });
} else {
    console.log('Using local configuration:', {
        host: currentConfig.host,
        port: currentConfig.port,
        database: currentConfig.database,
        username: currentConfig.username
    });
}

const { Sequelize } = require('sequelize');
const sequelize = new Sequelize(
    currentConfig.database,
    currentConfig.username,
    currentConfig.password,
    currentConfig
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
module.exports.development = config.development;
module.exports.production = config.production;
