const express = require('express');
const router = express.Router();
const { validateApiKey } = require('../middleware/auth');

// 应用 API 密钥验证中间件
router.use(validateApiKey);

router.post('/nodes/report', async (req, res) => {
  console.log('收到代理节点报告请求');
  console.log('请求头:', req.headers);
  console.log('请求体:', req.body);
  try {
    // 处理逻辑
    res.json({ success: true, message: 'Report received' });
  } catch (error) {
    console.error('节点报告错误:', error);
    res.status(500).json({ success: false, message: error.message });
  }
}); 