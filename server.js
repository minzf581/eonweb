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
const sequelize = require('./config/database');
const seedAdminUser = require('./seeders/adminUser');
const { User, Task, UserTask, PointHistory, Settings } = require('./models');
const authRoutes = require('./routes/auth');
const { router: referralRoutes } = require('./routes/referral');
const tasksRoutes = require('./routes/tasks');
const statsRoutes = require('./routes/stats');
const { authenticateToken } = require('./middleware/auth');

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
    console.log(`${new Date().toISOString()} ${req.method} ${req.url}`);
    if (req.method === 'POST') {
        console.log('Request body:', JSON.stringify(req.body, null, 2));
    }
    next();
});

// Serve static files and public routes first (no authentication required)
app.use(express.static(path.join(__dirname, 'public')));

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
        await new Promise(resolve => {
            server.close(() => {
                console.log('Server closed');
                resolve();
            });
        });
        res.status(200).send('Server stopped');
    } catch (error) {
        console.error('Error during shutdown:', error);
        res.status(500).send('Error during shutdown');
    }
});

// Public routes (no authentication required)
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/favicon.ico', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'favicon.ico'));
});

// Apply authentication only to API routes
app.use('/api', authenticateToken);

// API routes (must come before the catch-all route)
app.use('/api/auth', authRoutes);
app.use('/api/referral', referralRoutes);
app.use('/api/tasks', tasksRoutes);
app.use('/api/stats', statsRoutes);

// Admin API routes
app.get('/api/admin/stats', authenticateToken, async (req, res) => {
    try {
        // Get stats
        const [
            totalUsers,
            activeUsers,
            totalTasks,
            completedTasks
        ] = await Promise.all([
            User.count(),
            User.count({
                where: {
                    updatedAt: {
                        [sequelize.Op.gte]: new Date(new Date() - 24 * 60 * 60 * 1000)
                    }
                }
            }),
            Task.count(),
            Task.count({
                where: {
                    status: 'completed'
                }
            })
        ]);

        res.json({
            totalUsers,
            activeUsers,
            totalTasks,
            completedTasks
        });
    } catch (error) {
        console.error('Error getting admin stats:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.get('/api/admin/users', authenticateToken, async (req, res) => {
    try {
        // Verify admin status
        if (!req.user || !req.user.isAdmin) {
            return res.status(403).json({ error: 'Admin access required' });
        }

        const users = await User.findAll({
            attributes: ['id', 'email', 'referralCode', 'points', 'isAdmin', 'createdAt', 'updatedAt'],
            order: [['createdAt', 'DESC']]
        });

        res.json(users);
    } catch (error) {
        console.error('Error getting users:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.get('/api/admin/tasks', authenticateToken, async (req, res) => {
    try {
        // Verify admin status
        if (!req.user || !req.user.isAdmin) {
            return res.status(403).json({ error: 'Admin access required' });
        }

        const tasks = await Task.findAll({
            order: [['createdAt', 'DESC']]
        });

        res.json(tasks);
    } catch (error) {
        console.error('Error getting tasks:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.get('/api/admin/settings', authenticateToken, async (req, res) => {
    try {
        // Verify admin status
        if (!req.user || !req.user.isAdmin) {
            return res.status(403).json({ error: 'Admin access required' });
        }

        const settings = await Settings.findAll();
        res.json(settings);
    } catch (error) {
        console.error('Error getting settings:', error);
        res.status(500).json({ error: 'Internal server error' });
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
        // Test database connection
        await sequelize.authenticate();
        console.log('Database connection has been established successfully.');

        // Sync database
        await sequelize.sync();
        console.log('Database synchronized');

        // Create admin user
        await seedAdminUser();
        console.log('Admin user created successfully');

        // Port configuration
        const PORT = process.env.PORT || 8080;

        // Start server
        const server = app.listen(PORT, () => {
            console.log(`Server running on port ${PORT}`);
        });

        // Handle SIGTERM signal
        process.on('SIGTERM', async () => {
            console.log('SIGTERM signal received');
            try {
                await new Promise(resolve => {
                    server.close(() => {
                        console.log('Server closed');
                        resolve();
                    });
                });
                process.exit(0);
            } catch (error) {
                console.error('Error during shutdown:', error);
                process.exit(1);
            }
        });
    } catch (error) {
        console.error('Unable to start server:', error);
        process.exit(1);
    }
}

startServer();

// 错误处理
process.on('unhandledRejection', (error) => {
    console.error('Unhandled promise rejection:', error);
});

module.exports = app;
