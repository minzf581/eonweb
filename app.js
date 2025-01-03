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

// Application state
let isInitialized = false;

// Initialize application
const initialize = async () => {
    if (isInitialized) {
        return;
    }

    try {
        // Connect to database
        await sequelize.authenticate();
        console.log('[Database] Connected successfully');
        isInitialized = true;
    } catch (error) {
        console.error('[Initialize] Error:', error);
        throw error;
    }
};

// Health check endpoints
app.get('/_ah/start', async (req, res) => {
    console.log('[Health Check] Start request received');
    try {
        await initialize();
        res.status(200).send('OK');
    } catch (error) {
        res.status(500).send('Error during initialization');
    }
});

app.get('/_ah/stop', (req, res) => {
    console.log('[Health Check] Stop request received');
    res.status(200).send('OK');
});

app.get('/_ah/ready', async (req, res) => {
    console.log('[Health Check] Ready check received');
    try {
        await initialize();
        res.status(200).send('OK');
    } catch (error) {
        res.status(503).send('Not ready');
    }
});

app.get('/_ah/warmup', async (req, res) => {
    console.log('[Health Check] Warmup request received');
    try {
        await initialize();
        res.status(200).send('OK');
    } catch (error) {
        res.status(500).send('Warmup failed');
    }
});

// API Routes - only available after initialization
app.use(async (req, res, next) => {
    if (req.path.startsWith('/api/')) {
        try {
            await initialize();
            next();
        } catch (error) {
            res.status(503).json({ error: 'Service unavailable' });
        }
    } else {
        next();
    }
});

app.use('/api/auth', authRoutes);
app.use('/api/referral', referralRoutes);
app.use('/api/tasks', tasksRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/points', pointsRoutes);

// Static files
const publicPath = path.join(__dirname, 'public');
app.use(express.static(publicPath, {
    index: false,
    extensions: ['html']
}));

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
        // Ensure database is connected
        await initialize();
        
        // Start HTTP server
        app.listen(port, () => {
            console.log(`[Server] Running on port ${port}`);
        });
    } catch (error) {
        console.error('[Startup] Error:', error);
        process.exit(1);
    }
};

startServer();

module.exports = app;
