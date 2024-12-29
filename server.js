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
const { User, Task, UserTask, PointHistory, Settings } = require('./models');
const authRoutes = require('./routes/auth');
const { router: referralRoutes } = require('./routes/referral');
const tasksRoutes = require('./routes/tasks');
const statsRoutes = require('./routes/stats');
const adminRoutes = require('./routes/admin');
const { authenticateToken, isAdmin } = require('./middleware/auth');
const crypto = require('crypto');

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
app.get('/_ah/health', (req, res) => {
    console.log('Received health check request');
    res.status(200).send('OK');
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

// Seed tasks
async function seedTasks() {
    console.log('Seeding tasks...');
    try {
        // Delete existing tasks
        await Task.destroy({ where: {} });

        // Create tasks
        const tasks = [
            {
                title: 'Referral Reward',
                description: '邀请新用户加入平台',
                points: 100,
                type: 'one-time',
                requirements: ['Invite a new user'],
                verificationMethod: 'automatic',
                isActive: true,
                status: 'active',
                startDate: new Date()
            },
            {
                title: 'Share Bandwidth',
                description: '分享带宽获得奖励',
                points: 50,
                type: 'daily',
                requirements: ['Share minimum 1GB bandwidth'],
                verificationMethod: 'automatic',
                isActive: true,
                status: 'active',
                startDate: new Date()
            }
        ];

        for (const task of tasks) {
            const createdTask = await Task.create(task);
            console.log(`Created task: ${createdTask.title}`);
        }

        console.log('Tasks seeded successfully');
    } catch (error) {
        console.error('Error seeding tasks:', error);
    }
}

// Initialize database and start server
async function initializeApp() {
    try {
        // Sync database
        await sequelize.sync();
        console.log('Database synchronized');

        // Create admin user if not exists
        const adminEmail = 'info@eon-protocol.com';
        const existingAdmin = await User.findOne({ where: { email: adminEmail } });

        if (!existingAdmin) {
            const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
            const hashedPassword = await bcryptjs.hash(adminPassword, 10);
            const referralCode = crypto.randomBytes(4).toString('hex');

            await User.create({
                email: adminEmail,
                password: hashedPassword,
                isAdmin: true,
                points: 0,
                referralCode
            });
            console.log('Admin user created');
        } else {
            console.log('Admin user already exists');
        }

        // Seed tasks
        await seedTasks();

        // Start server
        const PORT = process.env.PORT || 8081;
        const server = app.listen(PORT, () => {
            console.log(`Server running on port ${PORT}`);
        });

        // Store server instance
        app.set('server', server);

        // Handle graceful shutdown
        process.on('SIGTERM', async () => {
            console.log('SIGTERM signal received');
            await gracefulShutdown();
        });

        process.on('SIGINT', async () => {
            console.log('SIGINT signal received');
            await gracefulShutdown();
        });

        // Handle App Engine start/stop
        app.get('/_ah/start', (req, res) => {
            console.log('Received start request');
            res.status(200).send('Application started');
        });

        app.get('/_ah/stop', async (req, res) => {
            console.log('Received stop request');
            await gracefulShutdown();
            res.status(200).send('Application stopping');
        });

    } catch (error) {
        console.error('Error initializing app:', error);
        process.exit(1);
    }
}

// Graceful shutdown function
async function gracefulShutdown() {
    try {
        const server = app.get('server');
        if (server) {
            console.log('Closing HTTP server...');
            await new Promise((resolve) => server.close(resolve));
            console.log('HTTP server closed');
        }

        console.log('Closing database connection...');
        await sequelize.close();
        console.log('Database connection closed');

        console.log('Graceful shutdown completed');
        process.exit(0);
    } catch (error) {
        console.error('Error during graceful shutdown:', error);
        process.exit(1);
    }
}

// Initialize app
initializeApp();

// 错误处理
process.on('unhandledRejection', (error) => {
    console.error('Unhandled Rejection:', error);
});

process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    gracefulShutdown();
});

module.exports = app;
