const { validateApiKey } = require('../middleware/auth');

// 代理路由处理器
const proxyHandlers = {
  // 获取节点统计信息
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

  // 处理节点报告
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

// 注册代理路由
function registerProxyRoutes(app) {
  const basePath = '/api/proxy';
  
  // 注册中间件
  if (typeof validateApiKey === 'function') {
    app.use(basePath, validateApiKey);
  }

  // 注册路由
  app.get(`${basePath}/nodes/:deviceId/stats`, proxyHandlers.getNodeStats);
  app.post(`${basePath}/nodes/report`, proxyHandlers.postNodeReport);

  console.log('[DEBUG] 代理路由注册完成:', {
    basePath,
    routes: [
      { method: 'GET', path: `${basePath}/nodes/:deviceId/stats` },
      { method: 'POST', path: `${basePath}/nodes/report` }
    ]
  });
}

module.exports = registerProxyRoutes; 