// Load environment variables based on NODE_ENV
const dotenv = require('dotenv');
const envFile = process.env.NODE_ENV === 'production' ? '.env.production' : '.env';
dotenv.config({ path: envFile });
console.log('Loading environment from:', envFile);

const express = require('express');
const cors = require('cors');
const path = require('path');
const cookieParser = require('cookie-parser');
const compression = require('compression');
const bcryptjs = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Op } = require('sequelize');
const sequelize = require('./config/database');
const { User, Task, UserTask, PointHistory, Settings } = require('./models');
const authRoutes = require('./routes/auth');
const { router: referralRoutes } = require('./routes/referral');
const tasksRoutes = require('./routes/tasks');
const statsRoutes = require('./routes/stats');
const adminRoutes = require('./routes/admin');
const { authenticateToken, isAdmin } = require('./middleware/auth');
const crypto = require('crypto');
const appRoutes = require('./app');
const proxyRoutes = require('./routes/proxy');
const bandwidthRoutes = require('./routes/bandwidth');
const fs = require('fs');

const app = express();

// Force the server to use the PORT from environment variable
const PORT = parseInt(process.env.PORT || '8080', 10);
console.log('Starting server on port:', PORT);

// Health check endpoints BEFORE any other middleware
app.get('/_ah/start', (req, res) => {
    console.log('Received App Engine start request');
    res.status(200).send('OK');
});

app.get('/_ah/warmup', (req, res) => {
    console.log('Received App Engine warmup request');
    res.status(200).send('OK');
});

app.get('/_ah/health', (req, res) => {
    console.log('Received health check request');
    res.status(200).send('OK');
});

app.get('/_ah/stop', (req, res) => {
    console.log('Received App Engine stop request');
    res.status(200).send('OK');
    // Cleanup in the background
    cleanup().catch(err => {
        console.error('Failed to cleanup:', err);
    });
});

// 在应用程序开始处添加日志中间件
app.use((req, res, next) => {
  console.log('收到请求:', {
    method: req.method,
    path: req.path,
    headers: {
      'x-api-key': req.headers['x-api-key'],
      'authorization': req.headers['authorization']
    }
  });
  next();
});

// 先注册 API 路由
app.use('/api/auth', authRoutes);
app.use('/api/proxy', proxyRoutes);
app.use('/api/tasks', tasksRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/referral', referralRoutes);
app.use('/api/bandwidth', bandwidthRoutes);
app.use('/api/admin', adminRoutes);

// 最后注册通用路由
app.use('/', appRoutes);

// Separate initialization function
async function initializeApp() {
    try {
        // Request logging middleware
        app.use((req, res, next) => {
            const start = Date.now();
            res.on('finish', () => {
                const duration = Date.now() - start;
                console.log(`${req.method} ${req.url} ${res.statusCode} ${duration}ms`);
            });
            next();
        });

        // Middleware setup
        const corsOptions = {
            origin: [
                'http://localhost:8080',
                'http://localhost:3000',
                'https://eonhome-445809.et.r.appspot.com'
            ],
            methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
            allowedHeaders: ['Content-Type', 'Authorization'],
            credentials: true
        };

        app.use(cors(corsOptions));
        app.use(express.json());
        app.use(cookieParser());
        app.use(compression());

        // Configure static file serving
        const publicPath = path.join(__dirname, 'public');
        console.log('[Static] Serving static files from:', publicPath);

        // Serve static files from /static path
        app.use('/static', express.static(path.join(publicPath, 'static')));

        // Serve static files from root path
        app.use(express.static(publicPath));

        // Serve index.html for root path
        app.get('/', (req, res) => {
            console.log('[Route] Serving index.html for root path');
            const indexPath = path.join(publicPath, 'index.html');
            console.log('[Route] Sending index.html from:', indexPath);
            res.sendFile(indexPath, (err) => {
                if (err) {
                    console.error('[Route] Error sending index.html:', err);
                    res.status(500).send('Error loading index.html');
                } else {
                    console.log('[Route] Successfully served index.html');
                }
            });
        });

        // Handle SPA routing
        app.get('/*', (req, res) => {
            // Log the request
            console.log('[Route] Handling SPA route:', req.path);
            
            // First try to serve as a static file
            const staticPath = path.join(publicPath, req.path);
            if (fs.existsSync(staticPath) && fs.statSync(staticPath).isFile()) {
                console.log('[Static] Serving:', req.path);
                res.sendFile(staticPath);
                return;
            }
            
            // If not a static file, serve index.html
            console.log('[Route] Not found:', req.path);
            res.sendFile(path.join(publicPath, 'index.html'));
        });

        // Global error handler - place this after all routes
        app.use((err, req, res, next) => {
            console.error('Global error handler caught:', err);
            console.error('Error stack:', err.stack);
            res.status(500).json({
                error: 'Internal server error',
                message: process.env.NODE_ENV === 'development' ? err.message : undefined
            });
        });

        console.log('App initialization completed successfully');
    } catch (error) {
        console.error('Failed to initialize app:', error);
        throw error;
    }
}

// Cleanup function
async function cleanup() {
    try {
        await sequelize.close();
        console.log('Database connection closed successfully');
    } catch (error) {
        console.error('Error during cleanup:', error);
        throw error;
    }
}

// Get the database instance
const db = require('./models');

// Graceful shutdown handler
async function gracefulShutdown() {
    console.log('Starting graceful shutdown...');
    try {
        // Close database connections
        if (db.sequelize && db.sequelize.connectionManager) {
            await db.sequelize.connectionManager.close();
            console.log('Database connections closed successfully');
        }

        // Close server
        if (server) {
            server.close(() => {
                console.log('Server closed successfully');
                process.exit(0);
            });
        } else {
            process.exit(0);
        }
    } catch (error) {
        console.error('Error during shutdown:', error);
        process.exit(1);
    }
}

// Handle shutdown signals
process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
    console.error('Unhandled Exception:', error);
    gracefulShutdown();
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Promise Rejection:', reason);
    gracefulShutdown();
});

// 在启动服务器之前检查端口是否被占用
const net = require('net');
const server = net.createServer();
server.once('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.log(`Port ${PORT} is busy, trying ${PORT + 1}`);
    startServer(PORT + 1);
  }
});

server.once('listening', () => {
  server.close();
  startServer(PORT);
});

server.listen(PORT);

function startServer(port) {
  app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
  });
}

initializeApp();

// 在代理节点路由处添加
app.use('/api/proxy', (req, res, next) => {
  console.log('代理节点请求:', {
    method: req.method,
    path: req.path,
    body: req.body
  });
  next();
});

// 错误处理中间件
app.use((err, req, res, next) => {
  console.error('错误:', err);
  res.status(500).json({ success: false, message: err.message });
});

// 服务器启动时检查必要的环境变量
const requiredEnvVars = ['API_KEY', 'JWT_SECRET'];
requiredEnvVars.forEach(varName => {
  if (!process.env[varName]) {
    console.error(`错误: 环境变量 ${varName} 未设置`);
    process.exit(1);
  }
});

console.log('环境变量检查通过，API_KEY:', process.env.API_KEY);
