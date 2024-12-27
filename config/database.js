const { Sequelize } = require('sequelize');

// 加载环境变量
if (process.env.NODE_ENV === 'production') {
    require('dotenv').config({ path: '.env.production' });
} else {
    require('dotenv').config();
}

// 配置数据库连接
const config = {
    development: {
        dialect: 'postgres',
        database: process.env.DB_NAME || 'eon_protocol',
        username: process.env.DB_USER || 'eonuser',
        password: process.env.DB_PASSWORD || 'eonprotocol',
        host: 'localhost',
        port: process.env.DB_PORT || 5432,
        pool: {
            max: 5,
            min: 0,
            acquire: 30000,
            idle: 10000
        },
        logging: console.log
    },
    production: {
        dialect: 'postgres',
        database: process.env.DB_NAME || 'eon_protocol',
        username: process.env.DB_USER || 'eonuser',
        password: process.env.DB_PASSWORD || 'eonprotocol',
        host: process.env.DB_HOST,
        dialectOptions: {
            socketPath: process.env.DB_HOST
        },
        pool: {
            max: 5,
            min: 0,
            acquire: 30000,
            idle: 10000
        },
        logging: console.log
    }
};

// 在生产环境中使用 Cloud SQL Unix socket
const env = process.env.NODE_ENV || 'development';
const currentConfig = config[env];

if (env === 'production') {
    console.log('Using Cloud SQL configuration:', {
        host: currentConfig.host,
        socketPath: currentConfig.dialectOptions.socketPath,
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

const sequelize = new Sequelize(currentConfig);

// 测试连接
const connectWithRetry = async (maxRetries = 5, delay = 5000) => {
    let retries = 0;
    while (retries < maxRetries) {
        try {
            await sequelize.authenticate();
            console.log('Database connection has been established successfully.');
            return;
        } catch (error) {
            console.error('Connection attempt failed:', error);
            retries++;
            if (retries < maxRetries) {
                console.log(`Retrying connection... Attempt ${retries} of ${maxRetries}`);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }
    throw new Error('Failed to connect to database after multiple attempts');
};

// Initialize connection
connectWithRetry()
    .catch(err => {
        console.error('Unable to connect to the database:', err);
        process.exit(1);
    });

module.exports = sequelize;
module.exports.config = config; // 导出配置以供 Sequelize CLI 使用
