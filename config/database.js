const { Sequelize } = require('sequelize');
require('dotenv').config();

const sequelize = new Sequelize({
    dialect: 'postgres',
    host: process.env.DB_HOST || '/cloudsql/eon-web-445802:asia-southeast1:eon-db',
    username: process.env.DB_USER || 'eonuser',
    password: process.env.DB_PASSWORD || 'eon-user-2024',
    database: process.env.DB_NAME || 'eon_protocol',
    logging: false,
    dialectOptions: {
        socketPath: process.env.NODE_ENV === 'production'
            ? `/cloudsql/${process.env.CLOUD_SQL_CONNECTION_NAME}`
            : null
    }
});

module.exports = sequelize;