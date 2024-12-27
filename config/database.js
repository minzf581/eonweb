const { Sequelize } = require('sequelize');
require('dotenv').config();

let sequelize;

// 配置数据库连接
sequelize = new Sequelize({
    dialect: 'postgres',
    host: '/cloudsql/eonhome-445809:asia-southeast2:eon-db',
    database: process.env.DB_NAME || 'eon_protocol',
    username: process.env.DB_USER || 'eonuser',
    password: process.env.DB_PASSWORD,
    pool: {
        max: 5,
        min: 0,
        acquire: 30000,
        idle: 10000
    },
    dialectOptions: {
        socketPath: '/cloudsql/eonhome-445809:asia-southeast2:eon-db'
    },
    logging: console.log
});

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
    throw new Error('Failed to start server');
};

// Initialize connection
connectWithRetry()
    .catch(err => {
        console.error('Failed to start server:', err);
        process.exit(1);
    });

module.exports = sequelize;
