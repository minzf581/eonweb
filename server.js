const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
require('dotenv').config();
const UserService = require('./services/UserService');
const User = require('./models/User');
const TaskService = require('./services/TaskService');
const Task = require('./models/Task');

const app = express();

// 中间件配置
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// CORS 配置
const corsOptions = {
    origin: function (origin, callback) {
        const allowedOrigins = ['https://w3router.github.io', 'http://localhost:3000', 'https://eon-protocol.github.io'];
        if (!origin || allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept']
};

app.use(cors(corsOptions));

// 预检请求处理
app.options('*', cors(corsOptions));

// 添加安全头
app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (origin && ['https://w3router.github.io', 'http://localhost:3000', 'https://eon-protocol.github.io'].includes(origin)) {
        res.header('Access-Control-Allow-Origin', origin);
    }
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Allow-Methods', 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept');
    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }
    next();
});

// 启动服务器
const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server is running on port ${PORT}`);
});

// 数据库连接配置
const DB_HOST = 'junction.proxy.rlwy.net';  // TCP 代理域名
const DB_PORT = '15172';                    // TCP 代理端口
const DB_USER = 'mongo';
const DB_PASS = 'sUgcrMBkbeKekzBDqEQnqfOOCHjDNAbq';
const DB_NAME = 'eonweb';

// 构建连接字符串
const MONGODB_URI = `mongodb://${DB_USER}:${DB_PASS}@${DB_HOST}:${DB_PORT}/${DB_NAME}?authSource=admin`;

console.log('MongoDB connection config:', {
    host: DB_HOST,
    port: DB_PORT,
    database: DB_NAME,
    user: DB_USER,
    uri: MONGODB_URI.replace(new RegExp(`${DB_PASS}`), '****')
});

// 连接选项
const mongooseOptions = {
    serverSelectionTimeoutMS: 30000,
    socketTimeoutMS: 45000,
    maxPoolSize: 10,
    retryWrites: true,
    w: 'majority',
    authSource: 'admin',
    directConnection: true,
    family: 4
};

// 尝试连接
mongoose.connect(MONGODB_URI, mongooseOptions)
.then(() => {
    console.log('Connected to MongoDB');
    initializeData();
})
.catch(err => {
    console.error('MongoDB connection error:', err);
    console.error('Current configuration:', {
        host: DB_HOST,
        port: DB_PORT,
        database: DB_NAME
    });
});

mongoose.connection.on('disconnected', () => {
    console.log('MongoDB disconnected. Attempting to reconnect...');
});

mongoose.connection.on('error', (err) => {
    console.error('MongoDB connection error:', err);
});

mongoose.connection.on('connected', () => {
    console.log('MongoDB connected successfully');
});

// 初始化数据
async function initializeData() {
    try {
        // 检查并创建管理员账户
        const adminEmail = 'info@eon-protocol.com';
        const adminPassword = 'vijTo9-kehmet-cessis';
        
        const existingAdmin = await User.findOne({ email: adminEmail });
        if (!existingAdmin) {
            const hashedPassword = await bcrypt.hash(adminPassword, 10);
            const admin = new User({
                email: adminEmail,
                password: hashedPassword,
                isAdmin: true
            });
            await admin.save();
            console.log('Default admin account created');
        }

        // 初始化默认任务
        await initializeTasks();
    } catch (error) {
        console.error('Error initializing data:', error);
    }
}

// 初始化默认任务
async function initializeTasks() {
    try {
        const defaultTasks = [
            {
                title: 'Bandwidth Sharing',
                description: 'Share bandwidth to support AI data crawling',
                points: 100,
                type: 'daily',
                requirements: 'Stable internet connection',
                isActive: true,
                status: 'Coming Soon'
            },
            {
                title: 'Data Validation',
                description: 'Help validate and improve AI training data quality',
                points: 50,
                type: 'daily',
                requirements: 'Basic understanding of data quality',
                isActive: true,
                status: 'Coming Soon'
            },
            {
                title: 'Referral Program',
                description: 'Invite new users to join EON Protocol. Earn 100 points for each referral when they use your referral code (50 points without referral code). New users also receive 100 points. Daily limit: 10 referrals.',
                points: 100,
                type: 'daily',
                requirements: 'Complete email verification and pass reCAPTCHA verification',
                isActive: true,
                status: 'Active',
                dailyLimit: 10,
                basePoints: 50,
                bonusPoints: 50
            }
        ];

        for (const taskData of defaultTasks) {
            const existingTask = await Task.findOne({ title: taskData.title });
            if (!existingTask) {
                const task = new Task(taskData);
                await task.save();
                console.log(`Default task created: ${taskData.title}`);
            } else {
                await Task.findOneAndUpdate(
                    { title: taskData.title },
                    { $set: taskData },
                    { new: true }
                );
                console.log(`Default task updated: ${taskData.title}`);
            }
        }
    } catch (error) {
        console.error('Error initializing tasks:', error);
    }
}

