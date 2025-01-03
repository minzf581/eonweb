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
const instanceId = Math.random().toString(36).substring(7);
console.log(`[App] Starting instance ${instanceId}`);

// Global initialization state
const state = {
    isInitialized: false,
    isInitializing: false,
    initPromise: null,
    initRetryCount: 0,
    lastInitTime: 0,
    instanceStartTime: Date.now()
};

const INIT_TIMEOUT = 30000; // 30 seconds timeout
const INIT_COOLDOWN = 5000; // 5 seconds cooldown between retries
const MAX_INIT_RETRIES = 3;

// Initialize application with timeout
const initializeWithTimeout = async (timeout) => {
    const now = Date.now();
    
    try {
        // Add cooldown between retries
        const timeSinceLastInit = now - state.lastInitTime;
        if (timeSinceLastInit < INIT_COOLDOWN) {
            console.log(`[Initialize] Cooling down (${timeSinceLastInit}ms < ${INIT_COOLDOWN}ms)`);
            await new Promise(resolve => setTimeout(resolve, INIT_COOLDOWN - timeSinceLastInit));
        }
        
        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Initialization timeout')), timeout);
        });
        
        const initResult = await Promise.race([initialize(), timeoutPromise]);
        return initResult;
    } catch (error) {
        console.error(`[Initialize] Timeout or error on instance ${instanceId}:`, error.message);
        return false;
    }
};

// Initialize application
const initialize = async () => {
    const now = Date.now();
    
    // If already initialized and instance is still fresh (less than 4 minutes old)
    const instanceAge = now - state.instanceStartTime;
    if (state.isInitialized && instanceAge < 240000) {
        console.log(`[Initialize] Already initialized and instance is fresh (age: ${instanceAge}ms) on instance ${instanceId}`);
        return true;
    }

    // If initialization is in progress, wait for it
    if (state.isInitializing && state.initPromise) {
        console.log(`[Initialize] Initialization in progress on instance ${instanceId}, waiting...`);
        try {
            await state.initPromise;
            return state.isInitialized;
        } catch (error) {
            console.error(`[Initialize] Error while waiting for initialization on instance ${instanceId}:`, error);
            return false;
        }
    }

    // Start initialization
    state.isInitializing = true;
    state.lastInitTime = now;
    
    state.initPromise = (async () => {
        try {
            console.log(`[Initialize] Starting initialization on instance ${instanceId} (attempt ${state.initRetryCount + 1} of ${MAX_INIT_RETRIES})`);
            
            // Test database connection
            await sequelize.authenticate();
            console.log(`[Database] Connected successfully on instance ${instanceId}`);
            
            state.isInitialized = true;
            state.initRetryCount = 0;
            console.log(`[Initialize] Initialization completed successfully on instance ${instanceId}`);
            return true;
        } catch (error) {
            console.error(`[Initialize] Error during initialization on instance ${instanceId}:`, error);
            
            // Increment retry count and check if we should retry
            state.initRetryCount++;
            if (state.initRetryCount < MAX_INIT_RETRIES) {
                console.log(`[Initialize] Will retry initialization on instance ${instanceId}`);
                return false;
            } else {
                console.error(`[Initialize] Max retries reached on instance ${instanceId}, giving up`);
                state.initRetryCount = 0;
                throw error;
            }
        } finally {
            state.isInitializing = false;
            state.initPromise = null;
        }
    })();

    return state.initPromise;
};

// Serve static files first
app.use(express.static(publicPath, {
    index: false,
    extensions: ['html'],
    fallthrough: true
}));

// Health check endpoints
app.get('/_ah/warmup', async (req, res) => {
    const requestId = Math.random().toString(36).substring(7);
    console.log(`[Health Check] Warmup request received on instance ${instanceId} (${requestId})`);
    
    try {
        // Always try to initialize on warmup
        const WARMUP_TIMEOUT = 25000; // 25 seconds timeout for warmup
        console.log(`[Health Check] Starting initialization for warmup on instance ${instanceId} (${requestId})`);
        
        // If already initializing, wait for it
        if (state.isInitializing && state.initPromise) {
            console.log(`[Health Check] Waiting for in-progress initialization on instance ${instanceId} (${requestId})`);
            await state.initPromise;
        } else {
            // Start new initialization
            await initializeWithTimeout(WARMUP_TIMEOUT);
        }
        
        // Check final state
        if (state.isInitialized) {
            console.log(`[Health Check] Warmup completed successfully on instance ${instanceId} (${requestId})`);
            res.status(200).send('OK');
        } else {
            console.error(`[Health Check] Warmup failed - not initialized on instance ${instanceId} (${requestId})`);
            res.status(500).send('Not initialized');
        }
    } catch (error) {
        console.error(`[Health Check] Warmup error on instance ${instanceId}: ${error.message} (${requestId})`);
        res.status(500).send('Error during warmup');
    }
});

app.get('/_ah/start', async (req, res) => {
    const requestId = Math.random().toString(36).substring(7);
    console.log(`[Health Check] Start request received on instance ${instanceId} (${requestId})`);
    
    try {
        // Always try to initialize on start
        const START_TIMEOUT = 25000; // 25 seconds timeout for start
        console.log(`[Health Check] Starting initialization for start on instance ${instanceId} (${requestId})`);
        
        // If already initializing, wait for it
        if (state.isInitializing && state.initPromise) {
            console.log(`[Health Check] Waiting for in-progress initialization on instance ${instanceId} (${requestId})`);
            await state.initPromise;
        } else {
            // Start new initialization
            await initializeWithTimeout(START_TIMEOUT);
        }
        
        // Check final state
        if (state.isInitialized) {
            console.log(`[Health Check] Start completed successfully on instance ${instanceId} (${requestId})`);
            res.status(200).send('OK');
        } else {
            console.error(`[Health Check] Start failed - not initialized on instance ${instanceId} (${requestId})`);
            res.status(500).send('Not initialized');
        }
    } catch (error) {
        console.error(`[Health Check] Start error on instance ${instanceId}: ${error.message} (${requestId})`);
        res.status(500).send('Error during start');
    }
});

app.get('/_ah/live', (req, res) => {
    console.log('[Health Check] Liveness check received');
    res.status(200).send('OK');
});

app.get('/_ah/ready', (req, res) => {
    console.log('[Health Check] Ready check received');
    if (state.isInitialized) {
        console.log('[Health Check] Ready check passed');
        res.status(200).send('OK');
    } else {
        console.log('[Health Check] Ready check failed - not initialized');
        res.status(503).send('Not ready');
    }
});

// API Routes
app.use('/api/*', async (req, res, next) => {
    if (!state.isInitialized) {
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
    if (state.isInitializing) {
        try {
            await state.initPromise;
        } catch (error) {
            console.error('[Route] Error waiting for initialization:', error);
            return res.status(503).send('Service unavailable');
        }
    }
    
    // If not initialized, try to initialize
    if (!state.isInitialized) {
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
