const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const morgan = require('morgan');
const path = require('path');
const fs = require('fs');
const { sequelize } = require('./models');

// 导入路由
const authRoutes = require('./routes/auth');
const { router: referralRoutes } = require('./routes/referral');
const tasksRoutes = require('./routes/tasks');
const statsRoutes = require('./routes/stats');
const adminRoutes = require('./routes/admin');
const pointsRoutes = require('./routes/points');
const proxyRoutes = require('./routes/proxy');
const usersRoutes = require('./routes/users');

// Constants
const INIT_TIMEOUT = 30000;
const INIT_MAX_RETRIES = 3;
const INIT_COOLDOWN = 5000;
const INSTANCE_FRESH_TIME = 240000;

// Generate instance ID
const instanceId = Math.random().toString(36).substring(7);
console.log(`[App] Starting instance ${instanceId}`);

// Initialize state tracking
const state = {
    serverStarted: false,
    startupComplete: false,
    isInitializing: false,
    isInitialized: false,
    instanceStartTime: Date.now(),
    initPromise: null,
    initAttempts: 0
};

// Initialize Express app
const app = express();
const port = process.env.PORT || 8081;

// Basic middleware
app.use(morgan(':method :url :status :response-time ms'));
app.use(bodyParser.json());
app.use(cors());

// Security middleware
app.use((req, res, next) => {
    // 阻止可疑的PHP文件请求
    if (req.path.endsWith('.php') || req.path.endsWith('.php7')) {
        console.log(`[${new Date().toISOString()}][Security] 阻止可疑请求: ${req.path}`);
        return res.status(403).json({ error: 'Access denied' });
    }

    // 阻止WordPress相关路径
    if (req.path.includes('/wp-') || req.path.includes('/wordpress')) {
        console.log(`[${new Date().toISOString()}][Security] 阻止WordPress相关请求: ${req.path}`);
        return res.status(403).json({ error: 'Access denied' });
    }

    next();
});

// API routes
const apiRouter = express.Router();
console.log(`[${new Date().toISOString()}][DEBUG] 开始注册 API 路由`);

// API路由调试中间件
apiRouter.use((req, res, next) => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}][DEBUG] API请求:`, {
        path: req.path,
        baseUrl: req.baseUrl,
        originalUrl: req.originalUrl,
        method: req.method,
        headers: {
            'x-api-key': req.headers['x-api-key'] ? '***' : undefined,
            'content-type': req.headers['content-type']
        },
        timestamp
    });
    next();
});

// API Routes middleware - check initialization
apiRouter.use(async (req, res, next) => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}][API] 请求 ${req.method} ${req.path}`, {
        isInitialized: state.isInitialized,
        isInitializing: state.isInitializing,
        serverStarted: state.serverStarted,
        startupComplete: state.startupComplete,
        initAttempts: state.initAttempts,
        instanceAge: Date.now() - state.instanceStartTime
    });
    
    if (!state.isInitialized) {
        try {
            console.log(`[${timestamp}][API] 服务未初始化，尝试初始化...`);
            const success = await initialize();
            if (!success) {
                console.error(`[${timestamp}][API] 服务未就绪 - 初始化失败`);
                return res.status(503).json({ 
                    error: 'Service unavailable',
                    details: '服务初始化失败'
                });
            }
            console.log(`[${timestamp}][API] 初始化成功`);
        } catch (error) {
            console.error(`[${timestamp}][API] 初始化过程出错:`, error);
            return res.status(503).json({ 
                error: 'Service unavailable',
                details: '初始化过程出错: ' + error.message
            });
        }
    }
    next();
});

// 注册各个模块的路由
console.log(`[${new Date().toISOString()}][DEBUG] 开始注册模块路由`);

// 获取路由信息的辅助函数
function getRouteInfo(router) {
    return router.stack
        .filter(layer => layer.route)
        .map(layer => ({
            path: layer.route.path,
            methods: Object.keys(layer.route.methods)
        }));
}