// 优雅关闭
process.on('SIGTERM', async () => {
    console.log('SIGTERM received. Shutting down gracefully...');
    try {
        await new Promise((resolve) => {
            server.close(resolve);
        });
        console.log('Server closed. Disconnecting from database...');
        await mongoose.connection.close();
        console.log('Database connection closed.');
        process.exit(0);
    } catch (error) {
        console.error('Error during shutdown:', error);
        process.exit(1);
    }
});

// 认证 API 路由
app.post('/api/auth/register', async (req, res) => {
    try {
        const { email, password, referralCode } = req.body;

        // 如果有推荐码，检查推荐任务是否启用
        if (referralCode) {
            const referralTask = await Task.findOne({ title: 'Referral Program' });
            if (!referralTask?.isActive) {
                return res.status(400).json({ message: 'Referral program is currently paused' });
            }
        }

        const userId = await UserService.createUser(email, password, referralCode);
        const user = await User.findById(userId);
        const token = jwt.sign({ userId: user._id, isAdmin: user.isAdmin }, process.env.JWT_SECRET);
        
        res.json({
            message: 'Registration successful',
            token,
            user: {
                email: user.email,
                isAdmin: user.isAdmin,
                points: user.points
            }
        });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(400).json({ message: error.message });
    }
});

// 登录路由
app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        console.log('Login attempt:', { email });
        
        const user = await UserService.verifyUser(email, password);
        if (!user) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        const token = jwt.sign(
            { userId: user.id, isAdmin: user.isAdmin },
            process.env.JWT_SECRET
        );

        res.json({
            token,
            user: {
                email: user.email,
                isAdmin: user.isAdmin,
                points: user.points
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ message: error.message });
    }
});

// 中间件：验证JWT token
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ message: 'Authentication token required' });
    }

    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ message: 'Invalid token' });
        }
        req.user = user;
        next();
    });
};

