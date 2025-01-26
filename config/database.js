require('dotenv').config({ path: process.env.NODE_ENV === 'production' ? '.env.production' : '.env' });

module.exports = {
  development: {
    username: process.env.DB_USER || 'eonuser',
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || 'eon_protocol',
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    dialect: 'postgres',
    logging: console.log
  },
  production: {
    username: process.env.DB_USER || 'eonuser',
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || 'eon_protocol',
    host: process.env.DB_HOST || '/cloudsql/eonhome-445809:asia-southeast2:eon-db',
    dialect: 'postgres',
    dialectOptions: {
      socketPath: process.env.DB_HOST || '/cloudsql/eonhome-445809:asia-southeast2:eon-db'
    },
    logging: false
  }
}; 