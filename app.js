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

// 请求日志（含响应跟踪）
app.use((req, res, next) => {
    const startTime = Date.now();
    const requestId = Math.random().toString(36).substring(7);
    
    console.log(`[${new Date().toISOString()}] [${requestId}] ${req.method} ${req.path} - 开始`);
    
    // 记录响应完成
    res.on('finish', () => {
        const duration = Date.now() - startTime;
        console.log(`[${new Date().toISOString()}] [${requestId}] ${req.method} ${req.path} - 完成 ${res.statusCode} (${duration}ms)`);
    });
    
    // 记录响应关闭（可能是客户端断开）
    res.on('close', () => {
        if (!res.writableFinished) {
            const duration = Date.now() - startTime;
            console.log(`[${new Date().toISOString()}] [${requestId}] ${req.method} ${req.path} - 连接关闭（未完成） (${duration}ms)`);
        }
    });
    
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
            
            // 自动创建默认管理员账户
            await createDefaultAdmin();
        } else {
            console.warn('[Server] 数据库连接失败，将以无数据库模式运行');
        }
    } catch (error) {
        console.error('[Server] 初始化错误:', error);
    }
};

// 创建或更新默认管理员账户
const createDefaultAdmin = async () => {
    try {
        const { User } = require('./models');
        const bcrypt = require('bcryptjs');
        
        const adminEmail = process.env.ADMIN_EMAIL || 'admin@eonprotocol.com';
        const adminPassword = process.env.ADMIN_PASSWORD || 'admin123456';
        
        console.log(`[Server] 检查管理员账户: ${adminEmail}`);
        
        // 检查管理员是否已存在
        let admin = await User.findOne({ where: { email: adminEmail } });
        
        if (!admin) {
            // 创建管理员账户 - 注意：User 模型的 beforeCreate hook 会自动哈希密码
            admin = await User.create({
                email: adminEmail,
                password: adminPassword,
                role: 'admin',
                status: 'active',
                name: 'Administrator'
            });
            console.log(`[Server] 默认管理员账户已创建: ${adminEmail}`);
            console.log(`[Server] 管理员密码: ${adminPassword.substring(0, 2)}****`);
        } else {
            // 检查是否需要更新密码（如果环境变量中的密码与数据库不同）
            // 同时确保角色是 admin 且状态是 active
            if (admin.role !== 'admin' || admin.status !== 'active') {
                await admin.update({ role: 'admin', status: 'active' });
                console.log(`[Server] 管理员账户权限已更新: ${adminEmail}`);
            }
            
            // 如果设置了 ADMIN_PASSWORD 环境变量，重置密码
            if (process.env.ADMIN_PASSWORD) {
                // 验证当前密码是否与环境变量中的一致
                const isCurrentPassword = await admin.validatePassword(adminPassword);
                if (!isCurrentPassword) {
                    // 密码不一致，更新为环境变量中的密码
                    admin.password = adminPassword;
                    await admin.save();
                    console.log(`[Server] 管理员密码已更新为环境变量设置`);
                } else {
                    console.log(`[Server] 管理员账户已存在且密码正确: ${adminEmail}`);
                }
            } else {
                console.log(`[Server] 管理员账户已存在: ${adminEmail}`);
            }
        }
        
        // 验证创建/更新的管理员能否正常登录
        const testLogin = await admin.validatePassword(adminPassword);
        console.log(`[Server] 管理员登录验证: ${testLogin ? '成功' : '失败'}`);
        
        if (!testLogin) {
            console.error('[Server] 警告：管理员密码验证失败！可能是密码哈希问题。');
            console.log('[Server] 尝试强制更新密码...');
            // 强制更新密码
            const hashedPassword = await bcrypt.hash(adminPassword, 10);
            await User.update(
                { password: hashedPassword },
                { where: { id: admin.id }, hooks: false } // hooks: false 避免重复哈希
            );
            console.log('[Server] 管理员密码已强制更新');
        }
        
    } catch (error) {
        console.error('[Server] 创建/更新管理员账户失败:', error.message);
        console.error('[Server] 错误详情:', error.stack);
    }
};

// 启动初始化
initializeApp();

// Start server
app.listen(port, () => {
    console.log(`[Server] 服务器运行在端口 ${port}`);
});

module.exports = app;
