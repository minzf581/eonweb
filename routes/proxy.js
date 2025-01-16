const express = require('express');
const { validateApiKey } = require('../middleware/auth');

const router = express.Router();
const version = '2024011626';
const timestamp = new Date().toISOString();
console.log(`[${timestamp}][Proxy] 创建路由实例 version=${version}`);

// 调试中间件
router.use((req, res, next) => {
    const reqTimestamp = new Date().toISOString();
    console.log(`[${reqTimestamp}][Proxy] 收到请求:`, {
        version,
        path: req.path,
        method: req.method,
        baseUrl: req.baseUrl,
        originalUrl: req.originalUrl,
        params: req.params,
        query: req.query,
        headers: {
            'x-api-key': req.headers['x-api-key'] ? '***' : undefined,
            'content-type': req.headers['content-type']
        }
    });
    next();
});

// 定义路由处理函数
const getNodeStats = async (req, res) => {
    const fnTimestamp = new Date().toISOString();
    try {
        console.log(`[${fnTimestamp}][Proxy] 处理节点统计请求:`, {
            version,
            params: req.params
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
        console.error(`[${fnTimestamp}][Proxy] 获取节点统计失败:`, error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

const handleNodeReport = async (req, res) => {
    const fnTimestamp = new Date().toISOString();
    try {
        console.log(`[${fnTimestamp}][Proxy] 处理节点报告:`, {
            version,
            body: req.body
        });
        res.json({
            success: true,
            message: 'Report received'
        });
    } catch (error) {
        console.error(`[${fnTimestamp}][Proxy] 处理节点报告失败:`, error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// 注册路由
console.log(`[${timestamp}][Proxy] 开始注册路由`);

console.log(`[${timestamp}][Proxy] 注册 GET /nodes/:deviceId/stats 路由`);
router.get('/nodes/:deviceId/stats', validateApiKey, getNodeStats);

console.log(`[${timestamp}][Proxy] 注册 POST /nodes/report 路由`);
router.post('/nodes/report', validateApiKey, handleNodeReport);

// 打印路由配置
const routes = router.stack
    .filter(r => r.route)
    .map(r => ({
        path: r.route.path,
        methods: Object.keys(r.route.methods)
    }));

console.log(`[${timestamp}][Proxy] 路由配置完成，注册的路由:`, routes);

module.exports = router;
