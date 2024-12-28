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

app.get('/_ah/stop', (req, res) => {
    console.log('Received stop request');
    res.status(200).send('OK');
    
    // 给一些时间让响应发送完成
    setTimeout(() => {
        console.log('Shutting down server...');
        if (server) {
            server.close(() => {
                console.log('Server shutdown complete');
                process.exit(0);
            });
        } else {
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

// Serve static files without authentication
app.use(express.static('public'));

// Add a public route for the root path
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 处理前端路由
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 数据库同步和服务器启动
const startServer = async () => {
    try {
        // 同步数据库
        await sequelize.authenticate();
        console.log('Database connection has been established successfully.');
        
        await sequelize.sync();
        console.log('Database synchronized');
        
        // 创建管理员用户
        await seedAdminUser();
        console.log('Admin user created successfully');

        // 启动服务器
        const PORT = process.env.PORT || 8080;
        server = app.listen(PORT, () => {
            console.log(`Server running on port ${PORT}`);
        });
    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
};

startServer();

// 错误处理
process.on('unhandledRejection', (error) => {
    console.error('Unhandled promise rejection:', error);
});

module.exports = app;