// 注册路由并记录信息
apiRouter.use('/auth', authRoutes);
console.log(`[${new Date().toISOString()}][DEBUG] 已注册 /api/auth 路由:`, getRouteInfo(authRoutes));

apiRouter.use('/referral', referralRoutes);
console.log(`[${new Date().toISOString()}][DEBUG] 已注册 /api/referral 路由:`, getRouteInfo(referralRoutes));

apiRouter.use('/tasks', tasksRoutes);
console.log(`[${new Date().toISOString()}][DEBUG] 已注册 /api/tasks 路由:`, getRouteInfo(tasksRoutes));

apiRouter.use('/stats', statsRoutes);
console.log(`[${new Date().toISOString()}][DEBUG] 已注册 /api/stats 路由:`, getRouteInfo(statsRoutes));

apiRouter.use('/admin', adminRoutes);
console.log(`[${new Date().toISOString()}][DEBUG] 已注册 /api/admin 路由:`, getRouteInfo(adminRoutes));

apiRouter.use('/points', pointsRoutes);
console.log(`[${new Date().toISOString()}][DEBUG] 已注册 /api/points 路由:`, getRouteInfo(pointsRoutes));

apiRouter.use('/proxy', proxyRoutes);
console.log(`[${new Date().toISOString()}][DEBUG] 已注册 /api/proxy 路由:`, getRouteInfo(proxyRoutes));

apiRouter.use('/users', usersRoutes);
console.log(`[${new Date().toISOString()}][DEBUG] 已注册 /api/users 路由:`, getRouteInfo(usersRoutes));

console.log(`[${new Date().toISOString()}][DEBUG] 模块路由注册完成`);

// 将API路由器挂载到/api路径
app.use('/api', apiRouter);
console.log(`[${new Date().toISOString()}][DEBUG] API路由已挂载到 /api 路径`);

// 打印最终路由配置
console.log(`[${new Date().toISOString()}][DEBUG] 最终路由配置:`, {
    api: app._router.stack
        .filter(layer => layer.name === 'router')
        .map(layer => ({
            name: layer.name,
            regexp: layer.regexp.toString(),
            path: layer.regexp.toString().replace('/^\\/?(?=\\/|$)/i', '')
        }))
});

// Serve static files
console.log(`[${new Date().toISOString()}][Static] 配置静态文件服务`);
console.log(`[${new Date().toISOString()}][Static] 静态文件根目录: ${path.join(__dirname, 'public')}`);

// 添加静态文件中间件
app.use('/static', (req, res, next) => {
    console.log(`[${new Date().toISOString()}][Static] Accessing root path: ${req.path}`);
    next();
}, express.static(path.join(__dirname, 'public/static')));

app.use('/', (req, res, next) => {
    console.log(`[${new Date().toISOString()}][Static] Accessing root path: ${req.path}`);
    next();
}, express.static(path.join(__dirname, 'public')));

