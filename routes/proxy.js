const express = require('express');
const { validateApiKey } = require('../middleware/auth');

const router = express.Router();

// 调试中间件
router.use((req, res, next) => {
    console.log('[DEBUG][Proxy] 收到请求:', {
        version: '2024011601',
        path: req.path,
        method: req.method,
        baseUrl: req.baseUrl,
        originalUrl: req.originalUrl,
        params: req.params,
        query: req.query,
        headers: req.headers
    });
    next();
});

// 获取节点统计信息
router.get('/nodes/:deviceId/stats', validateApiKey, async (req, res) => {
    try {
        console.log('[DEBUG][Proxy] 处理节点统计请求:', {
            version: '2024011601',
            params: req.params,
            headers: req.headers
        });
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
        console.error('[ERROR][Proxy] 获取节点统计失败:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// 处理节点报告
router.post('/nodes/report', validateApiKey, async (req, res) => {
    try {
        console.log('[DEBUG][Proxy] 处理节点报告:', {
            version: '2024011601',
            body: req.body,
            headers: req.headers
        });
        res.json({
            success: true,
            message: 'Report received'
        });
    } catch (error) {
        console.error('[ERROR][Proxy] 处理节点报告失败:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

module.exports = router;
