const express = require('express');
const { validateApiKey } = require('../middleware/auth');

function createProxyRouter() {
  const router = express.Router();
  
  // 1. 中间件注册
  if (validateApiKey) {
    console.log('[DEBUG] 注册 API Key 验证中间件');
    router.use(validateApiKey);
  }

  // 2. 路由处理器定义
  const handlers = {
    getNodeStats: async (req, res) => {
      try {
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
      } catch (error) {
        console.error('[ERROR] 获取节点统计失败:', error);
        res.status(500).json({
          success: false,
          message: error.message
        });
      }
    },
    
    postNodeReport: async (req, res) => {
      try {
        console.log('[DEBUG] 处理节点报告:', req.body);
        res.json({
          success: true,
          message: 'Report received'
        });
      } catch (error) {
        console.error('[ERROR] 处理节点报告失败:', error);
        res.status(500).json({
          success: false,
          message: error.message
        });
      }
    }
  };

  // 3. 路由注册
  router.get('/nodes/:deviceId/stats', handlers.getNodeStats);
  router.post('/nodes/report', handlers.postNodeReport);

  // 4. 调试信息
  console.log('[DEBUG] 创建代理路由器:', {
    middleware: router.stack.filter(r => !r.route).map(r => r.name || 'anonymous'),
    routes: router.stack.filter(r => r.route).map(r => ({
      path: r.route.path,
      methods: Object.keys(r.route.methods)
    }))
  });

  return { router, handlers };
}

module.exports = createProxyRouter; 