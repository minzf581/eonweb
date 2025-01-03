// 加载环境变量
if (process.env.NODE_ENV === 'production') {
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
    logging: console.log
};

const developmentConfig = {
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

// Choose configuration based on environment
const activeConfig = isLocal ? developmentConfig : productionConfig;
console.log('Using database configuration:', {
    host: activeConfig.host,
    database: activeConfig.database,
    username: activeConfig.username,
    ssl: activeConfig.dialectOptions?.ssl ? 'enabled' : 'disabled'
});

// Sequelize CLI configuration
const config = {
    development: developmentConfig,
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
        }
    },
    production: {
        ...config.production,
        pool: {
            max: 5,
            min: 0,
            acquire: 30000,
            idle: 10000
        }
    }
};

const env = process.env.NODE_ENV || 'development';
const currentConfig = runtimeConfig[env];

if (env === 'production') {
    console.log('Using Cloud SQL configuration:', {
        host: currentConfig.host,
        socketPath: currentConfig.dialectOptions?.socketPath,
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
