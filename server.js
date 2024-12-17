const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
const cookieParser = require('cookie-parser');
const compression = require('compression');
require('dotenv').config();

const app = express();

// 环境变量配置
const config = {
    cors: {
        enabled: process.env.CORS_ENABLED !== 'false',
        allowedOrigins: (process.env.CORS_ALLOWED_ORIGINS || 'http://localhost:3000,http://localhost:8080')
            .split(',')
            .map(origin => origin.trim())
            .filter(origin => origin.length > 0)
    },
    server: {
        env: process.env.NODE_ENV || 'development',
        port: process.env.PORT || 8080,
        host: process.env.HOST || '0.0.0.0'
    },
    jwt: {
        // 在开发环境使用默认密钥，生产环境需要设置环境变量
        secret: process.env.NODE_ENV === 'production' 
            ? process.env.JWT_SECRET 
            : 'default-development-secret-key-do-not-use-in-production'
    },
    mongodb: {
        uri: process.env.MONGODB_URI || 'mongodb://mongo:sUgcrMBkbeKekzBDqEQnqfOOCHjDNAbq@junction.proxy.rlwy.net:15172/?retryWrites=true&w=majority'
    }
};

// 验证生产环境配置
if (config.server.env === 'production') {
    const missingVars = [];
    if (!process.env.JWT_SECRET) missingVars.push('JWT_SECRET');
    if (!process.env.MONGODB_URI) missingVars.push('MONGODB_URI');
    
    if (missingVars.length > 0) {
        console.warn(`Warning: Missing recommended environment variables for production: ${missingVars.join(', ')}`);
        console.warn('Using default values for development. This is NOT recommended for production!');
    }
}

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

// CORS 配置
const corsOptions = {
    origin: function (origin, callback) {
        if (!config.cors.enabled) {
            callback(null, true);
            return;
        }
        if (!origin || config.cors.allowedOrigins.includes(origin)) {
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
    maxAge: 86400,
    optionsSuccessStatus: 200
};

// 中间件配置
app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// 静态文件服务
app.use('/public', express.static(path.join(__dirname, 'public'), {
    maxAge: '1d',
    etag: true,
    lastModified: true
}));

// 所有其他路由都返回 index.html
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
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
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
    family: 4,
    maxPoolSize: 10,
    minPoolSize: 2,
    maxIdleTimeMS: 10000,
    connectTimeoutMS: 10000
};

// MongoDB 连接
mongoose.connect(config.mongodb.uri, mongooseOptions)
    .then(() => {
        console.log('Successfully connected to MongoDB');
        
        // 启动服务器
        const server = app.listen(config.server.port, config.server.host, () => {
            console.log(`Server is running on http://${config.server.host}:${config.server.port}`);
            
            // 记录服务器已经准备好接受请求
            console.log('Server is ready to accept requests');
        });

        // 处理服务器错误
        server.on('error', (error) => {
            console.error('Server error:', error);
        });

        // 优雅关闭
        process.on('SIGTERM', () => {
            console.log('SIGTERM signal received: closing HTTP server');
            server.close(() => {
                console.log('HTTP server closed');
                mongoose.connection.close(false, () => {
                    console.log('MongoDB connection closed');
                    process.exit(0);
                });
            });
        });
    })
    .catch((error) => {
        console.error('MongoDB connection error:', error);
        process.exit(1);
    });

// MongoDB 连接事件监听
mongoose.connection.on('error', (error) => {
    console.error('MongoDB connection error:', error);
});

mongoose.connection.on('disconnected', () => {
    console.log('MongoDB disconnected');
});

mongoose.connection.on('reconnected', () => {
    console.log('MongoDB reconnected');
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

// API 路由
app.post('/proxy/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        console.log('Login attempt:', { email });

        // 在这里添加登录逻辑
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        const token = jwt.sign(
            { userId: user._id, email: user.email, isAdmin: user.isAdmin },
            config.jwt.secret,
            { expiresIn: '24h' }
        );

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
        res.status(500).json({ message: 'Internal server error' });
    }
});

app.get('/proxy/user', authenticateToken, async (req, res) => {
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

// 用户模型
const userSchema = new mongoose.Schema({
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    isAdmin: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);