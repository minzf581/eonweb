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

// Create a separate router for health checks with no middleware
const healthRouter = express.Router();
healthRouter.get('/_ah/start', (req, res) => {
    console.log('Received App Engine start request');
    res.status(200).send('OK');
});

healthRouter.get('/_ah/stop', async (req, res) => {
    console.log('Received App Engine stop request');
    try {
        await gracefulShutdown();
        res.status(200).send('OK');
    } catch (error) {
        console.error('Error during shutdown:', error);
        res.status(200).send('Stopping with errors');
    }
});

// Mount health check router first, before any middleware
app.use('/', healthRouter);

// Request logging middleware
app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
        const duration = Date.now() - start;
        console.log(`${req.method} ${req.url} ${res.statusCode} ${duration}ms`);
    });
    next();
});

// Middleware setup
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

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/referral', referralRoutes);
app.use('/api/tasks', tasksRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/admin', adminRoutes);

// Handle frontend routing
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Global error handler - place this after all routes
app.use((err, req, res, next) => {
    console.error('Global error handler caught:', err);
    console.error('Error stack:', err.stack);
    res.status(500).json({
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});

// Graceful shutdown
async function gracefulShutdown() {
    console.log('Starting graceful shutdown...');
    try {
        await sequelize.close();
        console.log('Database connections closed');
        
        if (app.get('server')) {
            await new Promise((resolve, reject) => {
                app.get('server').close((err) => {
                    if (err) reject(err);
                    else resolve();
                });
            });
            console.log('Server closed');
        }
    } catch (error) {
        console.error('Error during shutdown:', error);
        throw error;
    }
}

// Initialize server
async function startServer() {
    try {
        // Start server first
        const PORT = process.env.PORT || 8081;
        const server = app.listen(PORT, () => {
            console.log(`Server running on port ${PORT}`);
        });
        app.set('server', server);

        // Then initialize database
        console.log('Testing database connection...');
        await sequelize.authenticate();
        console.log('Database connection established');

        // Handle graceful shutdown
        const signals = ['SIGTERM', 'SIGINT', 'SIGUSR2'];
        signals.forEach(signal => {
            process.on(signal, async () => {
                console.log(`${signal} signal received`);
                await gracefulShutdown();
                process.exit(0);
            });
        });

        return server;
    } catch (error) {
        console.error('Failed to start server:', error);
        console.error('Error stack:', error.stack);
        process.exit(1);
    }
}

// Handle uncaught errors
process.on('unhandledRejection', (error) => {
    console.error('Unhandled Promise Rejection:', error);
    console.error('Error stack:', error.stack);
});

process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    console.error('Error stack:', error.stack);
    process.exit(1);
});

// Start the server
startServer();
