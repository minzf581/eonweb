// Load environment variables based on NODE_ENV
const dotenv = require('dotenv');
const envFile = process.env.NODE_ENV === 'production' ? '.env.production' : '.env';
dotenv.config({ path: envFile });
console.log('Loading environment from:', envFile);

const app = require('./app');
const PORT = parseInt(process.env.PORT || '8080', 10);

console.log('Running in production mode');

// 打印数据库配置
console.log('Using database configuration:', {
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    username: process.env.DB_USER,
    ssl: process.env.DB_SSL || 'disabled'
});

// 打印Cloud SQL配置
console.log('Using Cloud SQL configuration:', {
    host: process.env.DB_HOST,
    socketPath: process.env.DB_HOST,
    database: process.env.DB_NAME,
    username: process.env.DB_USER
});

// 启动服务器
app.listen(PORT, () => {
    console.log(`[DEBUG] 服务器启动在端口 ${PORT}`);
});
