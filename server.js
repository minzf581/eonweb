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

const app = express();

// 中间件
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

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
const authenticateToken = async (req, res, next) => {
    try {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];

        if (!token) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findByPk(decoded.userId);
        
        if (!user) {
            return res.status(401).json({ error: 'User not found' });
        }

        req.user = user;
        next();
    } catch (error) {
        return res.status(401).json({ error: 'Invalid token' });
    }
};

// API 路由
app.use('/api/auth', authRoutes);

// 静态文件
app.use(express.static(path.join(__dirname, 'public')));

// 基础路由
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 受保护的路由
app.get('/api/users/tasks', authenticateToken, async (req, res) => {
    try {
        const tasks = await Task.findAll({
            include: [{
                model: UserTask,
                as: 'userTasks',
                where: { userId: req.user.id },
                required: false
            }]
        });
        res.json(tasks);
    } catch (error) {
        console.error('Error fetching tasks:', error);
        res.status(500).json({ error: 'Failed to fetch tasks' });
    }
});

// 错误处理中间件
app.use((err, req, res, next) => {
    console.error('Error:', err);
    console.error('Stack:', err.stack);
    res.status(500).json({
        error: 'Internal Server Error',
        message: err.message,
        stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
});

// 404 处理
app.use((req, res) => {
    res.status(404).json({ error: 'Not Found' });
});

// 启动服务器
async function startServer() {
    try {
        // 连接数据库
        await sequelize.authenticate();
        console.log('Database connection has been established successfully.');
        
        // 同步数据库模型
        await sequelize.sync();
        console.log('Database synchronized');
        
        // 创建管理员用户
        await seedAdminUser();
        console.log('Admin user created successfully');
        
        // 启动服务器
        const port = process.env.PORT || 8080;
        app.listen(port, () => {
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
    console.error('Unhandled rejection:', error);
});

process.on('uncaughtException', (error) => {
    console.error('Uncaught exception:', error);
    process.exit(1);
});
