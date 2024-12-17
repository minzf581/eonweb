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
function gracefulShutdown(signal) {
    console.log(`\n${signal} received. Starting graceful shutdown...`);
    
    if (server) {
        server.close(() => {
            console.log('HTTP server closed');
            
            // 设置一个更长的超时时间来等待现有连接完成
            const closeTimeout = setTimeout(() => {
                console.error('Could not close MongoDB connection in time, forcefully shutting down');
                process.exit(1);
            }, 10000);

            mongoose.connection.close(false)
                .then(() => {
                    console.log('MongoDB connection closed gracefully');
                    clearTimeout(closeTimeout);
                    process.exit(0);
                })
                .catch(err => {
                    console.error('Error closing MongoDB connection:', err);
                    clearTimeout(closeTimeout);
                    process.exit(1);
                });
        });

        // 停止接受新的请求
        server.unref();
    } else {
        console.log('No server instance found, exiting...');
        process.exit(0);
    }
}

// 信号处理
['SIGTERM', 'SIGINT', 'SIGUSR2'].forEach(signal => {
    process.on(signal, () => gracefulShutdown(signal));
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

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
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

// 静态文件服务
app.use('/public', express.static(path.join(__dirname, 'public'), {
    maxAge: '1d',
    etag: true,
    lastModified: true
}));

// 处理 /public 路径下的 404
app.use('/public/*', (req, res) => {
    res.status(404).sendFile(path.join(__dirname, '404.html'));
});

// 所有其他路由都返回 index.html
app.get('*', (req, res) => {
    if (!req.path.startsWith('/public/')) {
        res.sendFile(path.join(__dirname, 'index.html'));
    }
});

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