// 导入依赖
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const bcryptjs = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
const cookieParser = require('cookie-parser');
const compression = require('compression');
const crypto = require('crypto');
const dotenv = require('dotenv');
const { join } = require('path');

// Initialize dotenv
dotenv.config();

// 中间件函数
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'No token provided' });
    }

    jwt.verify(token, config.jwt.secret, (err, user) => {
        if (err) {
            console.error('Token verification failed:', err);
            return res.status(403).json({ error: 'Invalid token' });
        }
        req.user = user;
        next();
    });
};

const isAdmin = (req, res, next) => {
    if (!req.user || !req.user.isAdmin) {
        return res.status(403).json({ error: 'Admin access required' });
    }
    next();
};

// 生成推荐码
function generateReferralCode() {
    return crypto.randomBytes(4).toString('hex').toUpperCase();
}

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
            useNewUrlParser: true,
            useUnifiedTopology: true
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

// 进程管理
process.on('SIGTERM', () => {
    console.log('Received SIGTERM signal. Starting graceful shutdown...');
    gracefulShutdown();
});

process.on('SIGINT', () => {
    console.log('Received SIGINT signal. Starting graceful shutdown...');
    gracefulShutdown();
});

// 优雅关闭函数
async function gracefulShutdown() {
    console.log('Starting graceful shutdown...');
    
    try {
        // 关闭数据库连接
        if (mongoose.connection.readyState === 1) {
            console.log('Closing MongoDB connection...');
            await mongoose.connection.close();
            console.log('MongoDB connection closed');
        }

        // 关闭服务器
        if (server) {
            console.log('Closing HTTP server...');
            await new Promise((resolve) => {
                server.close(resolve);
            });
            console.log('HTTP server closed');
        }

        console.log('Graceful shutdown completed');
        process.exit(0);
    } catch (error) {
        console.error('Error during shutdown:', error);
        process.exit(1);
    }
}

// 内存监控
const memoryMonitor = setInterval(() => {
    const used = process.memoryUsage();
    const usage = {
        rss: `${Math.round(used.rss / 1024 / 1024)} MB`,
        heapTotal: `${Math.round(used.heapTotal / 1024 / 1024)} MB`,
        heapUsed: `${Math.round(used.heapUsed / 1024 / 1024)} MB`,
        external: `${Math.round(used.external / 1024 / 1024)} MB`
    };

    // 如果内存使用超过阈值，记录警告
    if (used.heapUsed > 500 * 1024 * 1024) { // 500MB
        console.warn('High memory usage detected:', usage);
        global.gc && global.gc(); // 如果启用了 --expose-gc，触发垃圾回收
    }

    console.log('Memory usage:', usage);
}, 60000); // 每分钟检查一次

// 清理定时器
process.on('exit', () => {
    clearInterval(memoryMonitor);
});

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

// 配置中间件
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(cookieParser());
app.use(compression());

// CORS 配置
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
}));

// 请求日志
app.use((req, res, next) => {
    console.log(`\n=== ${new Date().toISOString()} ===`);
    console.log(`${req.method} ${req.path}`);
    console.log('Headers:', req.headers);
    if (req.body && Object.keys(req.body).length > 0) {
        console.log('Body:', req.body);
    }
    next();
});

// 初始化路由
const apiRouter = express.Router();
const authRouter = express.Router();
const userRouter = express.Router();
const taskRouter = express.Router();
const adminRouter = express.Router();

// 数据库连接
mongoose.connect(config.mongodb.uri, {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(() => {
    console.log('MongoDB connected successfully');
}).catch(err => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
});

mongoose.connection.on('error', err => {
    console.error('MongoDB error:', err);
});

// 用户模型
const userSchema = new mongoose.Schema({
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    isAdmin: { type: Boolean, default: false },
    points: { type: Number, default: 0 },
    referralCode: { type: String, unique: true },
    referredBy: { type: String },
    createdAt: { type: Date, default: Date.now }
});

// 在保存前生成推荐码
userSchema.pre('save', async function(next) {
    if (!this.referralCode) {
        let code;
        let isUnique = false;
        
        // 生成唯一的推荐码
        while (!isUnique) {
            code = generateReferralCode();
            const existingUser = await User.findOne({ referralCode: code });
            if (!existingUser) {
                isUnique = true;
            }
        }
        
        this.referralCode = code;
    }
    next();
});

const User = mongoose.model('User', userSchema);

// 任务模型
const taskSchema = new mongoose.Schema({
    title: { type: String, required: true },
    description: { type: String },
    points: { type: Number, default: 0 },
    createdAt: { type: Date, default: Date.now }
});

const Task = mongoose.model('Task', taskSchema);

// 用户任务模型
const userTaskSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    taskId: { type: mongoose.Schema.Types.ObjectId, ref: 'Task', required: true },
    completed: { type: Boolean, default: false },
    startTime: { type: Date },
    completionTime: { type: Date },
    createdAt: { type: Date, default: Date.now }
});

const UserTask = mongoose.model('UserTask', userTaskSchema);

