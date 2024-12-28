// Load environment variables based on NODE_ENV
const dotenv = require('dotenv');
const envFile = process.env.NODE_ENV === 'production' ? '.env.production' : '.env';
dotenv.config({ path: envFile });
console.log('Loading environment from:', envFile);

const express = require('express');
const cors = require('cors');
const path = require('path');
const cookieParser = require('cookie-parser');
const compression = require('compression');
const bcryptjs = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Op } = require('sequelize');
const sequelize = require('./config/database');
const seedAdminUser = require('./seeders/adminUser');
const { User, Task, UserTask, PointHistory, Settings } = require('./models');
const authRoutes = require('./routes/auth');
const { router: referralRoutes } = require('./routes/referral');
const tasksRoutes = require('./routes/tasks');
const statsRoutes = require('./routes/stats');
const adminRoutes = require('./routes/admin');
const { authenticateToken, isAdmin } = require('./middleware/auth');

const app = express();

// 中间件
const corsOptions = {
    origin: [
        'http://localhost:8080',
        'http://localhost:3000',
        'https://eonhome-445809.et.r.appspot.com'
    ],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
};

app.use(cors(corsOptions));

app.use(express.json());
app.use(cookieParser());
app.use(compression());

// Request logging middleware
app.use((req, res, next) => {
    const timestamp = new Date().toISOString();
    console.log(`${timestamp} ${req.method} ${req.url}`);
    if (req.method === 'POST') {
        console.log('Request body:', JSON.stringify(req.body, null, 2));
    }
    if (req.headers.authorization) {
        console.log('Authorization header present');
    }
    next();
});

// Serve static files first
app.use(express.static(path.join(__dirname, 'public')));

// Public routes (no authentication required)
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/favicon.ico', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'favicon.ico'));
});

// API routes
app.use('/api/auth', authRoutes);

// Protected API routes with authentication
app.use('/api', authenticateToken);
app.use('/api/referral', referralRoutes);
app.use('/api/tasks', tasksRoutes);
app.use('/api/stats', statsRoutes);

// Admin routes with both authentication and admin check
app.use('/api/admin', authenticateToken, isAdmin, adminRoutes);

// Health check endpoints for App Engine (no authentication required)
app.get('/_ah/start', (req, res) => {
    console.log('Received start request');
    res.status(200).send('OK');
});

app.get('/_ah/health', (req, res) => {
    console.log('Received health check request');
    res.status(200).send('OK');
});

app.get('/_ah/stop', async (req, res) => {
    console.log('Received stop request');
    try {
        const server = app.get('server');
        if (server) {
            server.close(() => {
                console.log('Server closed');
                res.status(200).send('Server stopped');
                process.exit(0);
            });
        } else {
            console.log('No server instance found');
            res.status(200).send('No server instance found');
            process.exit(0);
        }
    } catch (error) {
        console.error('Error during shutdown:', error);
        res.status(500).send('Error during shutdown');
        process.exit(1);
    }
});

// Handle frontend routing (no authentication required)
// This must be the last route
app.get('*', (req, res) => {
    // Don't handle API routes here
    if (req.path.startsWith('/api/')) {
        res.status(404).json({ error: 'API endpoint not found' });
        return;
    }
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 数据库同步和服务器启动
async function startServer() {
    try {
        // 同步数据库模型
        await sequelize.sync();
        console.log('Database synchronized');

        // 创建默认管理员用户
        await seedAdminUser();
        console.log('Admin user created successfully');

        // 启动服务器
        const server = app.listen(process.env.PORT || 8081, () => {
            console.log(`Server running on port ${process.env.PORT || 8081}`);
        });

        // Store server instance
        app.set('server', server);

        // Handle shutdown
        process.on('SIGTERM', () => {
            console.log('SIGTERM signal received');
            const server = app.get('server');
            if (server) {
                server.close(() => {
                    console.log('Server closed');
                    process.exit(0);
                });
            } else {
                console.log('No server instance found');
                process.exit(0);
            }
        });

    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
}

// Start the server
startServer();

// 错误处理
process.on('unhandledRejection', (error) => {
    console.error('Unhandled promise rejection:', error);
});

module.exports = app;
