const express = require('express');
const { validateApiKey } = require('../middleware/auth');

const router = express.Router();

// 获取节点统计信息
router.get('/nodes/:deviceId/stats', validateApiKey, async (req, res) => {
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
});

// 处理节点报告
router.post('/nodes/report', validateApiKey, async (req, res) => {
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
});

module.exports = router;
