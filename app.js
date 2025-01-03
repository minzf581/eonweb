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

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

// Static files
const publicPath = path.join(__dirname, 'public');
app.use(express.static(publicPath, {
    index: false,
    extensions: ['html']
}));

// Application state
let isInitialized = false;
let isInitializing = false;
let initError = null;

// Initialize application
const initialize = async () => {
    // If already initialized, return immediately
    if (isInitialized) {
        return;
    }

    // If initialization is in progress, wait for it
    if (isInitializing) {
        console.log('[Initialize] Waiting for initialization to complete...');
        while (isInitializing) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        if (initError) {
            throw initError;
        }
        return;
    }

    try {
        isInitializing = true;
        console.log('[Initialize] Starting initialization...');

        // Connect to database
        await sequelize.authenticate();
        console.log('[Database] Connected successfully');
        
        isInitialized = true;
        isInitializing = false;
        initError = null;
        console.log('[Initialize] Initialization completed successfully');
    } catch (error) {
        console.error('[Initialize] Error during initialization:', error);
        isInitializing = false;
        initError = error;
        throw error;
    }
};

// Health check endpoints
app.get('/_ah/warmup', async (req, res) => {
    console.log('[Health Check] Warmup request received');
    try {
        await initialize();
        res.status(200).send('OK');
    } catch (error) {
        console.error('[Health Check] Warmup failed:', error);
        res.status(500).send('Warmup failed');
    }
});

app.get('/_ah/start', async (req, res) => {
    console.log('[Health Check] Start request received');
    try {
        await initialize();
        res.status(200).send('OK');
    } catch (error) {
        console.error('[Health Check] Start failed:', error);
        res.status(500).send('Start failed');
    }
});

app.get('/_ah/stop', (req, res) => {
    console.log('[Health Check] Stop request received');
    res.status(200).send('OK');
});

app.get('/_ah/ready', async (req, res) => {
    console.log('[Health Check] Ready check received');
    if (isInitialized) {
        res.status(200).send('OK');
    } else {
        res.status(503).send('Not ready');
    }
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/referral', referralRoutes);
app.use('/api/tasks', tasksRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/points', pointsRoutes);

// Handle all other routes
app.get('/*', (req, res) => {
    console.log(`[Route] Serving index.html for path: ${req.path}`);
    res.sendFile(path.join(publicPath, 'index.html'));
});

// Error handling
app.use((err, req, res, next) => {
    console.error('[Error]', err);
    res.status(500).json({ error: 'Internal server error' });
});

// Start server
const port = process.env.PORT || 8081;

const startServer = async () => {
    try {
        // Start HTTP server first
        const server = app.listen(port, () => {
            console.log(`[Server] Running on port ${port}`);
        });

        // Then initialize in background
        initialize().catch(error => {
            console.error('[Startup] Background initialization failed:', error);
        });
    } catch (error) {
        console.error('[Startup] Failed to start server:', error);
        process.exit(1);
    }
};

startServer();

module.exports = app;
