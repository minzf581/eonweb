const { Sequelize } = require('sequelize');

let sequelize;

if (process.env.NODE_ENV === 'production') {
    sequelize = new Sequelize({
        dialect: 'postgres',
        database: process.env.DB_NAME,
        username: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        dialectOptions: {
            socketPath: '/cloudsql/eon-web-445802:asia-southeast2:eon-db-jakarta'
        },
        pool: {
            max: 5,
            min: 0,
            acquire: 30000,
            idle: 10000
        },
        logging: (...msg) => console.log('Sequelize Log:', msg)
    });
} else {
    sequelize = new Sequelize({
        dialect: 'postgres',
        host: 'localhost',
        database: process.env.DB_NAME,
        username: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        logging: console.log
    });
}

// 连接重试逻辑
const maxRetries = 5;
const retryDelay = 2000;

const connectWithRetry = async (retries = 0) => {
    try {
        await sequelize.authenticate();
        console.log('Database connection established successfully');
        console.log('Connection config:', {
            database: process.env.DB_NAME,
            username: process.env.DB_USER,
            socketPath: process.env.NODE_ENV === 'production' ? '/cloudsql/eon-web-445802:asia-southeast2:eon-db-jakarta' : 'localhost'
        });
    } catch (err) {
        console.error('Connection attempt failed:', err);
        if (retries < maxRetries) {
            console.log(`Retrying connection... Attempt ${retries + 1} of ${maxRetries}`);
            await new Promise(resolve => setTimeout(resolve, retryDelay));
            return connectWithRetry(retries + 1);
        }
        throw err;
    }
};

connectWithRetry().catch(err => {
    console.error('Failed to establish database connection:', err);
    process.exit(1);
});

module.exports = sequelize;
