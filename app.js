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

// Application state
let isInitialized = false;
let isInitializing = false;
let initPromise = null;
let initRetryCount = 0;
const MAX_INIT_RETRIES = 3;

// Initialize application
const initialize = async () => {
    // If already initialized, return immediately
    if (isInitialized) {
        console.log('[Initialize] Already initialized, skipping');
        return true;
    }

    // If initialization is in progress, wait for it
    if (isInitializing) {
        console.log('[Initialize] Initialization in progress, waiting...');
        try {
            await initPromise;
            return isInitialized;
        } catch (error) {
            console.error('[Initialize] Error while waiting for initialization:', error);
            return false;
        }
    }

    // Start initialization
    isInitializing = true;
    initPromise = (async () => {
        try {
            console.log('[Initialize] Starting initialization (attempt ' + (initRetryCount + 1) + ' of ' + MAX_INIT_RETRIES + ')');
            
            // Test database connection
            await sequelize.authenticate();
            console.log('[Database] Connected successfully');
            
            isInitialized = true;
            initRetryCount = 0;
            console.log('[Initialize] Initialization completed successfully');
            return true;
        } catch (error) {
            console.error('[Initialize] Error during initialization:', error);
            
            // Increment retry count and check if we should retry
            initRetryCount++;
            if (initRetryCount < MAX_INIT_RETRIES) {
                console.log('[Initialize] Will retry initialization');
                return false;
            } else {
                console.error('[Initialize] Max retries reached, giving up');
                initRetryCount = 0;
                throw error;
            }
        } finally {
            isInitializing = false;
            initPromise = null;
        }
    })();

    return initPromise;
};

// Serve static files first
app.use(express.static(publicPath, {
    index: false,
    extensions: ['html'],
    fallthrough: true
}));

// Health check endpoints
app.get('/_ah/warmup', async (req, res) => {
    console.log('[Health Check] Warmup request received');
    
    // If already initialized, return success immediately
    if (isInitialized) {
        console.log('[Health Check] Warmup skipped - already initialized');
        return res.status(200).send('OK');
    }
    
    // If initialization is in progress, wait for it
    if (isInitializing) {
        console.log('[Health Check] Warmup waiting for initialization');
        try {
            await initPromise;
            if (isInitialized) {
                console.log('[Health Check] Warmup completed successfully');
                return res.status(200).send('OK');
            }
        } catch (error) {
            console.error('[Health Check] Error during warmup:', error);
        }
    }
    
    // Try to initialize
    try {
        const success = await initialize();
        if (success) {
            console.log('[Health Check] Warmup completed successfully');
            res.status(200).send('OK');
        } else {
            console.error('[Health Check] Warmup failed - initialization unsuccessful');
            res.status(500).send('Failed');
        }
    } catch (error) {
        console.error('[Health Check] Warmup error:', error);
        res.status(500).send('Error during warmup');
    }
});

app.get('/_ah/start', async (req, res) => {
    console.log('[Health Check] Start request received');
    
    // If already initialized, return success immediately
    if (isInitialized) {
        console.log('[Health Check] Start skipped - already initialized');
        return res.status(200).send('OK');
    }
    
    // If initialization is in progress, wait for it
    if (isInitializing) {
        console.log('[Health Check] Start waiting for initialization');
        try {
            await initPromise;
            if (isInitialized) {
                console.log('[Health Check] Start completed successfully');
                return res.status(200).send('OK');
            }
        } catch (error) {
            console.error('[Health Check] Error during start:', error);
        }
    }
    
    // Try to initialize
    try {
        const success = await initialize();
        if (success) {
            console.log('[Health Check] Start completed successfully');
            res.status(200).send('OK');
        } else {
            console.error('[Health Check] Start failed - initialization unsuccessful');
            res.status(500).send('Failed');
        }
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
    if (isInitialized) {
        console.log('[Health Check] Ready check passed');
        res.status(200).send('OK');
    } else {
        console.log('[Health Check] Ready check failed - not initialized');
        res.status(503).send('Not ready');
    }
});

// API Routes
app.use('/api/*', async (req, res, next) => {
    if (!isInitialized) {
        try {
            const success = await initialize();
            if (!success) {
                console.error('[API] Service not ready - initialization failed');
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

// Handle favicon.ico
app.get('/favicon.ico', (req, res) => {
    res.sendFile(path.join(publicPath, 'favicon.ico'), err => {
        if (err) {
            console.warn('[Route] Favicon not found:', err.message);
            res.status(404).end();
        }
    });
});

// Handle root path specifically
app.get('/', async (req, res) => {
    console.log('[Route] Serving index.html for root path');
    
    // If initialization is in progress, wait for it
    if (isInitializing) {
        try {
            await initPromise;
        } catch (error) {
            console.error('[Route] Error waiting for initialization:', error);
            return res.status(503).send('Service unavailable');
        }
    }
    
    // If not initialized, try to initialize
    if (!isInitialized) {
        try {
            const success = await initialize();
            if (!success) {
                console.error('[Route] Service not ready - initialization failed');
                return res.status(503).send('Service unavailable');
            }
        } catch (error) {
            console.error('[Route] Error during initialization:', error);
            return res.status(503).send('Service unavailable');
        }
    }
    
    // Serve the file
    res.sendFile(path.join(publicPath, 'index.html'), err => {
        if (err) {
            console.error('[Route] Error serving index.html:', err);
            res.status(500).send('Error serving index.html');
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