// 认证路由
authRouter.post('/login', async (req, res) => {
    console.log('\n=== Login Request ===');
    console.log('Request Body:', req.body);
    
    try {
        const { email, password } = req.body;

        // 验证请求数据
        if (!email || !password) {
            console.log('Login failed: Missing email or password');
            return res.status(400).json({ error: 'Email and password are required' });
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

        // 设置管理员权限
        if (email === 'info@eon-protocol.com') {
            user.isAdmin = true;
            await user.save();
            console.log('Updated user admin status:', user.isAdmin);
        }

        console.log('Password valid, generating token...');
        const token = jwt.sign(
            { 
                id: user._id, 
                email: user.email,
                isAdmin: user.isAdmin 
            },
            config.jwt.secret,
            { expiresIn: '24h' }
        );

        console.log('Login successful for user:', {
            email: user.email,
            isAdmin: user.isAdmin
        });

        res.json({
            token,
            user: {
                id: user._id,
                email: user.email,
                isAdmin: user.isAdmin
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Internal server error during login' });
    }
});

// 管理员路由
adminRouter.get('/users', authenticateToken, isAdmin, async (req, res) => {
    try {
        const users = await User.find().select('-password');
        res.json(users);
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({ error: 'Failed to fetch users' });
    }
});

adminRouter.get('/stats', authenticateToken, isAdmin, async (req, res) => {
    try {
        const totalUsers = await User.countDocuments();
        const totalTasks = await Task.countDocuments();
        const completedTasks = await UserTask.countDocuments({ completed: true });
        
        res.json({
            totalUsers,
            totalTasks,
            completedTasks
        });
    } catch (error) {
        console.error('Error fetching admin stats:', error);
        res.status(500).json({ error: 'Failed to fetch admin stats' });
    }
});

// 用户路由
userRouter.get('/me', authenticateToken, async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('-password');
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // 获取推荐信息
        const referrals = await User.find({ referredBy: user.referralCode })
            .select('email createdAt')
            .sort('-createdAt');

        res.json({
            ...user.toObject(),
            referrals: referrals
        });
    } catch (error) {
        console.error('Error fetching user:', error);
        res.status(500).json({ error: 'Failed to fetch user information' });
    }
});

userRouter.get('/referrals', authenticateToken, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        const referrals = await User.find({ referredBy: user.referralCode })
            .select('email createdAt')
            .sort('-createdAt');

        res.json({
            referralCode: user.referralCode,
            referrals: referrals,
            totalReferrals: referrals.length
        });
    } catch (error) {
        console.error('Error fetching referrals:', error);
        res.status(500).json({ error: 'Failed to fetch referral information' });
    }
});

// 注册路由
authRouter.post('/register', async (req, res) => {
    try {
        const { email, password, referralCode } = req.body;

        // 验证邮箱格式
        if (!email || !email.includes('@')) {
            return res.status(400).json({ error: 'Invalid email format' });
        }

        // 验证密码长度
        if (!password || password.length < 6) {
            return res.status(400).json({ error: 'Password must be at least 6 characters long' });
        }

        // 检查邮箱是否已注册
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ error: 'Email already registered' });
        }

        // 验证推荐码
        if (referralCode) {
            const referrer = await User.findOne({ referralCode });
            if (!referrer) {
                return res.status(400).json({ error: 'Invalid referral code' });
            }
        }

        // 创建新用户
        const hashedPassword = await bcryptjs.hash(password, 10);
        const user = new User({
            email,
            password: hashedPassword,
            referredBy: referralCode
        });

        await user.save();

        // 如果有推荐人，更新推荐人的积分
        if (referralCode) {
            const referrer = await User.findOne({ referralCode });
            if (referrer) {
                referrer.points += 100;  // 奖励100积分
                await referrer.save();
            }
        }

        // 生成 token
        const token = jwt.sign(
            { 
                id: user._id,
                email: user.email,
                isAdmin: user.isAdmin
            },
            config.jwt.secret,
            { expiresIn: '24h' }
        );

        res.status(201).json({
            token,
            user: {
                id: user._id,
                email: user.email,
                isAdmin: user.isAdmin,
                referralCode: user.referralCode
            }
        });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ error: 'Internal server error during registration' });
    }
});

// 任务路由
taskRouter.get('/', authenticateToken, async (req, res) => {
    try {
        const tasks = await Task.find();
        res.json(tasks);
    } catch (error) {
        console.error('Error fetching tasks:', error);
        res.status(500).json({ error: 'Failed to fetch tasks' });
    }
});

// 挂载路由
app.use('/api/auth', authRouter);
app.use('/api/users', userRouter);
app.use('/api/tasks', taskRouter);
app.use('/api/admin', adminRouter);

// 静态文件服务
app.use(express.static(path.join(__dirname, 'public')));

// 前端路由处理
app.get('/admin/*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/admin/index.html'));
});

app.get('/dashboard/*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/dashboard/index.html'));
});

app.get('*', (req, res) => {
    if (!req.path.startsWith('/api/')) {
        res.sendFile(path.join(__dirname, 'public/index.html'));
    }
});

// 错误处理中间件
app.use((err, req, res, next) => {
    console.error('Error:', err);
    res.status(500).json({ error: 'Internal server error' });
});

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

// 进程错误处理
process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    gracefulShutdown('UNCAUGHT_EXCEPTION');
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    // 不立即关闭，只记录日志
});

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