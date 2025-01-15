'use strict';

// 加载环境变量
require('dotenv').config();

const fs = require('fs');
const path = require('path');

// Load environment-specific .env file
const envFile = process.env.NODE_ENV === 'production' ? '.env.production' : '.env';
const envPath = path.join(__dirname, '..', envFile);
if (fs.existsSync(envPath)) {
  console.log(`Loading environment from: ${envFile}`);
  require('dotenv').config({ path: envPath });
}

console.log(`Running in ${process.env.NODE_ENV} mode`);

const productionConfig = {
  dialect: 'postgres',
  database: process.env.DB_NAME || 'eon_protocol',
  username: process.env.DB_USER || 'eonuser',
  password: process.env.DB_PASSWORD || 'eonprotocol',
  host: 'localhost',  // Use localhost since we're using Cloud SQL Proxy
  port: 5432,
  dialectOptions: {
    // socketPath: process.env.DB_HOST || '/cloudsql/eonhome-445809:asia-southeast2:eon-db'
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
const dbConfig = process.env.NODE_ENV === 'production' ? productionConfig : developmentConfig;
console.log('Using database configuration:', {
  host: dbConfig.host,
  database: dbConfig.database,
  username: dbConfig.username,
  ssl: dbConfig.dialectOptions?.ssl ? 'enabled' : 'disabled'
});

if (process.env.NODE_ENV === 'production') {
  console.log('Using Cloud SQL configuration:', {
    host: dbConfig.host,
    port: dbConfig.port,
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
  production: productionConfig
};

// 仅在直接运行时初始化连接
if (require.main === module) {
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
}
