const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');
const { sequelize } = require('./models');
const authRoutes = require('./routes/auth');
const { router: referralRoutes } = require('./routes/referral');
const tasksRoutes = require('./routes/tasks');
const statsRoutes = require('./routes/stats');
const adminRoutes = require('./routes/admin');
const pointsRoutes = require('./routes/points');

// Initialize Express app
const app = express();

// Application state
let isReady = false;
let dbConnected = false;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

// Health check endpoints with detailed logging
app.get('/_ah/start', (req, res) => {
    console.log('[Health Check] Received start request');
    res.status(200).send('OK');
});

app.get('/_ah/stop', (req, res) => {
    console.log('[Health Check] Received stop request');
    res.status(200).send('OK');
});

// Readiness probe
app.get('/_ah/ready', (req, res) => {
    console.log(`[Health Check] Readiness check - DB Connected: ${dbConnected}, App Ready: ${isReady}`);
    if (!isReady || !dbConnected) {
        res.status(503).json({
            ready: false,
            dbConnected,
            isReady
        });
        return;
    }
    res.status(200).json({ status: 'ready' });
});

// Warmup request handler
app.get('/_ah/warmup', async (req, res) => {
    console.log('[Warmup] Received warmup request');
    try {
        if (!dbConnected) {
            console.log('[Warmup] Connecting to database...');
            await sequelize.authenticate();
            console.log('[Warmup] Database connection established');
            dbConnected = true;
        }
        isReady = true;
        res.status(200).send('OK');
    } catch (error) {
        console.error('[Warmup] Error during warmup:', error);
        res.status(500).json({ error: 'Warmup failed' });
    }
});

// Static file service
app.use(express.static(path.join(__dirname, 'public')));

// Root route with error handling
app.get('/', (req, res) => {
    console.log('[Route] Serving index.html');
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/referral', referralRoutes);
app.use('/api/tasks', tasksRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/points', pointsRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('[Error] Unhandled error:', err);
    res.status(err.status || 500).json({
        error: {
            message: err.message || 'Internal Server Error',
            status: err.status || 500
        }
    });
});

// Initialize application
async function startServer() {
    try {
        // First, connect to the database
        console.log('[Database] Connecting to database...');
        await sequelize.authenticate();
        console.log('[Database] Connection has been established successfully.');
        dbConnected = true;

        // Then start the server
        const port = process.env.PORT || 8081;
        const server = app.listen(port, () => {
            console.log(`[Server] Server is running on port ${port}`);
            // Mark application as ready
            isReady = true;
            console.log('[Server] Application is ready to handle requests');
        });

        // Handle graceful shutdown
        process.on('SIGTERM', () => {
            console.log('[Server] Received SIGTERM. Starting graceful shutdown...');
            isReady = false; // Mark as not ready to reject new requests
            server.close(async () => {
                console.log('[Server] Closing database connection...');
                await sequelize.close();
                console.log('[Server] Server and database connections closed.');
                process.exit(0);
            });
        });

        return server;
    } catch (error) {
        console.error('[Startup] Failed to start server:', error);
        throw error;
    }
}

// Start the application
startServer().catch(err => {
    console.error('[Fatal] Failed to start application:', err);
    process.exit(1);
});

module.exports = app;
