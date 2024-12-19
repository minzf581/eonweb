import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import path from 'path';
import cookieParser from 'cookie-parser';
import compression from 'compression';
import dotenv from 'dotenv';
import crypto from 'crypto';

// Initialize dotenv
dotenv.config();

// ES modules compatibility for __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
let server = null;

// 环境变量配置
const config = {
    cors: {
        enabled: process.env.CORS_ENABLED !== 'false',
        allowedOrigins: process.env.NODE_ENV === 'production' 
            ? ['https://eonweb-production.up.railway.app']
            : ['http://localhost:3000', 'http://localhost:8080']
    },
    server: {
        env: process.env.NODE_ENV || 'development',
        port: process.env.PORT || 8080,
        host: process.env.HOST || '0.0.0.0'
    },
    jwt: {
        secret: process.env.JWT_SECRET || (process.env.NODE_ENV !== 'production' 
            ? 'default-development-secret-key-do-not-use-in-production'
            : null)
    },
    mongodb: {
        uri: process.env.MONGODB_URI || (process.env.NODE_ENV !== 'production'
            ? 'mongodb://localhost:27017/eon-protocol'
            : null)
    }
};

// 验证生产环境配置
if (config.server.env === 'production') {
    const missingVars = [];
    if (!config.mongodb.uri) missingVars.push('MONGODB_URI');
    if (!config.jwt.secret) missingVars.push('JWT_SECRET');
    
    if (missingVars.length > 0) {
        console.error(`Fatal: Missing required environment variables: ${missingVars.join(', ')}`);
        process.exit(1);
    }
}

// 进程错误处理
process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    gracefulShutdown('UNCAUGHT_EXCEPTION');
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    gracefulShutdown('UNHANDLED_REJECTION');
});

// 优雅关闭函数
async function gracefulShutdown(signal) {
    console.log(`\n${signal} received. Starting graceful shutdown...`);
    let exitCode = 0;

    try {
        // 设置关闭超时
        const shutdownTimeout = setTimeout(() => {
            console.error('Graceful shutdown timed out, forcing exit');
            process.exit(1);
        }, 15000); // 15 秒超时

        if (server) {
            // 停止接受新的连接
            console.log('Closing HTTP server...');
            await new Promise((resolve, reject) => {
                server.close((err) => {
                    if (err) {
                        console.error('Error closing HTTP server:', err);
                        reject(err);
                    } else {
                        console.log('HTTP server closed successfully');
                        resolve();
                    }
                });
            });
        }

        if (mongoose.connection.readyState !== 0) {
            // 关闭数据库连接
            console.log('Closing MongoDB connection...');
            await mongoose.connection.close(false);
            console.log('MongoDB connection closed successfully');
        }

        // 清除超时
        clearTimeout(shutdownTimeout);
    } catch (error) {
        console.error('Error during graceful shutdown:', error);
        exitCode = 1;
    } finally {
        console.log(`Graceful shutdown completed with exit code: ${exitCode}`);
        process.exit(exitCode);
    }
}

// 信号处理
const signals = ['SIGTERM', 'SIGINT', 'SIGUSR2'];
let shuttingDown = false;

signals.forEach(signal => {
    process.on(signal, async () => {
        // 防止多次触发关闭
        if (shuttingDown) {
            console.log('Shutdown already in progress...');
            return;
        }
        shuttingDown = true;
        await gracefulShutdown(signal);
    });
});

// 打印配置信息（隐藏敏感信息）
console.log('\n=== Server Configuration ===');
console.log('Environment:', config.server.env);
console.log('Server URL:', `http://${config.server.host}:${config.server.port}`);
console.log('CORS:', {
    enabled: config.cors.enabled,
    allowedOrigins: config.cors.allowedOrigins
});
console.log('MongoDB:', 'Connected');
console.log('JWT:', 'Configured');
console.log('===========================\n');

// 健康检查路由 - 必须在其他中间件之前
app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: config.server.env
    });
});

// 启用压缩
app.use(compression());

