const { Sequelize } = require('sequelize');

let sequelize;

if (process.env.NODE_ENV === 'production') {
    // Cloud SQL configuration for App Engine
    sequelize = new Sequelize(
        process.env.DB_NAME,
        process.env.DB_USER,
        process.env.DB_PASSWORD,
        {
            dialect: 'postgres',
            host: '/cloudsql/eonhome-445809:asia-southeast2:eon-db',
            dialectOptions: {
                // 在这里不需要 socketPath，因为我们在 host 中指定了
            },
            pool: {
                max: 5,
                min: 0,
                acquire: 30000,
                idle: 10000
            },
            logging: console.log
        }
    );
} else {
    // 本地开发环境配置
    sequelize = new Sequelize({
        dialect: 'postgres',
        host: 'localhost',
        database: process.env.DB_NAME,
        username: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        pool: {
            max: 5,
            min: 0,
            acquire: 30000,
            idle: 10000
        },
        logging: false
    });
}

// 测试连接
async function connectWithRetry(maxRetries = 5, delay = 5000) {
    for (let i = 0; i < maxRetries; i++) {
        try {
            await sequelize.authenticate();
            console.log('Database connection has been established successfully.');
            return true;
        } catch (err) {
            console.error('Connection attempt failed:', err);
            if (i < maxRetries - 1) {
                console.log(`Retrying connection... Attempt ${i + 1} of ${maxRetries}`);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }
    throw new Error('Failed to connect to database after multiple attempts');
}

// Initialize connection
connectWithRetry()
    .catch(err => {
        console.error('Failed to start server:', err);
        process.exit(1); // Exit if we can't connect to the database
    });

module.exports = sequelize;
