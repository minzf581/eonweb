import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import bcryptjs from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import cookieParser from 'cookie-parser';
import compression from 'compression';
import * as dotenv from 'dotenv';
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
        host: process.env.HOST || '0.0.0.0',
        shutdownTimeout: 30000, // 30 seconds
        keepAliveTimeout: 65000 // slightly higher than ALB's idle timeout
    },
    jwt: {
        secret: process.env.JWT_SECRET || (process.env.NODE_ENV !== 'production' 
            ? 'default-development-secret-key-do-not-use-in-production'
            : null)
    },
    mongodb: {
        uri: process.env.MONGODB_URI || (process.env.NODE_ENV !== 'production'
            ? 'mongodb://localhost:27017/eon-protocol'
            : null),
        options: {
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 45000,
            maxPoolSize: 10,
            minPoolSize: 2,
            maxIdleTimeMS: 30000,
            connectTimeoutMS: 10000,
            heartbeatFrequencyMS: 10000,
            retryWrites: true,
            w: 'majority'
        }
    }
};

// 监控内存使用
function checkMemoryUsage() {
    const used = process.memoryUsage();
    const memoryInfo = {
        rss: `${Math.round(used.rss / 1024 / 1024)} MB`,
        heapTotal: `${Math.round(used.heapTotal / 1024 / 1024)} MB`,
        heapUsed: `${Math.round(used.heapUsed / 1024 / 1024)} MB`,
        external: `${Math.round(used.external / 1024 / 1024)} MB`
    };
    
    console.log('Memory usage:', memoryInfo);
    
    // 只在堆内存使用超过 95% 时触发垃圾回收
    const heapUsedPercent = used.heapUsed / used.heapTotal * 100;
    if (heapUsedPercent > 95) {
        console.log('Memory usage high, triggering garbage collection');
        if (global.gc) {
            global.gc();
        }
    }
}

// 定期检查内存使用
setInterval(checkMemoryUsage, 60000); // 每分钟检查一次

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
    // 不立即关闭，只记录日志
});

