const { Sequelize } = require('sequelize');

let sequelize;

if (process.env.NODE_ENV === 'production') {
    sequelize = new Sequelize({
        dialect: 'postgres',
        host: '/cloudsql/' + process.env.CLOUD_SQL_CONNECTION_NAME,
        database: process.env.DB_NAME,
        username: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        dialectOptions: {
            socketPath: '/cloudsql/' + process.env.CLOUD_SQL_CONNECTION_NAME
        },
        pool: {
            max: 5,
            min: 0,
            acquire: 30000,
            idle: 10000
        },
        logging: false
    });
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
sequelize.authenticate()
    .then(() => {
        console.log('Database connection has been established successfully.');
    })
    .catch(err => {
        console.error('Unable to connect to the database:', err);
    });

module.exports = sequelize;