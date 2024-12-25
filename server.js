const express = require('express');
const cors = require('cors');
const path = require('path');
const cookieParser = require('cookie-parser');
const compression = require('compression');
const bcryptjs = require('bcryptjs');
const jwt = require('jsonwebtoken');
const sequelize = require('./config/database');
const { User, Task, UserTask, PointHistory, Settings } = require('./models');

const app = express();

// 中间件
app.use(cors());
app.use(express.json());
app.use(cookieParser());
app.use(compression());
app.use(express.static(path.join(__dirname, 'public')));

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
app.post('/api/auth/register', async (req, res) => {
    try {
        const { email, password, referralCode } = req.body;
        
        const existingUser = await User.findOne({ where: { email } });
        if (existingUser) {
            return res.status(400).json({ error: 'Email already registered' });
        }

        const user = await User.create({
            email,
            password, // 密码会通过模型的钩子自动加密
            referralCode: referralCode || null
        });

        const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET);
        res.json({ token });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ error: 'Registration failed' });
    }
});

app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        
        const user = await User.findOne({ where: { email } });
        if (!user) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const isValid = await bcryptjs.compare(password, user.password);
        if (!isValid) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET);
        res.json({ token });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Login failed' });
    }
});

// 受保护的路由
app.get('/api/tasks', authenticateToken, async (req, res) => {
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
