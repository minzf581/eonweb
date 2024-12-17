const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
const cookieParser = require('cookie-parser');
require('dotenv').config();

const app = express();

// 环境变量配置
const CORS_ALLOWED_ORIGINS = (process.env.CORS_ALLOWED_ORIGINS || 'http://localhost:3000,http://localhost:8080,https://w3router.github.io')
    .split(',')
    .map(origin => origin.trim().replace(';', '')); // Remove any semicolons and trim whitespace
const CORS_ENABLED = process.env.CORS_ENABLED !== 'false';
const NODE_ENV = process.env.NODE_ENV || 'development';
const JWT_SECRET = process.env.JWT_SECRET;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://mongodb.railway.internal:27017';
const PORT = process.env.PORT || 8080;

// 验证必要的环境变量
if (!JWT_SECRET) {
    console.error('JWT_SECRET environment variable is required');
    process.exit(1);
}

if (!MONGODB_URI) {
    console.error('MONGODB_URI environment variable is required');
    process.exit(1);
}

console.log('\n=== Environment Configuration ===');
console.log('CORS_ALLOWED_ORIGINS:', CORS_ALLOWED_ORIGINS);
console.log('CORS_ENABLED:', CORS_ENABLED);
console.log('NODE_ENV:', NODE_ENV);
console.log('JWT_SECRET:', JWT_SECRET ? 'configured' : 'missing');
console.log('MONGODB_URI:', MONGODB_URI.replace(/\/\/[^:]+:[^@]+@/, '//[credentials]@'));
console.log('PORT:', PORT);

// MongoDB 连接选项
const mongooseOptions = {
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
    family: 4,
    maxPoolSize: 10,
    minPoolSize: 2,
    maxIdleTimeMS: 10000,
    connectTimeoutMS: 10000,
    retryWrites: true,
    retryReads: true
};

// MongoDB 连接
mongoose.connect(MONGODB_URI, mongooseOptions)
    .then(() => {
        console.log('Successfully connected to MongoDB');
        
        // 启动服务器
        const HOST = process.env.HOST || '0.0.0.0';
        const server = app.listen(PORT, HOST, () => {
            console.log(`Server is running at http://${HOST}:${PORT}`);
            console.log('Environment:', NODE_ENV);
        });

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
    })
    .catch((error) => {
        console.error('MongoDB connection error:', error);
        process.exit(1);
    });

// 监听 MongoDB 连接事件
mongoose.connection.on('error', (error) => {
    console.error('MongoDB connection error:', error);
});

mongoose.connection.on('disconnected', () => {
    console.log('MongoDB disconnected');
});

mongoose.connection.on('reconnected', () => {
    console.log('MongoDB reconnected');
});

// CORS 配置
const corsOptions = {
    origin: function (origin, callback) {
        console.log('Request origin:', origin);
        // 允许的域名列表
        const allowedOrigins = [
            'https://eonweb-production.up.railway.app',
            'https://illustrious-perfection-production.up.railway.app',
            'http://localhost:3000',
            'http://localhost:8080'
        ];

        // 在开发环境中允许没有 origin（比如 Postman 请求）
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            console.log('Origin not allowed:', origin);
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    exposedHeaders: ['Set-Cookie'],
    maxAge: 86400, // 预检请求缓存24小时
    optionsSuccessStatus: 200
};

// 启用 CORS
app.use(cors(corsOptions));

// 预检请求处理
app.options('*', cors(corsOptions));

// 确保所有响应都有正确的 CORS 头
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
    res.header('Access-Control-Allow-Credentials', 'true');
    
    // 处理 OPTIONS 请求
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
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

// 配置静态文件服务
app.use(express.static('public'));
app.use('/images', express.static(path.join(__dirname, 'public/images')));

// 记录所有请求
app.use((req, res, next) => {
    console.log('\n=== Incoming Request ===');
    console.log('Method:', req.method);
    console.log('Path:', req.path);
    console.log('Origin:', req.headers.origin);
    console.log('Headers:', req.headers);
    next();
});

// 确保所有响应都有正确的 CORS 头
app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (origin && CORS_ALLOWED_ORIGINS.includes(origin)) {
        res.header('Access-Control-Allow-Origin', origin);
        res.header('Access-Control-Allow-Credentials', 'true');
    }
    next();
});

// 调试中间件：记录所有请求
app.use((req, res, next) => {
    console.log('\n=== Request Info ===');
    console.log('Time:', new Date().toISOString());
    console.log('Method:', req.method);
    console.log('URL:', req.url);
    console.log('Origin:', req.headers.origin);
    console.log('Headers:', JSON.stringify(req.headers, null, 2));
    next();
});

// 基础中间件
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// 静态文件托管配置
app.use(express.static('public'));  // 直接使用 public 目录
app.use('/public', express.static('public')); // 同时也支持 /public 前缀的访问