// 中间件配置
app.use(cors({
    origin: function(origin, callback) {
        // 允许同源请求（没有 origin）
        if (!origin) {
            return callback(null, true);
        }
        
        // 检查是否在允许列表中
        if (config.cors.enabled && config.cors.allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    exposedHeaders: ['Set-Cookie'],
    maxAge: 86400
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// 请求日志中间件
app.use((req, res, next) => {
    console.log('\n=== Incoming Request ===');
    console.log('Time:', new Date().toISOString());
    console.log('Method:', req.method);
    console.log('Path:', req.path);
    console.log('Origin:', req.headers.origin);
    console.log('Headers:', req.headers);
    next();
});

// 静态文件服务
app.use(express.static(path.join(__dirname, 'public')));

// 首页路由
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/index.html'));
});

// 处理其他页面路由
app.get(['/dashboard', '/dashboard/index.html'], (req, res) => {
    res.sendFile(path.join(__dirname, 'public/dashboard/index.html'));
});

app.get(['/auth/login', '/auth/login.html'], (req, res) => {
    res.sendFile(path.join(__dirname, 'public/auth/login.html'));
});

app.get('/auth/register', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/auth/register.html'));
});

// 所有其他路由都返回 index.html
app.get('*', (req, res) => {
    if (!req.path.startsWith('/api/')) {
        res.sendFile(path.join(__dirname, 'public/index.html'));
    }
});

// 处理 /public 路径下的 404
app.use('/public/*', (req, res) => {
    res.status(404).sendFile(path.join(__dirname, '404.html'));
});

// 404 处理
app.use((req, res, next) => {
    console.log('404 Not Found:', req.path);
    res.status(404).send('404 Not Found');
});

// 错误处理中间件
app.use((err, req, res, next) => {
    console.error('Error:', err);
    if (err.name === 'UnauthorizedError') {
        res.status(401).json({ message: 'Invalid token' });
    } else if (err.message === 'Not allowed by CORS') {
        res.status(403).json({ message: 'CORS not allowed' });
    } else {
        res.status(500).json({ message: 'Internal server error' });
    }
});

// MongoDB 连接选项
const mongooseOptions = {
    serverSelectionTimeoutMS: 30000,
    socketTimeoutMS: 45000,
    family: 4,
    maxPoolSize: 10,
    minPoolSize: 2,
    connectTimeoutMS: 10000,
    retryWrites: true,
    retryReads: true,
    heartbeatFrequencyMS: 10000
};

// 处理未捕获的异常和拒绝
process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    gracefulShutdown('UNCAUGHT_EXCEPTION');
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    gracefulShutdown('UNHANDLED_REJECTION');
});

// MongoDB 连接
mongoose.connect(config.mongodb.uri, mongooseOptions)
    .then(() => {
        console.log('Successfully connected to MongoDB');
        
        // 启动服务器
        server = app.listen(config.server.port, config.server.host, () => {
            console.log(`Server is running on http://${config.server.host}:${config.server.port}`);
            console.log('Server is ready to accept requests');
        });

        // 处理服务器错误
        server.on('error', (error) => {
            console.error('Server error:', error);
            gracefulShutdown('SERVER_ERROR');
        });

        // 处理 MongoDB 连接错误
        mongoose.connection.on('error', (error) => {
            console.error('MongoDB connection error:', error);
            if (!server.listening) {
                gracefulShutdown('MONGODB_ERROR');
            }
        });

        mongoose.connection.on('disconnected', () => {
            console.log('MongoDB disconnected. Attempting to reconnect...');
            if (!server.listening) {
                return gracefulShutdown('MONGODB_DISCONNECT');
            }
            
            // 尝试重新连接
            setTimeout(() => {
                mongoose.connect(config.mongodb.uri, mongooseOptions).catch(err => {
                    console.error('MongoDB reconnection failed:', err);
                    if (!server.listening) {
                        gracefulShutdown('MONGODB_RECONNECT_FAILED');
                    }
                });
            }, 5000);
        });
    })
    .catch((error) => {
        console.error('MongoDB initial connection error:', error);
        process.exit(1);
    });

// 身份验证中间件
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ message: 'No token provided' });
    }

    jwt.verify(token, config.jwt.secret, (err, user) => {
        if (err) {
            return res.status(403).json({ message: 'Invalid token' });
        }
        req.user = user;
        next();
    });
};

