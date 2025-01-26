// Load environment variables based on NODE_ENV
const dotenv = require('dotenv');
const envFile = process.env.NODE_ENV === 'production' ? '.env.production' : '.env';
dotenv.config({ path: envFile });
console.log('Loading environment from:', envFile);

const app = require('./app');
const { Sequelize } = require('sequelize');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

const PORT = parseInt(process.env.PORT || '8080', 10);

console.log('Running in production mode');

// 打印数据库配置
console.log('Database configuration:', {
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    username: process.env.DB_USER,
    ssl: process.env.DB_SSL || 'disabled',
    socketPath: process.env.NODE_ENV === 'production' ? process.env.DB_HOST : undefined
});

// 运行数据库迁移
async function runMigrations() {
    try {
        console.log('[Migration] Starting database migrations...');
        const { stdout, stderr } = await execPromise('npx sequelize-cli db:migrate');
        console.log('[Migration] stdout:', stdout);
        if (stderr) console.error('[Migration] stderr:', stderr);
        console.log('[Migration] Database migrations completed successfully');
        return true;
    } catch (error) {
        console.error('[Migration] Error:', error);
        return false;
    }
}

// 启动服务器
async function startServer() {
    try {
        // 等待数据库连接
        console.log('[Server] Waiting for database connection...');
        await new Promise(resolve => setTimeout(resolve, 5000));

        // 运行迁移
        console.log('[Server] Running database migrations...');
        const migrationSuccess = await runMigrations();
        if (!migrationSuccess) {
            console.error('[Server] Database migrations failed, but continuing with server start...');
        } else {
            console.log('[Server] Database migrations completed successfully');
        }

        // 启动服务器
        app.listen(PORT, () => {
            console.log(`[DEBUG] Server started on port ${PORT}`);
        });
    } catch (error) {
        console.error('[Server] Startup error:', error);
        process.exit(1);
    }
}

// 启动服务器
console.log('[Server] Starting server...');
startServer();
