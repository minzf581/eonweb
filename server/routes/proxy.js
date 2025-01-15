const express = require('express');
const router = express.Router();
const { validateApiKey } = require('../middleware/auth');

// 打印初始路由配置
console.log('[DEBUG] 初始代理路由配置:', {
  stack: router.stack.map(r => ({
    route: r.route?.path,
    regexp: String(r.regexp),
    methods: r.route?.methods
  }))
});

// 定义路由处理器
const handlers = {
  async getNodeStats(req, res) {
    console.log('[DEBUG] 进入节点统计路由处理:', {
      requestId: req.requestId,
      deviceId: req.params.deviceId,
      path: req.path,
      baseUrl: req.baseUrl,
      originalUrl: req.originalUrl,
      stack: new Error().stack
    });
    try {
      res.json({
        success: true,
        data: {
          deviceId: req.params.deviceId,
          status: 'online',
          stats: {
            uptime: 0,
            traffic: {
              upload: 0,
              download: 0
            }
          }
        }
      });
    } catch (error) {
      console.error('获取节点统计错误:', error);
      res.status(500).json({ 
        success: false, 
        message: error.message,
        requestId: req.requestId
      });
    }
  },
  
  async postNodeReport(req, res) {
    console.log('[DEBUG] 进入节点报告路由处理:', {
      requestId: req.requestId,
      path: req.path,
      baseUrl: req.baseUrl,
      originalUrl: req.originalUrl,
      stack: new Error().stack
    });
    try {
      console.log('处理节点报告:', req.body);
      res.json({ 
        success: true, 
        message: 'Report received',
        data: req.body,
        requestId: req.requestId
      });
    } catch (error) {
      console.error('节点报告错误:', error);
      res.status(500).json({ 
        success: false, 
        message: error.message,
        requestId: req.requestId
      });
    }
  }
};

// 调试中间件
router.use((req, res, next) => {
  // 移除前缀以匹配路由
  const path = req.path.replace(/^\/api\/proxy/, '');
  
  req.requestPath.push({
    stage: 'proxyRouteHandler',
    timestamp: Date.now(),
    path: req.path,
    strippedPath: path,
    baseUrl: req.baseUrl,
    stack: router.stack
      .filter(r => r.route)
      .map(r => ({
        path: r.route.path,
        regexp: String(r.regexp),
        matched: r.regexp.test(path),
        methods: r.route.methods,
        methodMatched: r.route.methods[req.method.toLowerCase()]
      }))
  });
  
  console.log('[DEBUG] 代理路由收到请求:', {
    requestId: req.requestId,
    method: req.method,
    path: req.path,
    strippedPath: path,
    baseUrl: req.baseUrl,
    originalUrl: req.originalUrl,
    params: req.params,
    headers: req.headers,
    body: req.body,
    stack: new Error().stack
  });
  
  // 检查路由是否匹配
  const matchedRoute = router.stack
    .filter(r => r.route)
    .find(r => {
      const matched = r.regexp.test(path);
      const methodMatched = r.route.methods[req.method.toLowerCase()];
      console.log('[DEBUG] 路由匹配检查:', {
        requestId: req.requestId,
        path: path,
        routePath: r.route.path,
        regexp: String(r.regexp),
        matched,
        method: req.method,
        methodMatched,
        methods: Object.keys(r.route.methods)
      });
      return matched && methodMatched;
    });
  
  if (!matchedRoute) {
    console.log('[DEBUG] 未找到匹配的路由:', {
      requestId: req.requestId,
      path: path,
      method: req.method
    });
  }
  
  next();
});

// API Key 验证
router.use(validateApiKey);

// 节点统计路由
router.get('/nodes/:deviceId/stats', handlers.getNodeStats);

// 节点报告路由
router.post('/nodes/report', handlers.postNodeReport);

// 打印最终路由配置
console.log('[DEBUG] 代理路由配置完成:', {
  routes: router.stack
    .filter(r => r.route)
    .map(r => ({
      path: r.route.path,
      methods: Object.keys(r.route.methods),
      stack: r.route.stack.length,
      fullPath: `/api/proxy${r.route.path}`,
      regexp: r.route.path.replace(/:(\w+)/g, '([^/]+)'),
      keys: r.keys?.map(k => k.name),
      layer: {
        name: r.name,
        regexp: String(r.regexp)
      }
    }))
});

// 确保正确导出 Router 实例
module.exports = router; 