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

// CORS 配置
app.use(cors({
    origin: function(origin, callback) {
        // 允许没有 origin 的请求（比如同源请求）
        if (!origin) return callback(null, true);
        
        const allowedOrigins = [
            'http://localhost:8080',
            'https://eonweb-production.up.railway.app'
        ];
        
        if (allowedOrigins.indexOf(origin) === -1) {
            return callback(new Error('CORS policy violation'), false);
        }
        
        return callback(null, true);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// 请求日志中间件
app.use((req, res, next) => {
    console.log(`\n=== ${new Date().toISOString()} ===`);
    console.log(`${req.method} ${req.path}`);
    console.log('Headers:', req.headers);
    if (req.body && Object.keys(req.body).length > 0) {
        console.log('Body:', req.body);
    }
    next();
});

// 错误处理中间件
app.use((err, req, res, next) => {
    console.error('Error:', err);
    res.status(500).json({ error: 'Internal server error' });
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

// 身份验证中间件
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'No token provided' });
    }

    jwt.verify(token, config.jwt.secret, (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Invalid token' });
        }
        req.user = user;
        next();
    });
};

// 管理员权限中间件
const isAdmin = (req, res, next) => {
    if (!req.user.isAdmin) {
        return res.status(403).json({ error: 'Admin access required' });
    }
    next();
};

// 认证路由
const authRouter = express.Router();

// 登录路由
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

        // 设置管理员权限
        const isAdmin = email === 'info@eon-protocol.com';
        if (isAdmin && !user.isAdmin) {
            user.isAdmin = true;
            await user.save();
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

        console.log('Login successful for user:', email);
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

// 注册路由
authRouter.post('/register', async (req, res) => {
    try {
        const { email, password, referralCode } = req.body;

        // 检查邮箱是否已存在
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ error: 'Email already exists' });
        }

        // 创建新用户
        const user = new User({
            email,
            password: await bcryptjs.hash(password, 10),
            referralCode: generateReferralCode(),
            isAdmin: email === 'info@eon-protocol.com'
        });

        // 如果有推荐码，设置推荐人
        if (referralCode) {
            const referrer = await User.findOne({ referralCode });
            if (referrer) {
                user.referredBy = referrer._id;
            }
        }

        await user.save();

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
        res.status(500).json({ error: 'Registration failed' });
    }
});

// 验证 token
authRouter.get('/verify', authenticateToken, (req, res) => {
    res.json({ 
        valid: true,
        user: {
            id: req.user.id,
            email: req.user.email,
            isAdmin: req.user.isAdmin
        }
    });
});

// 挂载认证路由
apiRouter.use('/auth', authRouter);

// 用户路由
const userRouter = express.Router();

// 获取用户信息
userRouter.get('/me', authenticateToken, async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('-password');
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.json(user);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch user information' });
    }
});

// 获取用户统计信息
userRouter.get('/stats', authenticateToken, async (req, res) => {
    try {
        const userTasks = await UserTask.find({ userId: req.user.id });
        const completedTasks = userTasks.filter(t => t.completed).length;
        const user = await User.findById(req.user.id);

        res.json({
            totalTasks: userTasks.length,
            completedTasks,
            points: user.points
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch user stats' });
    }
});

// 挂载用户路由
apiRouter.use('/users', userRouter);

// 任务路由
const taskRouter = express.Router();

// 获取任务列表
taskRouter.get('/', authenticateToken, async (req, res) => {
    try {
        const tasks = await Task.find();
        res.json(tasks);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch tasks' });
    }
});

// 开始任务
taskRouter.post('/:taskId/start', authenticateToken, async (req, res) => {
    try {
        const { taskId } = req.params;
        const userId = req.user.id;
        
        // 检查任务是否存在
        const task = await Task.findById(taskId);
        if (!task) {
            return res.status(404).json({ error: 'Task not found' });
        }

        // 检查用户是否已经开始此任务
        const existingUserTask = await UserTask.findOne({ userId, taskId });
        if (existingUserTask) {
            return res.status(400).json({ error: 'Task already started' });
        }

        // 创建新的用户任务
        const userTask = new UserTask({
            userId,
            taskId,
            startTime: new Date()
        });

        await userTask.save();
        res.json(userTask);
    } catch (error) {
        res.status(500).json({ error: 'Failed to start task' });
    }
});

// 挂载任务路由
apiRouter.use('/tasks', taskRouter);

// 管理员路由
const adminRouter = express.Router();

// 获取所有用户
adminRouter.get('/users', authenticateToken, isAdmin, async (req, res) => {
    try {
        const users = await User.find().select('-password');
        res.json(users);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch users' });
    }
});

// 创建新任务
adminRouter.post('/tasks', authenticateToken, isAdmin, async (req, res) => {
    try {
        const task = new Task(req.body);
        await task.save();
        res.status(201).json(task);
    } catch (error) {
        res.status(500).json({ error: 'Failed to create task' });
    }
});

// 挂载管理员路由
apiRouter.use('/admin', adminRouter);

// 挂载所有 API 路由
app.use('/api', apiRouter);

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

// 生成推荐码
function generateReferralCode() {
    return crypto.randomBytes(4).toString('hex');
}