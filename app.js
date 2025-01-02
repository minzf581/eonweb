const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const authRoutes = require('./routes/auth');
const { router: referralRoutes } = require('./routes/referral');
const tasksRoutes = require('./routes/tasks');
const statsRoutes = require('./routes/stats');
const adminRoutes = require('./routes/admin');
const pointsRoutes = require('./routes/points');

const app = express();

// Enable CORS
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Origin', 'X-Requested-With', 'Content-Type', 'Accept', 'Authorization', 'X-API-Key']
}));

// Logging middleware
app.use(morgan('dev'));

// Parse JSON request body
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static file service
app.use(express.static('public'));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/referral', referralRoutes);
app.use('/api/tasks', tasksRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/points', pointsRoutes);

// App Engine health checks
app.get('/_ah/start', (req, res) => {
    console.log('Received App Engine start request');
    res.status(200).send('OK');
});

app.get('/_ah/stop', (req, res) => {
    console.log('Received App Engine stop request');
    res.status(200).send('OK');
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({
        message: 'Something broke!',
        error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});

module.exports = app;

// Create server and listen
const port = process.env.PORT || 8081;
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
