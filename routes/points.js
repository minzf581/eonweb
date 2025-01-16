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
    version: '2024011621',
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

// 使用API密钥验证中间件
router.use(validateApiKey);

// 更新用户积分
router.post('/update', async (req, res) => {
    logWithTimestamp('处理 /update 请求开始');
    try {
        const { 
            email, 
            points, 
            type = 'bandwidth_sharing', 
            ipv4,
            ipv6,
            metadata = {} 
        } = req.body;

        // 验证必填字段
        if (!email || typeof points !== 'number') {
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

        // 开始数据库事务
        const transaction = await sequelize.transaction();
        try {
            // 查找或创建用户
            const [user] = await User.findOrCreate({
                where: { email },
                defaults: { points: 0 },
                transaction
            });

            // 更新用户积分
            await user.increment('points', { 
                by: points,
                transaction 
            });

            // 创建积分历史记录
            await PointHistory.create({
                userId: user.id,
                points,
                type,
                metadata: {
                    ...metadata,
                    ipv4,
                    ipv6
                }
            }, { transaction });

            // 提交事务
            await transaction.commit();
            
            logWithTimestamp('积分更新成功', { email, points });
            res.json({
                success: true,
                message: '积分更新成功',
                data: {
                    email,
                    points,
                    newBalance: user.points + points
                }
            });
        } catch (error) {
            // 回滚事务
            await transaction.rollback();
            throw error;
        }
    } catch (error) {
        logWithTimestamp('积分更新失败', error.message);
        res.status(500).json({
            success: false,
            message: '积分更新失败',
            error: error.message
        });
    }
});

// 获取用户积分余额
router.get('/balance/:email', async (req, res) => {
    logWithTimestamp('处理 /balance/:email 请求开始');
    try {
        const { email } = req.params;
        
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

        logWithTimestamp('获取积分余额成功', { email, points: user.points });
        res.json({
            success: true,
            data: {
                email: user.email,
                points: user.points
            }
        });
    } catch (error) {
        logWithTimestamp('获取积分余额失败', error.message);
        res.status(500).json({
            success: false,
            message: '获取积分余额失败',
            error: error.message
        });
    }
});

logWithTimestamp('路由注册完成');

// 导出路由
module.exports = router;