// 优雅关闭函数
async function gracefulShutdown(signal) {
    if (shuttingDown) {
        console.log('Shutdown already in progress');
        return;
    }
    
    shuttingDown = true;
    console.log(`\n${signal} received. Starting graceful shutdown...`);
    let exitCode = 0;

    try {
        // 设置关闭超时
        const shutdownTimeout = setTimeout(() => {
            console.error('Graceful shutdown timed out, forcing exit');
            process.exit(1);
        }, config.server.shutdownTimeout);

        // 停止接受新的连接
        if (server) {
            console.log('Stopping new connections...');
            server.unref();
            
            // 等待现有连接完成
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

        // 关闭数据库连接
        if (mongoose.connection.readyState !== 0) {
            console.log('Closing MongoDB connection...');
            await mongoose.connection.close(false);
            console.log('MongoDB connection closed successfully');
        }

        // 清理资源
        clearTimeout(shutdownTimeout);
        
        // 触发垃圾回收
        if (global.gc) {
            console.log('Triggering final garbage collection...');
            global.gc();
        }
        
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

// 健康检查端点
const apiRouter = express.Router();

apiRouter.get('/health', (req, res) => {
    const used = process.memoryUsage();
    const healthCheck = {
        uptime: process.uptime(),
        status: 'OK',
        timestamp: new Date().toISOString(),
        memory: {
            rss: `${Math.round(used.rss / 1024 / 1024)} MB`,
            heapTotal: `${Math.round(used.heapTotal / 1024 / 1024)} MB`,
            heapUsed: `${Math.round(used.heapUsed / 1024 / 1024)} MB`
        },
        mongodb: {
            status: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
            connections: mongoose.connection.states
        }
    };

    try {
        // 检查数据库连接
        if (mongoose.connection.readyState !== 1) {
            throw new Error('Database not connected');
        }

        // 检查内存使用
        const heapUsedPercent = used.heapUsed / used.heapTotal * 100;
        if (heapUsedPercent > 95) {
            healthCheck.status = 'WARNING';
            healthCheck.warning = 'High memory usage';
        }

        res.json(healthCheck);
    } catch (error) {
        healthCheck.status = 'ERROR';
        healthCheck.error = error.message;
        res.status(503).json(healthCheck);
    }
});

// API 根路径处理
apiRouter.get('/', (req, res) => {
    res.json({
        message: 'API is running',
        version: '1.0.0',
        timestamp: new Date().toISOString()
    });
});

// 启用压缩
app.use(compression());

// 配置 Express
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(cookieParser());

// 配置 CORS
if (config.cors.enabled) {
    app.use(cors({
        origin: (origin, callback) => {
            if (!origin || config.cors.allowedOrigins.includes(origin)) {
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
}

// 请求日志中间件
app.use((req, res, next) => {
    const startTime = Date.now();
    console.log('\n=== Incoming Request ===');
    console.log('Time:', new Date().toISOString());
    console.log('Method:', req.method);
    console.log('Path:', req.path);
    console.log('Query:', req.query);
    console.log('Body:', req.body);
    console.log('Headers:', req.headers);
    console.log('MongoDB Status:', mongoose.connection.readyState);
    console.log('Base URL:', req.baseUrl);

    // 添加响应完成后的日志
    res.on('finish', () => {
        const duration = Date.now() - startTime;
        console.log('\n=== Response Completed ===');
        console.log('Time:', new Date().toISOString());
        console.log('Duration:', duration, 'ms');
        console.log('Status:', res.statusCode);
        console.log('Headers:', res.getHeaders());
    });

    next();
});

// 静态文件服务
app.use(express.static(join(__dirname, 'public')));

// 首页路由
app.get('/', (req, res) => {
    res.sendFile(join(__dirname, 'public/index.html'));
});

// 处理其他页面路由
app.get(['/dashboard', '/dashboard/index.html'], (req, res) => {
    res.sendFile(join(__dirname, 'public/dashboard/index.html'));
});

app.get(['/auth/login', '/auth/login.html'], (req, res) => {
    res.sendFile(join(__dirname, 'public/auth/login.html'));
});

app.get('/auth/register', (req, res) => {
    res.sendFile(join(__dirname, 'public/auth/register.html'));
});

// 所有其他路由都返回 index.html
app.get('*', (req, res) => {
    if (!req.path.startsWith('/api/')) {
        res.sendFile(join(__dirname, 'public/index.html'));
    }
});

// 处理 /public 路径下的 404
app.use('/public/*', (req, res) => {
    res.status(404).sendFile(join(__dirname, '404.html'));
});

// 404 处理
app.use((req, res, next) => {
    console.log('404 Not Found:', req.path);
    res.status(404).send('404 Not Found');
});

// 错误处理中间件
app.use((err, req, res, next) => {
    console.error('Global error handler:', err);
    if (err.name === 'UnauthorizedError') {
        return res.status(401).json({ error: 'Invalid token' });
    }
    if (err.name === 'ValidationError') {
        return res.status(400).json({ error: err.message });
    }
    res.status(500).json({ error: 'Internal server error' });
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
    // 不立即关闭，只记录日志
});

// MongoDB 连接
console.log('Connecting to MongoDB...');
console.log('MongoDB URI:', config.mongodb.uri);
console.log('MongoDB Options:', JSON.stringify(config.mongodb.options, null, 2));

mongoose.connect(config.mongodb.uri, config.mongodb.options)
    .then(() => {
        console.log('Successfully connected to MongoDB');
        console.log('Connection state:', mongoose.connection.readyState);
        console.log('Database name:', mongoose.connection.name);
        
        // 测试数据库连接
        return mongoose.connection.db.admin().ping();
    })
    .then(() => {
        console.log('Database ping successful');
        return mongoose.connection.db.listCollections().toArray();
    })
    .then(collections => {
        console.log('Available collections:', collections.map(c => c.name));
        
        // 启动服务器
        async function startServer() {
            try {
                // 启动 HTTP 服务器
                server = app.listen(config.server.port, config.server.host, () => {
                    console.log(`Server is running on http://${config.server.host}:${config.server.port}`);
                    console.log('Server is ready to accept requests');
                });

                // 配置服务器超时
                server.keepAliveTimeout = config.server.keepAliveTimeout;
                server.headersTimeout = config.server.keepAliveTimeout + 1000;

                // 处理未捕获的异常
                process.on('uncaughtException', (error) => {
                    console.error('Uncaught Exception:', error);
                    gracefulShutdown('UNCAUGHT_EXCEPTION');
                });

                process.on('unhandledRejection', (reason, promise) => {
                    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
                });

            } catch (error) {
                console.error('Failed to start server:', error);
                process.exit(1);
            }
        }

        startServer();

        // 处理服务器错误
        server.on('error', (error) => {
            console.error('Server error:', error);
            if (error.code === 'EADDRINUSE') {
                console.error(`Port ${config.server.port} is already in use`);
                process.exit(1);
            }
        });

        // MongoDB 错误处理
        mongoose.connection.on('error', (error) => {
            console.error('MongoDB connection error:', error);
            if (!server.listening) {
                process.exit(1);
            }
        });

        mongoose.connection.on('disconnected', () => {
            console.log('MongoDB disconnected. Attempting to reconnect...');
            
            // 尝试重新连接
            setTimeout(() => {
                mongoose.connect(config.mongodb.uri, config.mongodb.options).catch(err => {
                    console.error('MongoDB reconnection failed:', err);
                    if (!server.listening) {
                        gracefulShutdown('MONGODB_RECONNECT_FAILED');
                    }
                });
            }, 5000); // 5秒后重试
        });
    })
    .catch((error) => {
        console.error('MongoDB initial connection error:', error);
        process.exit(1);
    });

// API 路由
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

// 添加模型事件监听器
userSchema.post('save', function(doc) {
    console.log('User saved:', doc.email);
});

userSchema.post('findOne', function(doc) {
    console.log('User found:', doc ? doc.email : 'not found');
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

// 登录路由
apiRouter.post('/auth/login', async (req, res) => {
    console.log('\n=== Login Request ===');
    console.log('Request Body:', req.body);
    
    try {
        const { email, password } = req.body;

        // 验证请求数据
        if (!email || !password) {
            console.log('Login failed: Missing email or password');
            return res.status(400).json({ error: 'Email and password are required' });
        }

        console.log('Checking database connection...');
        if (mongoose.connection.readyState !== 1) {
            console.error('Database not connected. Current state:', mongoose.connection.readyState);
            return res.status(503).json({ error: 'Database connection error' });
        }

        console.log('Finding user with email:', email);
        const user = await User.findOne({ email });
        
        if (!user) {
            console.log('Login failed: User not found');
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        console.log('User found, comparing passwords...');
        const validPassword = await bcryptjs.compare(password, user.password);
        
        if (!validPassword) {
            console.log('Login failed: Invalid password');
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        console.log('Password valid, generating token...');
        const token = jwt.sign(
            { id: user._id, email: user.email },
            config.jwt.secret,
            { expiresIn: '24h' }
        );

        console.log('Login successful for user:', email);
        res.json({
            token,
            user: {
                id: user._id,
                email: user.email
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Internal server error during login' });
    }
});

// 挂载 API 路由
app.use('/api', apiRouter);

// 获取用户信息
apiRouter.get('/user', authenticateToken, async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('-password');
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
apiRouter.get('/tasks/user', authenticateToken, async (req, res) => {
    try {
        const userTasks = await UserTask.find({ userId: req.user.id })
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
apiRouter.get('/users/stats', authenticateToken, async (req, res) => {
    try {
        const userTasks = await UserTask.find({ userId: req.user.id });
        const completedTasks = userTasks.filter(t => t.completed).length;
        const user = await User.findById(req.user.id);

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
apiRouter.get('/users/referral-info', authenticateToken, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
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
apiRouter.get('/auth/verify', authenticateToken, (req, res) => {
    res.json({ valid: true });
});

apiRouter.post('/auth/register', async (req, res) => {
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
        const hashedPassword = await bcryptjs.hash(password, 10);
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
            { id: user._id, email: user.email },
            config.jwt.secret,
            { expiresIn: '24h' }
        );

        res.status(201).json({
            token,
            user: {
                id: user._id,
                email: user.email,
                referralCode: user.referralCode
            }
        });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// 获取用户的推荐信息
apiRouter.get('/referral', authenticateToken, async (req, res) => {
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
apiRouter.get('/referral/list', authenticateToken, async (req, res) => {
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
apiRouter.get('/stats', authenticateToken, async (req, res) => {
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
apiRouter.get('/tasks', authenticateToken, async (req, res) => {
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
apiRouter.post('/tasks/:taskId/start', authenticateToken, async (req, res) => {
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
apiRouter.post('/tasks/:taskId/complete', authenticateToken, async (req, res) => {
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