const express = require('express');
const { validateApiKey } = require('../middleware/auth');

const router = express.Router();
console.log('[Proxy] 创建路由实例');

// 调试中间件
router.use((req, res, next) => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}][Proxy] 收到请求:`, {
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

console.log('[Proxy] 注册 GET /nodes/:deviceId/stats 路由');
// 获取节点统计信息
router.get('/nodes/:deviceId/stats', validateApiKey, async (req, res) => {
    const timestamp = new Date().toISOString();
    try {
        console.log(`[${timestamp}][Proxy] 处理节点统计请求:`, {
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
        console.error(`[${timestamp}][Proxy] 获取节点统计失败:`, error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

console.log('[Proxy] 注册 POST /nodes/report 路由');
// 处理节点报告
router.post('/nodes/report', validateApiKey, async (req, res) => {
    const timestamp = new Date().toISOString();
    try {
        console.log(`[${timestamp}][Proxy] 处理节点报告:`, {
            version: '2024011601',
            body: req.body,
            headers: req.headers
        });
        res.json({
            success: true,
            message: 'Report received'
        });
    } catch (error) {
        console.error(`[${timestamp}][Proxy] 处理节点报告失败:`, error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// 打印路由配置
console.log('[Proxy] 路由配置完成，注册的路由:', 
    router.stack
        .filter(r => r.route)
        .map(r => ({
            path: r.route.path,
            methods: Object.keys(r.route.methods)
        }))
);

module.exports = router;
