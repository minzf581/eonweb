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

// Serve static files first
app.use(express.static(publicPath, {
    index: false,
    extensions: ['html'],
    fallthrough: true,
    maxAge: '1h'
}));

// Application state
let isInitialized = false;

// Initialize application
const initialize = async () => {
    if (isInitialized) {
        return true;
    }

    try {
        console.log('[Initialize] Starting initialization...');
        
        // Test database connection
        await sequelize.authenticate();
        console.log('[Database] Connected successfully');
        
        isInitialized = true;
        console.log('[Initialize] Initialization completed successfully');
        return true;
    } catch (error) {
        console.error('[Initialize] Error during initialization:', error);
        return false;
    }
};

// Health check endpoints
app.get('/_ah/warmup', async (req, res) => {
    console.log('[Health Check] Warmup request received');
    try {
        const success = await initialize();
        res.status(success ? 200 : 500).send(success ? 'OK' : 'Failed');
    } catch (error) {
        console.error('[Health Check] Warmup error:', error);
        res.status(500).send('Error during warmup');
    }
});

app.get('/_ah/start', async (req, res) => {
    console.log('[Health Check] Start request received');
    try {
        const success = await initialize();
        res.status(success ? 200 : 500).send(success ? 'OK' : 'Failed');
    } catch (error) {
        console.error('[Health Check] Start error:', error);
        res.status(500).send('Error during start');
    }
});

app.get('/_ah/live', (req, res) => {
    console.log('[Health Check] Liveness check received');
    res.status(200).send('OK');
});

app.get('/_ah/ready', (req, res) => {
    console.log('[Health Check] Ready check received');
    res.status(isInitialized ? 200 : 503).send(isInitialized ? 'OK' : 'Not ready');
});

// API Routes
app.use('/api/*', async (req, res, next) => {
    if (!isInitialized) {
        try {
            const success = await initialize();
            if (!success) {
                return res.status(503).json({ error: 'Service unavailable' });
            }
        } catch (error) {
            console.error('[API] Error during initialization:', error);
            return res.status(503).json({ error: 'Service unavailable' });
        }
    }
    next();
});

app.use('/api/auth', authRoutes);
app.use('/api/referral', referralRoutes);
app.use('/api/tasks', tasksRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/points', pointsRoutes);

// Handle root path specifically
app.get('/', async (req, res) => {
    console.log('[Route] Serving index.html for root path');
    try {
        await initialize();
        res.sendFile(path.join(publicPath, 'index.html'), err => {
            if (err) {
                console.error('[Route] Error serving index.html:', err);
                res.status(500).send('Error serving index.html');
            }
        });
    } catch (error) {
        console.error('[Route] Error during initialization:', error);
        res.status(503).send('Service unavailable');
    }
});

// Handle favicon.ico
app.get('/favicon.ico', (req, res) => {
    res.sendFile(path.join(publicPath, 'favicon.ico'), err => {
        if (err) {
            console.error('[Route] Error serving favicon.ico:', err);
            res.status(404).send('Favicon not found');
        }
    });
});

// Handle all other routes
app.get('/*', async (req, res) => {
    if (req.path.startsWith('/api/')) {
        return res.status(404).json({ error: 'API endpoint not found' });
    }
    
    console.log(`[Route] Serving index.html for path: ${req.path}`);
    try {
        await initialize();
        res.sendFile(path.join(publicPath, 'index.html'), err => {
            if (err) {
                console.error('[Route] Error serving index.html:', err);
                res.status(500).send('Error serving index.html');
            }
        });
    } catch (error) {
        console.error('[Route] Error during initialization:', error);
        res.status(503).send('Service unavailable');
    }
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
        // Start HTTP server
        app.listen(port, () => {
            console.log(`[Server] Running on port ${port}`);
        });

        // Initialize in background
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
