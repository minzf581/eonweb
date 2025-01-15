const express = require('express');
const { validateApiKey } = require('../middleware/auth');
const router = express.Router();

// 定义路由处理器
const handlers = {
  getNodeStats: (req, res) => {
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
  },
  
  postNodeReport: (req, res) => {
    console.log('[DEBUG] 处理节点报告:', req.body);
    res.json({
      success: true,
      message: 'Report received'
    });
  }
};

// 注册路由
router.get('/nodes/:deviceId/stats', handlers.getNodeStats);
router.post('/nodes/report', handlers.postNodeReport);

// 注册中间件
if (validateApiKey) {
  router.use(validateApiKey);
}

// 导出
module.exports = {
  router: router,
  handlers: handlers
}; 