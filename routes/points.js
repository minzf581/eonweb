const express = require('express');
const { User, PointHistory } = require('../models');
const { validateApiKey } = require('../middleware/auth');
const { isIP } = require('net');
const sequelize = require('../config/database');

// 创建路由实例
const router = express.Router();

// 添加日志时间戳函数
function logWithTimestamp(message, data = '') {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}][Points Router] ${message}`, data);
}

// 初始化日志
logWithTimestamp('初始化 points.js 路由', { 
    version: '2024011624',
    deployTime: new Date().toISOString() 
});

// 验证IP地址
function validateIP(ipv4, ipv6) {
    if (!ipv4 && !ipv6) {
        return { valid: false, message: '至少需要提供一个IP地址' };
    }
    if (ipv4 && !isIP(ipv4, 4)) {
        return { valid: false, message: 'IPv4地址格式无效' };
    }
    if (ipv6 && !isIP(ipv6, 6)) {
        return { valid: false, message: 'IPv6地址格式无效' };
    }
    return { valid: true };
}

// 使用API Key验证中间件
router.use(validateApiKey);

// 更新用户积分路由
router.post('/update', async (req, res) => {
    const timestamp = new Date().toISOString();
    logWithTimestamp('处理更新积分请求', { timestamp });
    
    const { email, points, ipv4, ipv6 } = req.body;
    
    // 验证必填字段
    if (!email || !points) {
        logWithTimestamp('缺少必填字段');
        return res.status(400).json({
            success: false,
            message: '邮箱和积分是必填字段'
        });
    }
    
    // 验证IP地址
    const ipValidation = validateIP(ipv4, ipv6);
    if (!ipValidation.valid) {
        logWithTimestamp('IP地址验证失败', ipValidation.message);
        return res.status(400).json({
            success: false,
            message: ipValidation.message
        });
    }
    
    const transaction = await sequelize.transaction();
    
    try {
        // 查找用户
        const user = await User.findOne({
            where: { email },
            transaction
        });
        
        if (!user) {
            await transaction.rollback();
            logWithTimestamp('用户不存在', { email });
            return res.status(404).json({
                success: false,
                message: '用户不存在'
            });
        }
        
        // 更新积分
        const oldPoints = user.points;
        const newPoints = oldPoints + points;
        
        await user.update({ points: newPoints }, { transaction });
        
        // 记录积分历史
        await PointHistory.create({
            userId: user.id,
            points,
            oldPoints,
            newPoints,
            ipv4,
            ipv6
        }, { transaction });
        
        await transaction.commit();
        
        logWithTimestamp('积分更新成功', {
            email,
            oldPoints,
            newPoints,
            change: points
        });
        
        return res.json({
            success: true,
            message: '积分更新成功',
            data: {
                oldPoints,
                newPoints,
                change: points
            }
        });
    } catch (error) {
        await transaction.rollback();
        logWithTimestamp('更新积分失败', error);
        return res.status(500).json({
            success: false,
            message: '更新积分失败'
        });
    }
});

// 查询用户积分余额路由
router.get('/balance/:email', async (req, res) => {
    const timestamp = new Date().toISOString();
    logWithTimestamp('处理查询积分请求', { timestamp });
    
    const { email } = req.params;
    
    try {
        const user = await User.findOne({
            where: { email },
            attributes: ['email', 'points']
        });
        
        if (!user) {
            logWithTimestamp('用户不存在', { email });
            return res.status(404).json({
                success: false,
                message: '用户不存在'
            });
        }
        
        logWithTimestamp('查询积分成功', {
            email,
            points: user.points
        });
        
        return res.json({
            success: true,
            data: {
                email: user.email,
                points: user.points
            }
        });
    } catch (error) {
        logWithTimestamp('查询积分失败', error);
        return res.status(500).json({
            success: false,
            message: '查询积分失败'
        });
    }
});

// 导出路由
module.exports = router;
