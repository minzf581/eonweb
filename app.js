const express = require('express');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const bodyParser = require('body-parser');

// 初始化数据库
const { sequelize, syncDatabase } = require('./models');
const { testConnection } = require('./config/database');

// 导入路由
const authRoutes = require('./routes/auth');
const companyRoutes = require('./routes/company');
const investorRoutes = require('./routes/investor');
const adminRoutes = require('./routes/admin');

// Initialize Express app
const app = express();
const port = process.env.PORT || 8081;

// 中间件
app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '50mb' }));

// 请求日志
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
    next();
});

// API 路由
app.use('/api/auth', authRoutes);
app.use('/api/company', companyRoutes);
app.use('/api/investor', investorRoutes);
app.use('/api/admin', adminRoutes);

// 健康检查
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Serve static files
console.log(`[Static] 配置静态文件服务`);
console.log(`[Static] 静态文件根目录: ${path.join(__dirname, 'public')}`);

// 上传文件静态服务（需要认证才能访问）
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// 添加静态文件中间件
app.use('/static', express.static(path.join(__dirname, 'public/static')));
app.use('/', express.static(path.join(__dirname, 'public')));

// Handle SPA routes
app.get('*', (req, res) => {
    // 跳过 API 路由
    if (req.path.startsWith('/api/')) {
        return res.status(404).json({ error: 'API endpoint not found' });
    }

    console.log(`[${new Date().toISOString()}][Static] Processing request path: ${req.path}`);
    
    // For company portal routes
    if (req.path.startsWith('/company')) {
        const companyPath = path.join(__dirname, 'public', 'company', 'index.html');
        if (fs.existsSync(companyPath)) {
            return sendFileWithErrorHandling(res, companyPath, 'company');
        }
    }

    // For investor portal routes
    if (req.path.startsWith('/investor')) {
        const investorPath = path.join(__dirname, 'public', 'investor', 'index.html');
        if (fs.existsSync(investorPath)) {
            return sendFileWithErrorHandling(res, investorPath, 'investor');
        }
    }

    // For dashboard routes, serve dashboard/index.html
    if (req.path.startsWith('/dashboard')) {
        const dashboardPath = path.join(__dirname, 'public', 'dashboard', 'index.html');
        if (fs.existsSync(dashboardPath)) {
            return sendFileWithErrorHandling(res, dashboardPath, 'dashboard');
        }
    }

    // For admin routes, serve admin/index.html
    if (req.path.startsWith('/admin')) {
        const adminPath = path.join(__dirname, 'public', 'admin', 'index.html');
        if (fs.existsSync(adminPath)) {
            return sendFileWithErrorHandling(res, adminPath, 'admin');
        }
    }

    // For auth routes, try to serve the exact file
    if (req.path.startsWith('/auth/')) {
        const authFile = path.join(__dirname, 'public', req.path);
        if (fs.existsSync(authFile)) {
            return sendFileWithErrorHandling(res, authFile, 'auth');
        }
    }

    // For root path or all other routes, serve index.html
    const indexPath = path.join(__dirname, 'public', 'index.html');
    
    try {
        if (fs.existsSync(indexPath)) {
            return sendFileWithErrorHandling(res, indexPath, 'index.html');
        } else {
            console.error(`[${new Date().toISOString()}][Static] index.html不存在: ${indexPath}`);
            res.status(404).json({ error: 'File not found' });
        }
    } catch (error) {
        console.error(`[${new Date().toISOString()}][Static] 检查文件时出错:`, error);
        if (!res.headersSent) {
            res.status(500).json({ error: 'Internal server error' });
        }
    }
});

// 统一的文件发送处理函数
function sendFileWithErrorHandling(res, filePath, name) {
    res.sendFile(filePath, (err) => {
        if (err) {
            // EPIPE 错误表示客户端断开连接，这是正常的，不需要处理
            if (err.code === 'EPIPE' || err.code === 'ECONNRESET') {
                console.log(`[${new Date().toISOString()}][Static] 客户端断开连接（${name}）`);
                return;
            }
            // 只有在响应未发送时才尝试发送错误响应
            if (!res.headersSent) {
                console.error(`[${new Date().toISOString()}][Static] 发送${name}失败:`, err);
                res.status(500).json({ error: 'Internal server error' });
            }
        }
    });
}

// Handle favicon.ico
app.get('/favicon.ico', (req, res) => {
    const faviconPath = path.join(__dirname, 'public', 'static', 'images', 'favicon.ico');
    if (fs.existsSync(faviconPath)) {
        res.sendFile(faviconPath);
    } else {
        res.status(204).end();
    }
});

// 错误处理中间件
app.use((err, req, res, next) => {
    console.error('[Error]', err);
    if (!res.headersSent) {
        res.status(500).json({ error: '服务器内部错误' });
    }
});

// 初始化数据库并启动服务器
const initializeApp = async () => {
    try {
        // 测试数据库连接
        const connected = await testConnection();
        if (connected) {
            // 同步数据库模型
            await syncDatabase(false); // false = 不强制重建表
            console.log('[Server] 数据库初始化完成');
        } else {
            console.warn('[Server] 数据库连接失败，将以无数据库模式运行');
        }
    } catch (error) {
        console.error('[Server] 初始化错误:', error);
    }
};

// 启动初始化
initializeApp();

// Start server
app.listen(port, () => {
    console.log(`[Server] 服务器运行在端口 ${port}`);
});

module.exports = app;
