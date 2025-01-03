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
const port = process.env.PORT || 8081;

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
    instanceStartTime: Date.now(),
    startupComplete: false,
    serverStarted: false
};

// Constants
const INIT_TIMEOUT = 30000; // 30 seconds timeout
const INIT_COOLDOWN = 5000; // 5 seconds cooldown between retries
const MAX_INIT_RETRIES = 3;
const STARTUP_TIMEOUT = 25000; // 25 seconds for startup

// Health check endpoints - register these first
app.get('/_ah/warmup', async (req, res) => {
    const requestId = Math.random().toString(36).substring(7);
    console.log(`[Health Check] Warmup request received on instance ${instanceId} (${requestId})`);
    
    try {
        // If server hasn't started yet, return 200 immediately
        if (!state.serverStarted) {
            console.log(`[Health Check] Early warmup received before server start on instance ${instanceId} (${requestId})`);
            return res.status(200).send('Starting');
        }
        
        // If startup is not complete, return 200 to allow instance to continue starting
        if (!state.startupComplete) {
            console.log(`[Health Check] Warmup received during startup on instance ${instanceId} (${requestId})`);
            return res.status(200).send('Starting');
        }
        
        // If already initialized and instance is fresh, return success
        const instanceAge = Date.now() - state.instanceStartTime;
        if (state.isInitialized && instanceAge < 240000) {
            console.log(`[Health Check] Warmup skipped - already initialized and fresh on instance ${instanceId} (${requestId})`);
            return res.status(200).send('OK');
        }
        
        // If already initializing, wait for it
        if (state.isInitializing && state.initPromise) {
            console.log(`[Health Check] Waiting for in-progress initialization on instance ${instanceId} (${requestId})`);
            await state.initPromise;
            if (state.isInitialized) {
                console.log(`[Health Check] Warmup completed - initialization finished on instance ${instanceId} (${requestId})`);
                return res.status(200).send('OK');
            }
        }
        
        // Try to initialize
        console.log(`[Health Check] Starting initialization for warmup on instance ${instanceId} (${requestId})`);
        const success = await initializeWithTimeout(STARTUP_TIMEOUT);
        
        if (success) {
            console.log(`[Health Check] Warmup completed successfully on instance ${instanceId} (${requestId})`);
            res.status(200).send('OK');
        } else {
            console.error(`[Health Check] Warmup failed - initialization failed on instance ${instanceId} (${requestId})`);
            res.status(500).send('Initialization failed');
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
        // If server hasn't started yet, return 200 immediately
        if (!state.serverStarted) {
            console.log(`[Health Check] Early start received before server start on instance ${instanceId} (${requestId})`);
            return res.status(200).send('Starting');
        }
        
        // If startup is not complete, return 200 to allow instance to continue starting
        if (!state.startupComplete) {
            console.log(`[Health Check] Start received during startup on instance ${instanceId} (${requestId})`);
            return res.status(200).send('Starting');
        }
        
        // If already initialized and instance is fresh, return success
        const instanceAge = Date.now() - state.instanceStartTime;
        if (state.isInitialized && instanceAge < 240000) {
            console.log(`[Health Check] Start skipped - already initialized and fresh on instance ${instanceId} (${requestId})`);
            return res.status(200).send('OK');
        }
        
        // If already initializing, wait for it
        if (state.isInitializing && state.initPromise) {
            console.log(`[Health Check] Waiting for in-progress initialization on instance ${instanceId} (${requestId})`);
            await state.initPromise;
            if (state.isInitialized) {
                console.log(`[Health Check] Start completed - initialization finished on instance ${instanceId} (${requestId})`);
                return res.status(200).send('OK');
            }
        }
        
        // Try to initialize
        console.log(`[Health Check] Starting initialization for start on instance ${instanceId} (${requestId})`);
        const success = await initializeWithTimeout(STARTUP_TIMEOUT);
        
        if (success) {
            console.log(`[Health Check] Start completed successfully on instance ${instanceId} (${requestId})`);
            res.status(200).send('OK');
        } else {
            console.error(`[Health Check] Start failed - initialization failed on instance ${instanceId} (${requestId})`);
            res.status(500).send('Initialization failed');
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

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

// Static files
const publicPath = path.join(__dirname, 'public');

// Start server
const server = app.listen(port, () => {
    console.log(`[Server] Running on port ${port}`);
    state.serverStarted = true;
    
    // Start initialization after server is listening
    (async () => {
        try {
            console.log(`[Startup] Beginning startup sequence on instance ${instanceId}`);
            const success = await initializeWithTimeout(STARTUP_TIMEOUT);
            if (success) {
                console.log(`[Startup] Initial startup completed successfully on instance ${instanceId}`);
            } else {
                console.error(`[Startup] Initial startup failed on instance ${instanceId}`);
            }
        } catch (error) {
            console.error(`[Startup] Error during startup on instance ${instanceId}:`, error);
        } finally {
            state.startupComplete = true;
        }
    })();
});

// Serve static files first
app.use(express.static(publicPath, {
    index: false,
    extensions: ['html'],
    fallthrough: true
}));

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

module.exports = app;
