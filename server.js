// 加载环境变量
if (process.env.NODE_ENV === 'production') {
    require('dotenv').config({ path: '.env.production' });
} else {
    require('dotenv').config();
}

const express = require('express');
const cors = require('cors');
const path = require('path');
const cookieParser = require('cookie-parser');
const compression = require('compression');
const bcryptjs = require('bcryptjs');
const jwt = require('jsonwebtoken');
const sequelize = require('./config/database');
const seedAdminUser = require('./seeders/adminUser');
const { User, Task, UserTask, PointHistory, Settings } = require('./models');
const authRoutes = require('./routes/auth');
const { router: referralRoutes } = require('./routes/referral');
const tasksRoutes = require('./routes/tasks');
const statsRoutes = require('./routes/stats');
const { authenticateToken } = require('./middleware/auth');

const app = express();

// 中间件
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// Health check endpoints for App Engine
app.get('/_ah/start', (req, res) => {
    res.status(200).send('OK');
});

app.get('/_ah/health', (req, res) => {
    res.status(200).send('OK');
});

let server;

app.get('/_ah/stop', async (req, res) => {
    console.log('Received stop request');
    res.status(200).send('OK');
    
    // Give time for the response to be sent
    setTimeout(async () => {
        console.log('Shutting down server...');
        if (server) {
            try {
                await new Promise((resolve) => {
                    server.close(resolve);
                });
                console.log('Server shut down successfully');
                process.exit(0);
            } catch (error) {
                console.error('Error shutting down server:', error);
                process.exit(1);
            }
        } else {
            console.log('No server instance found');
            process.exit(0);
        }
    }, 1000);
});

app.use(express.json());
app.use(cookieParser());
app.use(compression());

// 请求日志中间件
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} ${req.method} ${req.url}`);
    if (req.method === 'POST') {
        console.log('Request body:', JSON.stringify(req.body, null, 2));
    }
    next();
});

// 认证中间件
app.use(authenticateToken);

// API 路由
app.use('/api/auth', authRoutes);
app.use('/api/referral', referralRoutes);
app.use('/api/tasks', tasksRoutes);
app.use('/api/stats', statsRoutes);

// Serve static files and root path without authentication
app.use(express.static(path.join(__dirname, 'public')));
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 处理前端路由
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 数据库同步和服务器启动
async function startServer() {
    try {
        // Test database connection
        await sequelize.authenticate();
        console.log('Database connection has been established successfully.');

        // Sync database
        await sequelize.sync();
        console.log('Database synchronized');

        // Create admin user
        await seedAdminUser();
        console.log('Admin user created successfully');

        // Start server
        const port = process.env.PORT || 8080;
        server = app.listen(port, () => {
            console.log(`Server running on port ${port}`);
        });
    } catch (error) {
        console.error('Unable to start server:', error);
        process.exit(1);
    }
}

startServer();

// 错误处理
process.on('unhandledRejection', (error) => {
    console.error('Unhandled promise rejection:', error);
});

module.exports = app;
