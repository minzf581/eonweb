const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { User, PointHistory } = require('../models');
const { sequelize } = require('../config/sequelize');

// 记录带时间戳的日志
function logWithTimestamp(message) {
    console.log(`[${new Date().toISOString()}][Points Router] ${message}`);
}

// 初始化日志
const version = '2024011625';
const deployTime = new Date().toISOString();
logWithTimestamp(`初始化 points.js 路由 { version: '${version}', deployTime: '${deployTime}' }`);

// 更新用户积分的路由处理函数
async function handleUpdatePoints(req, res) {
    logWithTimestamp(`处理更新积分请求: ${JSON.stringify(req.body)}`);
    const { email, points } = req.body;

    if (!email || !points) {
        logWithTimestamp('请求缺少必要参数');
        return res.status(400).json({ error: '缺少必要参数' });
    }

    try {
        const result = await User.sequelize.transaction(async (t) => {
            const user = await User.findOne({ where: { email }, transaction: t });
            if (!user) {
                logWithTimestamp(`用户不存在: ${email}`);
                return res.status(404).json({ error: '用户不存在' });
            }

            const newPoints = user.points + parseInt(points);
            await user.update({ points: newPoints }, { transaction: t });
            logWithTimestamp(`积分更新成功: ${email}, 新积分: ${newPoints}`);
            return res.json({ success: true, points: newPoints });
        });
    } catch (error) {
        logWithTimestamp(`更新积分时发生错误: ${error.message}`);
        return res.status(500).json({ error: '更新积分失败' });
    }
}

// 获取用户积分的路由处理函数
async function handleGetBalance(req, res) {
    const { email } = req.params;
    logWithTimestamp(`查询积分请求: ${email}`);

    try {
        const user = await User.findOne({ where: { email } });
        if (!user) {
            logWithTimestamp(`用户不存在: ${email}`);
            return res.status(404).json({ error: '用户不存在' });
        }

        logWithTimestamp(`查询积分成功: ${email}, 积分: ${user.points}`);
        return res.json({ points: user.points });
    } catch (error) {
        logWithTimestamp(`查询积分时发生错误: ${error.message}`);
        return res.status(500).json({ error: '查询积分失败' });
    }
}

// 注册路由
logWithTimestamp('开始注册路由');

// 更新积分路由
router.post('/update', authenticateToken, handleUpdatePoints);
logWithTimestamp('已注册 POST /update 路由');

// 查询积分路由
router.get('/balance/:email', authenticateToken, handleGetBalance);
logWithTimestamp('已注册 GET /balance/:email 路由');

logWithTimestamp('路由注册完成');

module.exports = router;
