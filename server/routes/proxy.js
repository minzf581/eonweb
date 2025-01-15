const express = require('express');
const router = express.Router();
const { validateApiKey } = require('../middleware/auth');

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
  console.log('收到代理节点报告请求');
  console.log('请求头:', req.headers);
  console.log('请求体:', req.body);
  try {
    // 处理逻辑
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
  console.log('获取节点统计:', req.params.deviceId);
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
    res.status(500).json({ success: false, message: error.message });
  }
});

// 404 处理
router.use((req, res) => {
  console.log('代理路由 404:', req.path);
  res.status(404).json({ 
    success: false, 
    message: 'API endpoint not found',
    path: req.path
  });
});

module.exports = router; 