const express = require('express');
const router = express.Router();
const { validateApiKey } = require('../middleware/auth');

// 应用 API 密钥验证中间件
router.use(validateApiKey);

router.post('/nodes/report', async (req, res) => {
  console.log('节点报告请求体:', req.body);
  try {
    // 处理逻辑
  } catch (error) {
    console.error('节点报告错误:', error);
    res.status(500).json({ success: false, message: error.message });
  }
}); 