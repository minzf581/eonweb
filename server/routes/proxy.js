const express = require('express');
const { validateApiKey } = require('../middleware/auth');

// 路由处理器
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

// 创建路由器工厂函数
function createProxyRouter() {
  try {
    // 创建新的路由器实例
    const router = express.Router();
    
    // 注册中间件
    if (typeof validateApiKey === 'function') {
      console.log('[DEBUG] 注册 API Key 验证中间件');
      router.use(validateApiKey);
    } else {
      console.warn('[WARN] validateApiKey 不是一个函数，跳过中间件注册');
    }

    // 注册路由
    console.log('[DEBUG] 注册路由处理器');
    router.get('/nodes/:deviceId/stats', handlers.getNodeStats);
    router.post('/nodes/report', handlers.postNodeReport);

    // 验证路由器配置
    if (!router || typeof router.use !== 'function') {
      throw new Error('路由器创建失败');
    }

    // 打印路由配置
    const routes = router.stack
      .filter(layer => layer.route)
      .map(layer => ({
        path: layer.route.path,
        methods: Object.keys(layer.route.methods)
      }));

    console.log('[DEBUG] 代理路由器配置:', {
      routes,
      middleware: router.stack
        .filter(layer => !layer.route)
        .map(layer => layer.name || 'anonymous')
    });

    return { router, handlers };
  } catch (error) {
    console.error('[ERROR] 创建代理路由器失败:', error);
    throw error;
  }
}

module.exports = createProxyRouter; 