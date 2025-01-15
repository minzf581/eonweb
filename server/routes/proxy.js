const express = require('express');
const router = express.Router();
const { validateApiKey } = require('../middleware/auth');

// 导出路由之前先打印路由信息
console.log('[DEBUG] 代理路由配置:', {
  routes: router.stack.map(r => ({
    path: r.route?.path,
    methods: r.route?.methods
  }))
});

// 调试中间件
router.use((req, res, next) => {
  console.log('[DEBUG] 代理路由收到请求:', {
    requestId: req.requestId,
    method: req.method,
    path: req.path,
    baseUrl: req.baseUrl,
    originalUrl: req.originalUrl,
    params: req.params,
    headers: req.headers,
    body: req.body,
    stack: new Error().stack
  });
  next();
});

// API Key 验证
router.use(validateApiKey);

// 节点报告路由
router.post('/nodes/report', async (req, res) => {
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
});

// 节点统计路由
router.get('/nodes/:deviceId/stats', async (req, res) => {
  console.log('[DEBUG] 进入节点统计路由处理');
  console.log('获取节点统计:', {
    deviceId: req.params.deviceId,
    path: req.path,
    baseUrl: req.baseUrl,
    originalUrl: req.originalUrl
  });
  try {
    console.log('返回节点统计数据');
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
    res.status(500).json({ success: false, message: error.message });
  }
});

// 打印路由配置
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