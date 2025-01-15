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
const auth = require('./middleware/auth');
const crypto = require('crypto');
const appRoutes = require('./app');
const proxyModule = require('./routes/proxy');
const bandwidthRoutes = require('./routes/bandwidth');
const fs = require('fs');

const app = express();
const PORT = parseInt(process.env.PORT || '8080', 10);

// 创建一个 Promise 来追踪应用初始化状态
let appInitialized = false;
const initializationPromise = new Promise((resolve, reject) => {
  app.initializeApp = resolve;
  app.initializationFailed = reject;
});

// 初始化应用
async function initializeApp() {
  try {
    console.log('[DEBUG] 开始初始化应用');
    
    // 添加等待初始化的中间件
    app.use(async (req, res, next) => {
      if (!appInitialized) {
        console.log('[DEBUG] 等待应用初始化完成...');
        try {
          await initializationPromise;
          console.log('[DEBUG] 应用初始化已完成，继续处理请求');
        } catch (error) {
          console.error('[DEBUG] 应用初始化失败:', error);
          return res.status(503).json({
            success: false,
            message: 'Application is initializing',
            requestId: req.requestId
          });
        }
      }
      next();
    });
    
    // 先连接数据库
    await new Promise((resolve, reject) => {
      const maxAttempts = 5;
      let attempts = 0;
      
      const tryConnect = async () => {
        try {
          await sequelize.authenticate();
          console.log('[DEBUG] 数据库连接成功');
          resolve();
        } catch (error) {
          attempts++;
          if (attempts >= maxAttempts) {
            reject(new Error(`数据库连接失败，已重试 ${attempts} 次: ${error.message}`));
          } else {
            console.log(`[DEBUG] 数据库连接失败，${attempts} 次重试: ${error.message}`);
            setTimeout(tryConnect, 1000);
          }
        }
      };
      
      tryConnect();
    });
    
    // 先注册基础中间件
    console.log('[DEBUG] 注册基础中间件');
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));
    app.use(cookieParser());
    app.use(compression());
    app.use(cors());
    
    app.use((req, res, next) => {
      req.requestId = crypto.randomBytes(4).toString('hex');
      req.startTime = Date.now();
      req.requestPath = [];  // 用于追踪请求经过的路径
      
      console.log('[DEBUG] 收到请求:', {
        requestId: req.requestId,
        method: req.method,
        path: req.path,
        headers: {
          'x-api-key': req.headers['x-api-key'],
          'content-type': req.headers['content-type']
        },
        query: req.query,
        body: req.body
      });
      
      // 监听请求结束
      res.on('finish', () => {
        console.log('[DEBUG] 请求处理完成:', {
          requestId: req.requestId,
          method: req.method,
          path: req.path,
          statusCode: res.statusCode,
          duration: Date.now() - req.startTime,
          requestPath: req.requestPath
        });
      });
      
      next();
    });
    
    // 注册健康检查路由
    app.get('/_ah/start', (req, res) => {
      console.log('[DEBUG] 收到启动检查请求');
      res.status(200).send('Ok');
    });
    
    app.get('/_ah/health', (req, res) => {
      console.log('[DEBUG] 收到健康检查请求');
      res.status(200).send('Ok');
    });
    
    // 创建一个新的路由器来处理所有 API 请求
    console.log('[DEBUG] 开始注册 API 路由');
    const apiRouter = express.Router();
    
    // 注册基础中间件
    apiRouter.use(express.json());
    apiRouter.use(express.urlencoded({ extended: true }));
    
    // 注册代理路由
    console.log('[DEBUG] 注册代理路由');
    if (!proxyModule.router) {
      console.error('[DEBUG] 代理路由器未定义');
      throw new Error('代理路由器未定义');
    }
    
    console.log('[DEBUG] 代理路由配置:', {
      stack: proxyModule.router.stack.map(r => ({
        path: r.route?.path,
        methods: r.route?.methods
      }))
    });
    
    // 将代理路由器注册到 API 路由器
    console.log('[DEBUG] 将代理路由器注册到 API 路由器');
    apiRouter.use('/proxy', proxyModule.router);
    
    // 注册其他路由到 API 路由器
    apiRouter.use('/auth', authRoutes);
    apiRouter.use('/tasks', tasksRoutes);
    apiRouter.use('/stats', statsRoutes);
    apiRouter.use('/referral', referralRoutes);
    apiRouter.use('/bandwidth', bandwidthRoutes);
    apiRouter.use('/admin', adminRoutes);
    
    // 将 API 路由器注册到应用
    app.use('/api', apiRouter);
    
    // 注册 404 处理
    app.use((req, res) => {
      req.requestPath.push({
        stage: '404Handler',
        timestamp: Date.now(),
        path: req.path,
        baseUrl: req.baseUrl
      });
      
      console.log('[DEBUG] 404 处理触发:', {
        requestId: req.requestId,
        path: req.path,
        method: req.method,
        headers: {
          'x-api-key': req.headers['x-api-key'],
          'content-type': req.headers['content-type']
        },
        requestPath: req.requestPath,
        matchAttempts: app._router.stack
          .filter(r => r.route || r.name === 'router')
          .map(r => {
            const regexp = r.regexp || (r.route && new RegExp(r.route.path));
            return {
              type: r.route ? 'route' : 'middleware',
              path: r.route?.path || r.regexp?.toString(),
              matched: regexp ? regexp.test(req.path) : false,
              methods: r.route?.methods || {},
              methodMatched: r.route ? r.route.methods[req.method.toLowerCase()] : null
            };
          })
      });
      res.status(404).json({
        success: false,
        message: 'API endpoint not found',
        path: req.path,
        requestId: req.requestId
      });
    });
    
    // 注册错误处理
    app.use((err, req, res, next) => {
      console.error('[DEBUG] 错误处理触发:', {
        requestId: req.requestId,
        error: err.message,
        stack: err.stack,
        path: req.path
      });
      res.status(500).json({
        success: false,
        message: err.message,
        requestId: req.requestId
      });
    });
    
    // 启动服务器
    const port = await new Promise((resolve, reject) => {
      const tryPort = (p) => {
        const server = app.listen(p, () => {
          console.log(`[DEBUG] 服务器启动在端口 ${p}`);
          resolve(p);
        }).on('error', (err) => {
          if (err.code === 'EADDRINUSE') {
            console.log(`[DEBUG] 端口 ${p} 被占用，尝试 ${p + 1}`);
            tryPort(p + 1);
          } else {
            reject(err);
          }
        });
      };
      tryPort(PORT);
    });
    
    // 打印最终的路由配置
    console.log('[DEBUG] 最终路由配置:', {
      api: apiRouter.stack.map(r => ({
        name: r.name,
        regexp: String(r.regexp),
        path: r.route?.path,
        handle: r.handle?.name,
        stack: r.handle?.stack?.map(s => ({
          name: s.name,
          regexp: String(s.regexp),
          path: s.route?.path
        }))
      })),
      proxy: proxyModule.router.stack.map(r => ({
        name: r.name,
        regexp: String(r.regexp),
        path: r.route?.path,
        handle: r.handle?.name,
        stack: r.handle?.stack?.map(s => ({
          name: s.name,
          regexp: String(s.regexp),
          path: s.route?.path
        }))
      }))
    });
    
    console.log('[DEBUG] 应用初始化完成');
    appInitialized = true;
    app.initializeApp();
  } catch (error) {
    console.error('[DEBUG] 应用初始化失败:', error);
    app.initializationFailed(error);
    throw error;
  }
}

// 启动应用
initializeApp().catch(error => {
  console.error('[DEBUG] 应用启动失败:', error);
  process.exit(1);
});
