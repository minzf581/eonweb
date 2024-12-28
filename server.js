// 加载环境变量
if (process.env.NODE_ENV === 'production') {
    require('dotenv').config({ path: '.env.production' });
} else {
    require('dotenv').config();
}

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
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

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
        // Send response immediately
        res.status(200).send('OK');
        
        // Give time for the response to be sent
        setTimeout(async () => {
            console.log('Shutting down server...');
            if (server) {
                try {
                    await new Promise((resolve) => {
                        server.close(resolve);
                    });
                    console.log('Server shut down successfully');
                    process.exit(0);
                } catch (error) {
                    console.error('Error shutting down server:', error);
                    process.exit(1);
                }
            } else {
                console.log('No server instance found');
                process.exit(0);
            }
        }, 1000);
    } catch (error) {
        console.error('Error handling stop request:', error);
        // Don't send error response since we already sent OK
        process.exit(1);
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

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/referral', referralRoutes);
app.use('/api/tasks', tasksRoutes);
app.use('/api/stats', statsRoutes);

// Handle frontend routing (no authentication required)
app.get('*', (req, res) => {
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

        // Start server
        const port = process.env.PORT || 8080;
        server = app.listen(port, () => {
            console.log(`Server running on port ${port}`);
        });

        // Handle graceful shutdown
        process.on('SIGTERM', () => {
            console.log('SIGTERM signal received');
            if (server) {
                server.close(() => {
                    console.log('Server closed');
                    process.exit(0);
                });
            } else {
                process.exit(0);
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
