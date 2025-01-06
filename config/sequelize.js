const { Sequelize } = require('sequelize');
const { dbConfig } = require('./database');

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

module.exports = sequelize;