// 管理员权限中间件
const isAdmin = (req, res, next) => {
    if (!req.user || !req.user.isAdmin) {
        return res.status(403).json({ message: 'Admin access required' });
    }
    next();
};

// 用户模型
const userSchema = new mongoose.Schema({
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    isAdmin: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now },
    referralCode: { type: String, unique: true },
    referredBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    points: { type: Number, default: 0 }
});

const User = mongoose.model('User', userSchema);

// 任务模型
const taskSchema = new mongoose.Schema({
    name: { type: String, required: true },
    description: { type: String },
    points: { type: Number, required: true },
    type: { type: String, required: true },
    createdAt: { type: Date, default: Date.now }
});

const Task = mongoose.model('Task', taskSchema);

// 用户任务模型
const userTaskSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    taskId: { type: mongoose.Schema.Types.ObjectId, ref: 'Task', required: true },
    completed: { type: Boolean, default: false },
    completedAt: { type: Date },
    createdAt: { type: Date, default: Date.now }
});

const UserTask = mongoose.model('UserTask', userTaskSchema);

// API 路由
app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        
        // 查找用户
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(401).json({ message: 'Invalid email or password' });
        }

        // 验证密码
        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
            return res.status(401).json({ message: 'Invalid email or password' });
        }

        // 设置管理员权限
        if (email === 'info@eon-protocol.com') {
            user.isAdmin = true;
            await user.save();
        }

        // 生成 token
        const token = jwt.sign(
            { userId: user._id, email: user.email, isAdmin: user.isAdmin },
            config.jwt.secret,
            { expiresIn: '24h' }
        );

        res.json({
            token,
            user: {
                email: user.email,
                isAdmin: user.isAdmin
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

app.get('/api/user', authenticateToken, async (req, res) => {
    try {
        const user = await User.findById(req.user.userId).select('-password');
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        res.json(user);
    } catch (error) {
        console.error('Get user error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// 获取用户任务
app.get('/api/tasks/user', authenticateToken, async (req, res) => {
    try {
        const userTasks = await UserTask.find({ userId: req.user.userId })
            .populate('taskId')
            .exec();

        const tasks = userTasks.map(ut => ({
            id: ut.taskId._id,
            name: ut.taskId.name,
            description: ut.taskId.description,
            points: ut.taskId.points,
            completed: ut.completed,
            completedAt: ut.completedAt
        }));

        res.json({ tasks });
    } catch (error) {
        console.error('Error getting user tasks:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// 获取用户统计信息
app.get('/api/users/stats', authenticateToken, async (req, res) => {
    try {
        const userTasks = await UserTask.find({ userId: req.user.userId });
        const completedTasks = userTasks.filter(t => t.completed).length;
        const user = await User.findById(req.user.userId);

        res.json({
            totalTasks: userTasks.length,
            completedTasks,
            earnedPoints: user.points || 0
        });
    } catch (error) {
        console.error('Error getting user stats:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// 获取推荐信息
app.get('/api/users/referral-info', authenticateToken, async (req, res) => {
    try {
        const user = await User.findById(req.user.userId);
        const referrals = await User.countDocuments({ referredBy: user._id });

        res.json({
            referralCode: user.referralCode,
            referralCount: referrals,
            totalPoints: user.points
        });
    } catch (error) {
        console.error('Error getting referral info:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// 验证 token
app.get('/api/auth/verify', authenticateToken, (req, res) => {
    res.json({ valid: true });
});

app.post('/api/auth/register', async (req, res) => {
    try {
        const { email, password, referralCode } = req.body;

        // 检查邮箱是否已存在
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ message: 'Email already exists' });
        }

        // 生成唯一的推荐码
        const newReferralCode = crypto.randomBytes(4).toString('hex');

        // 创建新用户
        const hashedPassword = await bcrypt.hash(password, 10);
        const user = new User({
            email,
            password: hashedPassword,
            referralCode: newReferralCode
        });

        // 如果提供了推荐码，查找推荐人
        if (referralCode) {
            const referrer = await User.findOne({ referralCode });
            if (referrer) {
                user.referredBy = referrer._id;
                // 给推荐人加积分
                referrer.points += 100;
                await referrer.save();
            }
        }

        await user.save();

        // 生成 token
        const token = jwt.sign(
            { userId: user._id, email: user.email, isAdmin: user.isAdmin },
            config.jwt.secret,
            { expiresIn: '24h' }
        );

        res.status(201).json({
            token,
            user: {
                email: user.email,
                isAdmin: user.isAdmin,
                referralCode: user.referralCode
            }
        });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// 获取用户的推荐信息
app.get('/api/referral', authenticateToken, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        const referralCount = await User.countDocuments({ referredBy: user._id });
        
        res.json({
            referralCode: user.referralCode,
            referralCount,
            points: user.points
        });
    } catch (error) {
        console.error('Error fetching referral info:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// 获取用户的推荐列表
app.get('/api/referral/list', authenticateToken, async (req, res) => {
    try {
        const referrals = await User.find({ referredBy: req.user.id })
            .select('email createdAt')
            .sort({ createdAt: -1 });
        
        res.json(referrals);
    } catch (error) {
        console.error('Error fetching referral list:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// 获取用户统计信息
app.get('/api/stats', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        
        // 获取用户信息
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        
        // 获取任务统计
        const completedTasks = await UserTask.countDocuments({ 
            userId: userId,
            completed: true 
        });
        
        const activeTasks = await UserTask.countDocuments({ 
            userId: userId,
            completed: false 
        });
        
        res.json({
            points: user.points || 0,
            completedTasks,
            activeTasks
        });
    } catch (error) {
        console.error('Error fetching stats:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// 获取任务列表
app.get('/api/tasks', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        
        // 获取所有任务
        const tasks = await Task.find();
        
        // 获取用户的任务状态
        const userTasks = await UserTask.find({ userId });
        
        // 合并任务信息和状态
        const tasksWithStatus = tasks.map(task => {
            const userTask = userTasks.find(ut => ut.taskId.toString() === task._id.toString());
            return {
                id: task._id,
                name: task.name,
                description: task.description,
                points: task.points,
                type: task.type,
                status: userTask ? (userTask.completed ? 'completed' : 'in_progress') : 'available'
            };
        });
        
        res.json(tasksWithStatus);
    } catch (error) {
        console.error('Error fetching tasks:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// 开始任务
app.post('/api/tasks/:taskId/start', authenticateToken, async (req, res) => {
    try {
        const { taskId } = req.params;
        const userId = req.user.id;
        
        // 检查任务是否存在
        const task = await Task.findById(taskId);
        if (!task) {
            return res.status(404).json({ message: 'Task not found' });
        }
        
        // 检查用户是否已经开始或完成了这个任务
        let userTask = await UserTask.findOne({ userId, taskId });
        if (userTask) {
            return res.status(400).json({ message: 'Task already started or completed' });
        }
        
        // 创建新的用户任务
        userTask = new UserTask({
            userId,
            taskId,
            completed: false
        });
        
        await userTask.save();
        res.json({ message: 'Task started successfully' });
    } catch (error) {
        console.error('Error starting task:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// 完成任务
app.post('/api/tasks/:taskId/complete', authenticateToken, async (req, res) => {
    try {
        const { taskId } = req.params;
        const userId = req.user.id;
        
        // 检查任务是否存在
        const task = await Task.findById(taskId);
        if (!task) {
            return res.status(404).json({ message: 'Task not found' });
        }
        
        // 检查用户是否已经开始了这个任务
        const userTask = await UserTask.findOne({ userId, taskId });
        if (!userTask) {
            return res.status(400).json({ message: 'Task not started' });
        }
        
        if (userTask.completed) {
            return res.status(400).json({ message: 'Task already completed' });
        }
        
        // 更新任务状态
        userTask.completed = true;
        userTask.completedAt = new Date();
        await userTask.save();
        
        // 更新用户积分
        const user = await User.findById(userId);
        user.points += task.points;
        await user.save();
        
        res.json({ 
            message: 'Task completed successfully',
            pointsEarned: task.points
        });
    } catch (error) {
        console.error('Error completing task:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});