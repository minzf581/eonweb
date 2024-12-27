const express = require('express');
const cors = require('cors');
const path = require('path');
const cookieParser = require('cookie-parser');
const compression = require('compression');
const bcryptjs = require('bcryptjs');
const jwt = require('jsonwebtoken');
const sequelize = require('./config/database');
const { User, Task, UserTask, PointHistory, Settings } = require('./models');
const authRoutes = require('./routes/auth');

const app = express();

// 中间件
app.use(cors());
app.use(express.json());
app.use(cookieParser());
app.use(compression());
app.use(express.static(path.join(__dirname, 'public')));

// 请求日志中间件
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} ${req.method} ${req.url}`);
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

// 基础路由
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// API 路由
app.use('/api/auth', authRoutes);

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
    res.status(500).json({ 
        error: 'Internal Server Error',
        message: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});

// 启动服务器
const PORT = process.env.PORT || 8080;
async function startServer() {
    try {
        console.log('Starting server...');
        console.log('Environment:', process.env.NODE_ENV);
        console.log('Database config:', {
            host: process.env.NODE_ENV === 'production' ? '34.81.168.174' : '127.0.0.1',
            port: 5432,
            database: process.env.DB_NAME,
            username: process.env.DB_USER
        });
        
        await sequelize.authenticate();
        console.log('Database connection established');
        
        await sequelize.sync();
        console.log('Database synced');

        app.listen(PORT, () => {
            console.log(`Server running on port ${PORT}`);
        });
    } catch (error) {
        console.error('Failed to start server:', error);
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
    setTimeout(() => {
        process.exit(1);
    }, 1000);
});
