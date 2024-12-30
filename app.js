const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const authRoutes = require('./routes/auth');
const { router: referralRoutes } = require('./routes/referral');
const tasksRoutes = require('./routes/tasks');
const statsRoutes = require('./routes/stats');
const adminRoutes = require('./routes/admin');
const pointsRoutes = require('./routes/points');
const http = require('http');

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

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({
        message: 'Something broke!',
        error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});

// Create a bare minimum server just for health checks
const server = http.createServer((req, res) => {
    if (req.url === '/_ah/start') {
        console.log('Received App Engine start request');
        res.writeHead(200);
        res.end('OK');
        
        // Start the main application in the background
        require('./app');
    } 
    else if (req.url === '/_ah/stop') {
        console.log('Received App Engine stop request');
        res.writeHead(200);
        res.end('OK');
    }
    else {
        // Forward all other requests to the main application
        require('./app');
        res.writeHead(404);
        res.end();
    }
});

const port = process.env.PORT || 8081;
server.listen(port, () => {
    console.log(`Health check server listening on port ${port}`);
});

module.exports = app;
