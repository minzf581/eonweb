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

// Health check endpoints
app.get('/_ah/start', (req, res) => {
    console.log('[Health Check] Start request');
    res.status(200).send('OK');
});

app.get('/_ah/stop', (req, res) => {
    console.log('[Health Check] Stop request');
    res.status(200).send('OK');
});

app.get('/_ah/ready', (req, res) => {
    console.log('[Health Check] Ready check');
    res.status(200).send('OK');
});

app.get('/_ah/warmup', (req, res) => {
    console.log('[Health Check] Warmup request');
    res.status(200).send('OK');
});

// Serve static files
app.use(express.static('public'));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/referral', referralRoutes);
app.use('/api/tasks', tasksRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/points', pointsRoutes);

// Root route
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Error handling
app.use((err, req, res, next) => {
    console.error('[Error]', err);
    res.status(500).json({ error: 'Internal Server Error' });
});

// Start server
const port = process.env.PORT || 8081;
app.listen(port, async () => {
    try {
        await sequelize.authenticate();
        console.log('[Database] Connected');
        console.log(`[Server] Running on port ${port}`);
    } catch (error) {
        console.error('[Error] Database connection failed:', error);
    }
});

module.exports = app;
