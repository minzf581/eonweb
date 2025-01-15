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
  console.log('代理路由收到请求:', {
    method: req.method,
    path: req.path,
    headers: req.headers,
    body: req.body
  });
  next();
});

// API Key 验证
router.use(validateApiKey);

// 节点报告路由
router.post('/nodes/report', async (req, res) => {
  console.log('[DEBUG] 进入节点报告路由处理');
  console.log('收到代理节点报告请求');
  try {
    console.log('处理节点报告:', req.body);
    res.json({ 
      success: true, 
      message: 'Report received',
      data: req.body
    });
  } catch (error) {
    console.error('节点报告错误:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// 节点统计路由
router.get('/nodes/:deviceId/stats', async (req, res) => {
  console.log('[DEBUG] 进入节点统计路由处理');
  console.log('获取节点统计:', req.params.deviceId);
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
      stack: r.route.stack.length
    }))
});

// 确保正确导出 Router 实例
module.exports = router; 