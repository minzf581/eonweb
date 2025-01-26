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
        console.log('Starting database migrations...');
        const { stdout, stderr } = await execPromise('npx sequelize-cli db:migrate');
        console.log('Migration stdout:', stdout);
        if (stderr) console.error('Migration stderr:', stderr);
        console.log('Database migrations completed successfully');
        return true;
    } catch (error) {
        console.error('Migration error:', error);
        return false;
    }
}

// 启动服务器
async function startServer() {
    try {
        // 运行迁移
        const migrationSuccess = await runMigrations();
        if (!migrationSuccess) {
            console.error('Database migrations failed, but continuing with server start...');
        }

        // 启动服务器
        app.listen(PORT, () => {
            console.log(`[DEBUG] Server started on port ${PORT}`);
        });
    } catch (error) {
        console.error('Server startup error:', error);
        process.exit(1);
    }
}

startServer();
