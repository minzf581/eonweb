const express = require('express');
const app = express();

// Health check endpoints
app.get('/_ah/start', (req, res) => {
    console.log('Received App Engine start request');
    res.status(200).send('OK');
});

app.get('/_ah/stop', (req, res) => {
    console.log('Received App Engine stop request');
    res.status(200).send('OK');
});

// Start health check server on a different port
const HEALTH_PORT = process.env.HEALTH_PORT || 8082;
app.listen(HEALTH_PORT, () => {
    console.log(`Health check server running on port ${HEALTH_PORT}`);
});
