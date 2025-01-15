const express = require('express');
const { validateApiKey } = require('../middleware/auth');

function createProxyRouter() {
  // 创建路由器
  const router = express.Router();

  // 定义路由处理器
  router.get('/nodes/:deviceId/stats', (req, res) => {
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
    res.json({
      success: true,
      message: 'Report received'
    });
  });

  // 最后添加中间件
  if (typeof validateApiKey === 'function') {
    router.use(validateApiKey);
  }

  return router;
}

module.exports = createProxyRouter; 