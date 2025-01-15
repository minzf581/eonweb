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
const { sequelize } = require('./models');
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
const PORT = parseInt(process.env.PORT || '8080', 10);

// 在最开始添加请求日志中间件
app.use((req, res, next) => {
  console.log('[DEBUG] 收到请求:', {
    method: req.method,
    path: req.path,
    headers: {
      'x-api-key': req.headers['x-api-key'],
      'content-type': req.headers['content-type']
    },
    body: req.body,
    query: req.query,
    params: req.params
  });
  next();
});

// Health check endpoints
app.get('/_ah/start', (req, res) => {
  console.log('[DEBUG] 收到启动检查请求');
  res.status(200).send('Ok');
});

app.get('/_ah/health', (req, res) => {
  console.log('[DEBUG] 收到健康检查请求');
  res.status(200).send('Ok');
});

// 添加基础中间件
console.log('[DEBUG] 注册基础中间件');
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(compression());
app.use(cors());

// 注册所有 API 路由
console.log('[DEBUG] 开始注册 API 路由');
console.log('[DEBUG] proxyRoutes:', Object.keys(proxyRoutes));
console.log('[DEBUG] authRoutes:', Object.keys(authRoutes));

app.use('/api/auth', authRoutes);
app.use('/api/proxy', proxyRoutes);
app.use('/api/tasks', tasksRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/referral', referralRoutes);
app.use('/api/bandwidth', bandwidthRoutes);
app.use('/api/admin', adminRoutes);
console.log('[DEBUG] API 路由注册完成');

// 最后注册通用路由
app.use('/', appRoutes);

// 404 处理
app.use((req, res) => {
  console.log('[DEBUG] 404 处理触发:', {
    path: req.path,
    method: req.method,
    headers: {
      'x-api-key': req.headers['x-api-key'],
      'content-type': req.headers['content-type']
    }
  });
  res.status(404).json({ 
    success: false, 
    message: 'API endpoint not found',
    path: req.path
  });
});

// 错误处理
app.use((err, req, res, next) => {
  console.error('[DEBUG] 错误处理触发:', {
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method
  });
  res.status(500).json({ success: false, message: err.message });
});

console.log('Starting server on port:', PORT);

// 服务器启动时检查必要的环境变量
console.log('[DEBUG] 开始检查环境变量');
const requiredEnvVars = ['API_KEY', 'JWT_SECRET'];
requiredEnvVars.forEach(varName => {
  if (!process.env[varName]) {
    console.error(`[DEBUG] 环境变量 ${varName} 未设置`);
    process.exit(1);
  }
});

console.log('环境变量检查通过，API_KEY:', process.env.API_KEY);

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
    console.log(`[DEBUG] 服务器启动在端口 ${port}`);
    console.log('[DEBUG] 当前注册的路由:', app._router.stack
      .filter(r => r.route)
      .map(r => ({
        path: r.route.path,
        methods: Object.keys(r.route.methods)
      }))
    );
  });
}

// 初始化应用
async function initializeApp() {
  try {
    console.log('[DEBUG] 开始初始化应用');
    // 验证数据库连接
    if (!sequelize || typeof sequelize.authenticate !== 'function') {
      throw new Error('数据库实例未正确初始化');
    }
    // 连接数据库
    await sequelize.authenticate();
    console.log('[DEBUG] 数据库连接成功');
    
    console.log('[DEBUG] 应用初始化完成');
  } catch (error) {
    console.error('[DEBUG] 应用初始化失败:', error);
    throw error;
  }
}

initializeApp();
