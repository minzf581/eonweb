const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');
const authRoutes = require('./routes/auth');
const { router: referralRoutes } = require('./routes/referral');
const tasksRoutes = require('./routes/tasks');
const statsRoutes = require('./routes/stats');
const adminRoutes = require('./routes/admin');
const pointsRoutes = require('./routes/points');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

// Static file service
app.use(express.static(path.join(__dirname, 'public')));

// Health check endpoints with detailed logging
app.get('/_ah/start', (req, res) => {
    console.log('[Health Check] Received start request');
    res.status(200).send('OK');
});

app.get('/_ah/stop', (req, res) => {
    console.log('[Health Check] Received stop request');
    res.status(200).send('OK');
});

// Root route with error handling
app.get('/', (req, res, next) => {
    console.log('[Route] Serving index.html');
    const indexPath = path.join(__dirname, 'public', 'index.html');
    res.sendFile(indexPath, err => {
        if (err) {
            console.error('[Error] Failed to serve index.html:', err);
            next(err);
        } else {
            console.log('[Success] index.html served successfully');
        }
    });
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

// Start server first
const port = process.env.PORT || 8081;
const server = app.listen(port, () => {
    console.log(`[Server] Server is running on port ${port}`);
});

// Handle server shutdown gracefully
process.on('SIGTERM', () => {
    console.log('[Server] Received SIGTERM. Starting graceful shutdown...');
    server.close(() => {
        console.log('[Server] Server closed.');
        process.exit(0);
    });
});

// Then initialize database connection
const { sequelize } = require('./models');
sequelize.authenticate()
    .then(() => {
        console.log('[Database] Connection has been established successfully.');
    })
    .catch(err => {
        console.error('[Database] Unable to connect to the database:', err);
    });

module.exports = app;
