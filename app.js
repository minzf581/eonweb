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

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

// Health check endpoints
app.get('/_ah/start', (req, res) => {
    console.log('[Health Check] Start request received');
    res.status(200).send('OK');
});

app.get('/_ah/stop', (req, res) => {
    console.log('[Health Check] Stop request received');
    res.status(200).send('OK');
});

app.get('/_ah/ready', (req, res) => {
    console.log('[Health Check] Ready check received');
    if (!isReady) {
        console.log('[Health Check] Application not ready');
        res.status(503).json({ status: 'not ready' });
        return;
    }
    res.status(200).json({ status: 'ready' });
});

app.get('/_ah/warmup', async (req, res) => {
    console.log('[Warmup] Request received');
    try {
        await sequelize.authenticate();
        console.log('[Warmup] Database connected');
        isReady = true;
        res.status(200).send('OK');
    } catch (error) {
        console.error('[Warmup] Error:', error);
        res.status(500).json({ error: 'Warmup failed' });
    }
});

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/referral', referralRoutes);
app.use('/api/tasks', tasksRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/points', pointsRoutes);

// Root route
app.get('/', (req, res) => {
    if (!isReady) {
        res.status(503).json({ error: 'Service unavailable' });
        return;
    }
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
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
        // Connect to database
        await sequelize.authenticate();
        console.log('[Database] Connected successfully');
        
        // Start HTTP server
        app.listen(port, () => {
            console.log(`[Server] Running on port ${port}`);
            isReady = true;
        });
    } catch (error) {
        console.error('[Startup] Error:', error);
        process.exit(1);
    }
};

startServer();

module.exports = app;
