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
  req.requestId = crypto.randomBytes(4).toString('hex');
  console.log('[DEBUG] 收到请求:', {
    requestId: req.requestId,
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
  
  // 监听请求结束
  res.on('finish', () => {
    console.log('[DEBUG] 请求处理完成:', {
      requestId: req.requestId,
      method: req.method,
      path: req.path,
      statusCode: res.statusCode
    });
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

// 创建一个新的路由器来处理所有 API 请求
const apiRouter = express.Router();

// 先注册基础中间件
apiRouter.use(express.json());
apiRouter.use(express.urlencoded({ extended: true }));

// 注册代理路由
apiRouter.use('/proxy', (req, res, next) => {
  console.log('[DEBUG] 代理路由中间件:', {
    requestId: req.requestId,
    originalUrl: req.originalUrl,
    baseUrl: req.baseUrl,
    path: req.path,
    method: req.method,
    params: req.params,
    stack: new Error().stack
  });
  next();
});

// 将代理路由注册到 API 路由器
apiRouter.use('/proxy', proxyRoutes);

// 注册其他路由到 API 路由器
apiRouter.use('/auth', authRoutes);
apiRouter.use('/tasks', tasksRoutes);
apiRouter.use('/stats', statsRoutes);
apiRouter.use('/referral', referralRoutes);
apiRouter.use('/bandwidth', bandwidthRoutes);
apiRouter.use('/admin', adminRoutes);

// 打印路由信息
console.log('[DEBUG] API 路由配置:', {
  routes: apiRouter.stack
    .filter(r => r.name === 'router')
    .map(r => ({
      path: r.regexp.toString(),
      name: r.name,
      handle: r.handle?.stack?.length
    }))
});

// 初始化应用
async function initializeApp() {
  try {
    console.log('[DEBUG] 开始初始化应用');
    
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
    
    // 注册 API 路由器
    app.use('/api', apiRouter);
    
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
    
    console.log('[DEBUG] 应用初始化完成');
  } catch (error) {
    console.error('[DEBUG] 应用初始化失败:', error);
    throw error;
  }
}

// 启动应用
initializeApp().catch(error => {
  console.error('[DEBUG] 应用启动失败:', error);
  process.exit(1);
});