// 所有其他路由返回 index.html
app.get('*', (req, res, next) => {
    // 如果是 API 请求，跳过
    if (req.path.startsWith('/api/')) {
        return next();
    }
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// API 路由错误处理
app.use('/api', (err, req, res, next) => {
    console.error('API Error:', err);
    res.status(err.status || 500).json({
        message: err.message || 'Internal server error'
    });
});

// 测试路由
app.get('/api/test', (req, res) => {
    res.json({ message: 'API is working!' });
});

// 登录路由
app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        console.log('Login attempt:', { email });

        // 查找用户
        const user = await UserService.findByEmail(email);
        if (!user) {
            console.log('User not found:', email);
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        // 验证密码
        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
            console.log('Invalid password for user:', email);
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        // 生成 JWT token
        const token = jwt.sign(
            { userId: user._id, email: user.email },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );

        console.log('Login successful:', { email, userId: user._id });

        // 发送响应
        res.json({
            token,
            user: {
                id: user._id,
                email: user.email,
                name: user.name,
                isAdmin: user.isAdmin
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// 获取用户信息路由
app.get('/api/user', (req, res) => {
    try {
        console.log('\n=== Get User Info Request ===');
        console.log('Cookies:', req.cookies);
        
        const token = req.cookies.token;
        console.log('Token from cookie:', token);
        
        if (!token) {
            console.log('No token found in cookies');
            return res.status(401).json({
                success: false,
                message: 'No authentication token found'
            });
        }
        
        if (token === 'test-token-123') {
            console.log('Valid test token found');
            return res.json({
                success: true,
                user: {
                    email: 'test@example.com',
                    name: 'Test User'
                }
            });
        } else {
            console.log('Invalid token:', token);
            return res.status(401).json({
                success: false,
                message: 'Invalid authentication token'
            });
        }
    } catch (error) {
        console.error('Error in /api/user route:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
});

// 登出路由
app.post('/api/auth/logout', (req, res) => {
    console.log('\n=== Logout Request ===');
    
    res.clearCookie('token');
    res.json({
        success: true,
        message: 'Logged out successfully'
    });
});

// Railway environment configuration
const RAILWAY_PRIVATE_DOMAIN = process.env.RAILWAY_PRIVATE_DOMAIN || 'illustrious-perfection.railway.internal';
const RAILWAY_SERVICE_NAME = process.env.RAILWAY_SERVICE_NAME || 'illustrious-perfection';
const RAILWAY_ENVIRONMENT = process.env.RAILWAY_ENVIRONMENT_NAME || 'production';

console.log('\n=== Railway Configuration ===');
console.log('- Private Domain:', RAILWAY_PRIVATE_DOMAIN);
console.log('- Service Name:', RAILWAY_SERVICE_NAME);
console.log('- Environment:', RAILWAY_ENVIRONMENT);

// MongoDB connection configuration
const MONGOHOST = process.env.MONGOHOST || 'mongodb.railway.internal';
const MONGOPORT = process.env.MONGOPORT || '27017';
const MONGOUSER = process.env.MONGOUSER || 'mongo';
const MONGOPASSWORD = process.env.MONGOPASSWORD || 'sUgcrMBkbeKekzBDqEQnqfOOCHjDNAbq';

// Construct MongoDB URL using Railway private domain
const MONGO_URL = `mongodb://${MONGOUSER}:${MONGOPASSWORD}@${MONGOHOST}:${MONGOPORT}`;

console.log('\n=== MongoDB Configuration ===');
console.log('- Host:', MONGOHOST);
console.log('- Port:', MONGOPORT);
console.log('- User:', MONGOUSER);
console.log('- Connection URL:', MONGO_URL.replace(/mongodb:\/\/.*@/, 'mongodb://[credentials]@'));

// 启动服务器
const HOST = process.env.HOST || '0.0.0.0';

console.log('\n=== Server Configuration ===');
console.log('- PORT:', PORT);
console.log('- HOST:', HOST);
console.log('- NODE_ENV:', process.env.NODE_ENV);
console.log('- Working Directory:', process.cwd());

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
        res.status(500).json({ message: error.message });
    }
});

// 获取推荐任务状态
app.get('/api/tasks/referral/status', async (req, res) => {
    try {
        const referralTask = await Task.findOne({ title: 'Referral Program' });
        res.json({ isActive: referralTask ? referralTask.isActive : false });
    } catch (error) {
        console.error('Error getting referral task status:', error);
        res.status(500).json({ message: error.message });
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
    console.error('Error:', err);
    if (err.message === 'Not allowed by CORS') {
        res.status(403).json({
            error: 'CORS not allowed',
            origin: req.headers.origin
        });
    } else {
        res.status(500).json({
            error: 'Internal Server Error'
        });
    }
});

// 全局 OPTIONS 请求处理
app.options('*', (req, res) => {
    console.log('Handling OPTIONS request for:', req.url);
    
    // 设置 CORS 头
    res.header('Access-Control-Allow-Origin', req.headers.origin);
    res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Expose-Headers', 'Set-Cookie');
    res.header('Access-Control-Max-Age', '86400');
    
    // 发送成功响应
    res.sendStatus(204);
});

// 调试中间件
app.use((req, res, next) => {
    console.log(`${req.method} ${req.url}`);
    console.log('Headers:', req.headers);
    next();
});

// 添加代理路由来处理认证请求
app.post('/proxy/auth/login', async (req, res) => {
    try {
        console.log('Proxying login request:', req.body);
        
        const response = await fetch('https://illustrious-perfection-production.up.railway.app/api/auth/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(req.body)
        });

        const data = await response.json();
        console.log('Proxy response:', data);

        // 设置相同的状态码
        res.status(response.status);
        
        // 转发响应
        res.json(data);
    } catch (error) {
        console.error('Proxy error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});