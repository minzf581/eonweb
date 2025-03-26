const express = require('express');
const path = require('path');
const fs = require('fs');

// Initialize Express app
const app = express();
const port = process.env.PORT || 8081;

// Serve static files
console.log(`[Static] 配置静态文件服务`);
console.log(`[Static] 静态文件根目录: ${path.join(__dirname, 'public')}`);

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

// Start server
app.listen(port, () => {
    console.log(`[Server] 服务器运行在端口 ${port}`);
});

module.exports = app;