// Handle SPA routes
app.get('*', (req, res) => {
    console.log(`[${new Date().toISOString()}][Static] Processing request path: ${req.path}`);
    
    // Skip API routes
    if (req.path.startsWith('/api/')) {
        console.log(`[${new Date().toISOString()}][Static] API路由未找到: ${req.path}`);
        res.status(404).json({ error: 'API endpoint not found' });
        return;
    }

    // For dashboard routes, serve dashboard/index.html
    if (req.path.startsWith('/dashboard')) {
        const dashboardPath = path.join(__dirname, 'public', 'dashboard', 'index.html');
        console.log(`[${new Date().toISOString()}][Static] 尝试提供dashboard页面: ${dashboardPath}`);
        if (fs.existsSync(dashboardPath)) {
            console.log(`[${new Date().toISOString()}][Static] 找到dashboard页面`);
            res.sendFile(dashboardPath);
            return;
        }
        console.log(`[${new Date().toISOString()}][Static] dashboard页面不存在`);
    }

    // For admin routes, serve admin/index.html
    if (req.path.startsWith('/admin')) {
        const adminPath = path.join(__dirname, 'public', 'admin', 'index.html');
        console.log(`[${new Date().toISOString()}][Static] 尝试访问管理员页面:`, {
            path: req.path,
            adminPath,
            exists: fs.existsSync(adminPath),
            headers: req.headers,
            method: req.method
        });
        if (fs.existsSync(adminPath)) {
            console.log(`[${new Date().toISOString()}][Static] 找到admin页面，准备发送`);
            res.sendFile(adminPath, (err) => {
                if (err) {
                    console.error(`[${new Date().toISOString()}][Static] 发送admin页面失败:`, err);
                    res.status(500).json({ error: 'Internal server error' });
                } else {
                    console.log(`[${new Date().toISOString()}][Static] 成功发送admin页面`);
                }
            });
            return;
        }
        console.log(`[${new Date().toISOString()}][Static] admin页面不存在`);
    }

    // For auth routes, try to serve the exact file
    if (req.path.startsWith('/auth/')) {
        const authFile = path.join(__dirname, 'public', req.path);
        console.log(`[${new Date().toISOString()}][Static] 尝试提供auth文件: ${authFile}`);
        if (fs.existsSync(authFile)) {
            console.log(`[${new Date().toISOString()}][Static] 找到auth文件`);
            res.sendFile(authFile);
            return;
        }
        console.log(`[${new Date().toISOString()}][Static] auth文件不存在`);
    }

    // For root path or all other routes, serve index.html
    const indexPath = path.join(__dirname, 'public', 'index.html');
    console.log(`[${new Date().toISOString()}][Static] Attempting to serve default page: ${indexPath}`);
    
    try {
        if (fs.existsSync(indexPath)) {
            console.log(`[${new Date().toISOString()}][Static] 找到index.html`);
            res.sendFile(indexPath, (err) => {
                if (err) {
                    console.error(`[${new Date().toISOString()}][Static] 发送文件错误:`, err);
                    res.status(500).json({ error: 'Internal server error' });
                }
            });
        } else {
            console.error(`[${new Date().toISOString()}][Static] index.html不存在: ${indexPath}`);
            res.status(404).json({ error: 'File not found' });
        }
    } catch (error) {
        console.error(`[${new Date().toISOString()}][Static] 检查文件时出错:`, error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Health check endpoints - register these before any middleware
app.get('/_ah/warmup', async (req, res, next) => {
    const requestId = Math.random().toString(36).substring(7);
    
    try {
        console.log(`[Health Check] Warmup request received on instance ${instanceId} (${requestId})`);
        
        // Always respond with 200 immediately
        res.status(200).send('Warmup acknowledged');
        
        // Perform warmup tasks asynchronously
        setImmediate(async () => {
            try {
                if (!state.serverStarted) {
                    console.log(`[Health Check] Early warmup received before server start on instance ${instanceId} (${requestId})`);
                    return;
                }

                if (!state.startupComplete) {
                    console.log(`[Health Check] Warmup received during startup on instance ${instanceId} (${requestId})`);
                    return;
                }

                const instanceAge = Date.now() - state.instanceStartTime;
                if (state.isInitialized && instanceAge < INSTANCE_FRESH_TIME) {
                    console.log(`[Health Check] Warmup skipped - already initialized and fresh on instance ${instanceId} (${requestId})`);
                    return;
                }

                if (state.isInitializing && state.initPromise) {
                    console.log(`[Health Check] Waiting for in-progress initialization on instance ${instanceId} (${requestId})`);
                    await state.initPromise;
                    return;
                }

                console.log(`[Health Check] Starting initialization for warmup on instance ${instanceId} (${requestId})`);
                await initializeWithTimeout(INIT_TIMEOUT);
                console.log(`[Health Check] Warmup tasks completed on instance ${instanceId} (${requestId})`);
            } catch (error) {
                console.error(`[Health Check] Async warmup error on instance ${instanceId}: ${error.message} (${requestId})`);
            }
        });
    } catch (error) {
        console.error(`[Health Check] Warmup handler error on instance ${instanceId}: ${error.message}`);
        next(error);
    }
});

app.get('/_ah/start', async (req, res) => {
    const requestId = Math.random().toString(36).substring(7);
    console.log(`[Health Check] Start request received on instance ${instanceId} (${requestId})`);
    
    // Send an immediate 200 response to prevent timeout
    res.status(200).send('Starting');
    
    try {
        // If server hasn't started yet, just log and return
        if (!state.serverStarted) {
            console.log(`[Health Check] Early start received before server start on instance ${instanceId} (${requestId})`);
            return;
        }
        
        // If startup is not complete, just log and return
        if (!state.startupComplete) {
            console.log(`[Health Check] Start received during startup on instance ${instanceId} (${requestId})`);
            return;
        }
        
        // If already initialized and instance is fresh, just log and return
        const instanceAge = Date.now() - state.instanceStartTime;
        if (state.isInitialized && instanceAge < INSTANCE_FRESH_TIME) {
            console.log(`[Health Check] Start skipped - already initialized and fresh on instance ${instanceId} (${requestId})`);
            return;
        }
        
        // If already initializing, wait for it
        if (state.isInitializing && state.initPromise) {
            console.log(`[Health Check] Waiting for in-progress initialization on instance ${instanceId} (${requestId})`);
            await state.initPromise;
            if (state.isInitialized) {
                console.log(`[Health Check] Start completed - initialization finished on instance ${instanceId} (${requestId})`);
                return;
            }
        }
        
        // Try to initialize
        console.log(`[Health Check] Starting initialization for start on instance ${instanceId} (${requestId})`);
        const success = await initializeWithTimeout(INIT_TIMEOUT);
        
        if (success) {
            console.log(`[Health Check] Start completed successfully on instance ${instanceId} (${requestId})`);
        } else {
            console.error(`[Health Check] Start failed - initialization failed on instance ${instanceId} (${requestId})`);
        }
    } catch (error) {
        console.error(`[Health Check] Start error on instance ${instanceId}: ${error.message} (${requestId})`);
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

// Handle favicon.ico
app.get('/favicon.ico', (req, res) => {
    const faviconPath = path.join(__dirname, 'public', 'favicon.ico');
    console.log(`[Static] Serving favicon from: ${faviconPath}`);
    res.sendFile(faviconPath, err => {
        if (err) {
            console.warn('[Static] Favicon not found:', err.message);
            res.status(404).end();
        }
    });
});

// Initialize application with timeout
const initializeWithTimeout = async (timeout) => {
    const now = Date.now();
    
    try {
        // Add cooldown between retries
        const timeSinceLastInit = now - state.instanceStartTime;
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
    if (state.isInitialized && instanceAge < INSTANCE_FRESH_TIME) {
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
    state.instanceStartTime = now;
    
    state.initPromise = (async () => {
        try {
            console.log(`[Initialize] Starting initialization on instance ${instanceId} (attempt ${state.initAttempts + 1} of ${INIT_MAX_RETRIES})`);
            
            // Test database connection
            await sequelize.authenticate();
            console.log(`[Database] Connected successfully on instance ${instanceId}`);
            
            state.isInitialized = true;
            state.initAttempts = 0;
            console.log(`[Initialize] Initialization completed successfully on instance ${instanceId}`);
            return true;
        } catch (error) {
            console.error(`[Initialize] Error during initialization on instance ${instanceId}:`, error);
            
            // Increment retry count and check if we should retry
            state.initAttempts++;
            if (state.initAttempts < INIT_MAX_RETRIES) {
                console.log(`[Initialize] Will retry initialization on instance ${instanceId}`);
                return false;
            } else {
                console.error(`[Initialize] Max retries reached on instance ${instanceId}, giving up`);
                state.initAttempts = 0;
                throw error;
            }
        } finally {
            state.isInitializing = false;
            state.initPromise = null;
        }
    })();

    return state.initPromise;
};

initialize()
    .then(() => {
        console.log(`[App] Initialization complete on instance ${instanceId}`);
        state.isInitialized = true;
        state.isInitializing = false;
    })
    .catch(error => {
        console.error(`[App] Initialization failed on instance ${instanceId}:`, error);
        state.isInitializing = false;
        process.exit(1);
    });

module.exports = app;