// 中间件：验证管理员权限
const isAdmin = async (req, res, next) => {
    try {
        const user = await UserService.findById(req.user.userId);
        if (!user || !user.isAdmin) {
            return res.status(403).json({ message: 'Admin privileges required' });
        }
        next();
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// 用户管理路由
app.get('/api/users', authenticateToken, isAdmin, async (req, res) => {
    try {
        const users = await UserService.getAllUsers();
        res.json(users);
    } catch (error) {
        console.error('Error getting users:', error);
        res.status(500).json({ message: error.message });
    }
});

app.get('/api/users/stats', authenticateToken, isAdmin, async (req, res) => {
    try {
        const stats = await UserService.getUserStats();
        res.json(stats);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

app.put('/api/users/:userId', authenticateToken, isAdmin, async (req, res) => {
    try {
        const user = await UserService.updateUser(req.params.userId, req.body);
        res.json(user);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

app.delete('/api/users/:userId', authenticateToken, isAdmin, async (req, res) => {
    try {
        await UserService.deleteUser(req.params.userId);
        res.json({ message: 'User deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// 任务管理路由
app.get('/api/tasks', authenticateToken, async (req, res) => {
    try {
        const tasks = req.user.isAdmin ? 
            await TaskService.getAllTasks() : 
            await TaskService.getAvailableTasks();
        res.json(tasks);
    } catch (error) {
        console.error('Error getting tasks:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

app.post('/api/tasks/:taskId/toggle', authenticateToken, isAdmin, async (req, res) => {
    try {
        const { taskId } = req.params;
        const task = await TaskService.toggleTaskStatus(taskId);
        res.json(task);
    } catch (error) {
        console.error('Error toggling task status:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

app.post('/api/tasks', authenticateToken, isAdmin, async (req, res) => {
    try {
        const taskId = await TaskService.createTask(req.body);
        res.status(201).json({ id: taskId });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

app.put('/api/tasks/:taskId', authenticateToken, isAdmin, async (req, res) => {
    try {
        const success = await TaskService.updateTask(req.params.taskId, req.body);
        if (success) {
            res.json({ message: 'Task updated successfully' });
        } else {
            res.status(404).json({ message: 'Task not found' });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

app.delete('/api/tasks/:taskId', authenticateToken, isAdmin, async (req, res) => {
    try {
        await TaskService.deleteTask(req.params.taskId);
        res.json({ message: 'Task deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

app.get('/api/tasks/:taskId/stats', authenticateToken, isAdmin, async (req, res) => {
    try {
        const stats = await TaskService.getTaskStats(req.params.taskId);
        res.json(stats);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// 用户任务路由
app.post('/api/tasks/:taskId/start', authenticateToken, async (req, res) => {
    try {
        await TaskService.startTask(req.user.userId, req.params.taskId);
        res.json({ message: 'Task started successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

app.post('/api/tasks/:taskId/complete', authenticateToken, async (req, res) => {
    try {
        const { pointsEarned } = req.body;
        await TaskService.completeTask(req.user.userId, req.params.taskId, pointsEarned);
        res.json({ message: 'Task completed successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

app.get('/api/user/tasks', authenticateToken, async (req, res) => {
    try {
        const history = await TaskService.getUserTaskHistory(req.user.userId);
        res.json(history);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// 推荐系统路由
app.get('/api/user/referrals', authenticateToken, async (req, res) => {
    try {
        const referralInfo = await UserService.getUserReferrals(req.user.userId);
        res.json(referralInfo);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// 获取当前用户信息
app.get('/api/user', authenticateToken, async (req, res) => {
    try {
        const user = await UserService.getUserById(req.user.userId);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        res.json(user);
    } catch (error) {
        console.error('Error getting user:', error);
        res.status(500).json({ message: error.message });
    }
});

// 获取用户推荐信息
app.get('/api/users/referral-info', authenticateToken, async (req, res) => {
    try {
        const user = await User.findById(req.user.userId);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // 获取该用户推荐的用户数量
        const totalReferrals = await User.countDocuments({ referredBy: user._id });

        // 获取推荐相关的积分历史
        const referralPoints = await PointHistory.aggregate([
            {
                $match: {
                    userId: user._id,
                    type: 'referral'
                }
            },
            {
                $group: {
                    _id: null,
                    total: { $sum: '$points' }
                }
            }
        ]);

        res.json({
            referralCode: user.referralCode,
            totalReferrals,
            referralPoints: referralPoints[0]?.total || 0
        });
    } catch (error) {
        console.error('Error getting referral info:', error);
        res.status(500).json({ message: 'Error getting referral information' });
    }
});

// 获取推荐任务状态
app.get('/api/tasks/referral/status', async (req, res) => {
    try {
        const referralTask = await Task.findOne({ title: 'Referral Program' });
        res.json({ isActive: referralTask ? referralTask.isActive : false });
    } catch (error) {
        console.error('Error getting referral task status:', error);
        res.status(500).json({ message: 'Error getting referral task status' });
    }
});

// 切换任务状态（需要管理员权限）
app.put('/api/tasks/:taskId/toggle', authenticateToken, isAdmin, async (req, res) => {
    try {
        const task = await Task.findById(req.params.taskId);
        if (!task) {
            return res.status(404).json({ message: 'Task not found' });
        }

        // 切换状态
        task.isActive = !task.isActive;
        await task.save();

        res.json({ message: 'Task status updated', task });
    } catch (error) {
        console.error('Error toggling task status:', error);
        res.status(500).json({ message: 'Error updating task status' });
    }
});

// 全局错误处理中间件
app.use((err, req, res, next) => {
    console.error('Global error handler:', err);
    res.status(500).json({ 
        message: err.message || 'Internal server error',
        stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
});