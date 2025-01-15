const express = require('express');
const { validateApiKey } = require('../middleware/auth');

function createProxyRouter() {
  // 创建路由器
  const router = express.Router();

  // 先注册中间件
  if (typeof validateApiKey === 'function') {
    router.use(validateApiKey);
  }

  // 定义路由处理器
  router.get('/nodes/:deviceId/stats', (req, res) => {
    console.log('[DEBUG] 处理节点统计请求:', req.params);
    res.json({
      success: true,
      data: {
        deviceId: req.params.deviceId,
        uptime: Math.floor(Math.random() * 1000000),
        memory: {
          total: 8192,
          used: Math.floor(Math.random() * 8192)
        },
        cpu: {
          cores: 4,
          usage: Math.random()
        }
      }
    });
  });

  router.post('/nodes/report', (req, res) => {
    console.log('[DEBUG] 处理节点报告:', req.body);
    res.json({
      success: true,
      message: 'Report received'
    });
  });

  // 打印路由配置
  console.log('[DEBUG] 代理路由器配置:', {
    routes: router.stack.map(layer => ({
      type: layer.route ? 'route' : 'middleware',
      path: layer.route?.path,
      methods: layer.route?.methods
    }))
  });

  return router;
}

module.exports = createProxyRouter; 