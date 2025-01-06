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
const appRoutes = require('./app');
const proxyRoutes = require('./routes/proxy');
const bandwidthRoutes = require('./routes/bandwidth');

const app = express();

// Force the server to use the PORT from environment variable
const PORT = process.env.PORT || 8080;
console.log('Environment variables:', {
    NODE_ENV: process.env.NODE_ENV,
    PORT: process.env.PORT,
    JWT_SECRET: process.env.JWT_SECRET ? '[HIDDEN]' : 'NOT_SET'
});
console.log(`Configured to run on port ${PORT}`);

// Health check endpoints BEFORE any other middleware
app.get('/_ah/start', (req, res) => {
    console.log('Received App Engine start request');
    res.status(200).send('OK');
});

app.get('/_ah/warmup', (req, res) => {
    console.log('Received App Engine warmup request');
    res.status(200).send('OK');
});

app.get('/_ah/health', (req, res) => {
    console.log('Received health check request');
    res.status(200).send('OK');
});

app.get('/_ah/stop', (req, res) => {
    console.log('Received App Engine stop request');
    res.status(200).send('OK');
    // Cleanup in the background
    cleanup().catch(err => {
        console.error('Failed to cleanup:', err);
    });
});

app.use('/', appRoutes);

// Separate initialization function
async function initializeApp() {
    try {
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

        // Routes
        app.use('/api/auth', authRoutes);
        app.use('/api/proxy', proxyRoutes);
        app.use('/api/tasks', tasksRoutes);
        app.use('/api/stats', statsRoutes);
        app.use('/api/referral', referralRoutes);
        app.use('/api/bandwidth', bandwidthRoutes);
        app.use('/api/admin', adminRoutes);

        // Serve static files
        app.use('/static', express.static(path.join(__dirname, 'public/static')));
        app.use(express.static(path.join(__dirname, 'public')));

        // Serve index.html for root path
        app.get('/', (req, res) => {
            res.sendFile(path.join(__dirname, 'public/index.html'));
        });

        // Handle frontend routing for SPA
        app.get('/*', (req, res) => {
            console.log(`Serving index.html for path: ${req.path}`);
            res.sendFile(path.join(__dirname, 'public/index.html'));
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

        console.log('App initialization completed successfully');
    } catch (error) {
        console.error('Failed to initialize app:', error);
        throw error;
    }
}

// Cleanup function
async function cleanup() {
    try {
        await sequelize.close();
        console.log('Database connection closed successfully');
    } catch (error) {
        console.error('Error during cleanup:', error);
        throw error;
    }
}

// Get the database instance
const db = require('./models');

// Graceful shutdown handler
async function gracefulShutdown() {
    console.log('Starting graceful shutdown...');
    try {
        // Close database connections
        if (db.sequelize && db.sequelize.connectionManager) {
            await db.sequelize.connectionManager.close();
            console.log('Database connections closed successfully');
        }

        // Close server
        if (server) {
            server.close(() => {
                console.log('Server closed successfully');
                process.exit(0);
            });
        } else {
            process.exit(0);
        }
    } catch (error) {
        console.error('Error during shutdown:', error);
        process.exit(1);
    }
}

// Handle shutdown signals
process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
    console.error('Unhandled Exception:', error);
    gracefulShutdown();
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Promise Rejection:', reason);
    gracefulShutdown();
});

// Start server
let server = app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

initializeApp();
