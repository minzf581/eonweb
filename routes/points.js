const express = require('express');
const router = express.Router();
const { User, PointHistory } = require('../models');
const { authenticateApiKey } = require('../middleware/auth');
const { isIP } = require('net');
const sequelize = require('../config/database');

// 添加日志时间戳函数
function logWithTimestamp(message, data = '') {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}][Points Router] ${message}`, data);
}

logWithTimestamp('初始化 points.js 路由', { version: '2024011613', deployTime: new Date().toISOString() });

// 辅助函数
function validateIP(ipv4, ipv6) {
    logWithTimestamp('验证IP地址', { ipv4, ipv6 });
    const errors = [];
    
    if (!ipv4 && !ipv6) {
        errors.push('At least one IP address (IPv4 or IPv6) is required');
    }
    
    if (ipv4 && isIP(ipv4) !== 4) {
        errors.push('Invalid IPv4 address');
    }
    
    if (ipv6 && isIP(ipv6) !== 6) {
        errors.push('Invalid IPv6 address');
    }
    
    return errors;
}

// 路由处理函数
const updatePoints = async function(req, res) {
    logWithTimestamp('处理 /update 请求');
    try {
        logWithTimestamp('收到更新请求', req.body);
        
        const { 
            email, 
            points, 
            type = 'bandwidth_sharing', 
            ipv4,
            ipv6,
            metadata = {} 
        } = req.body;

        // Validate required fields
        if (!email || typeof points !== 'number') {
            logWithTimestamp('验证失败', { email, points });
            return res.status(400).json({
                success: false,
                message: 'Invalid request. Email and points are required.'
            });
        }

        // Validate IP addresses
        const ipErrors = validateIP(ipv4, ipv6);
        if (ipErrors.length > 0) {
            logWithTimestamp('IP验证失败', ipErrors);
            return res.status(400).json({
                success: false,
                message: 'IP validation failed',
                errors: ipErrors
            });
        }

        // Start transaction
        try {
            const result = await sequelize.transaction(async (t) => {
                logWithTimestamp('开始事务处理', { email });
                
                // Find user
                const user = await User.findOne({
                    where: { email },
                    transaction: t
                });

                if (!user) {
                    logWithTimestamp('用户未找到', { email });
                    throw new Error('User not found');
                }

                logWithTimestamp('找到用户', { id: user.id, currentPoints: user.points });

                // Update user points
                const updatedUser = await user.update({
                    points: user.points + points
                }, { transaction: t });

                logWithTimestamp('更新用户积分', { 
                    id: user.id, 
                    oldPoints: user.points, 
                    addedPoints: points, 
                    newPoints: updatedUser.points 
                });

                // Create point history record
                const pointHistory = await PointHistory.create({
                    userId: user.id,
                    points,
                    type,
                    metadata: JSON.stringify({
                        ...metadata,
                        ipv4: ipv4 || null,
                        ipv6: ipv6 || null,
                        timestamp: new Date().toISOString()
                    }),
                    status: 'completed'
                }, { transaction: t });

                logWithTimestamp('创建积分历史记录', { id: pointHistory.id });
                logWithTimestamp('积分更新成功', { 
                    email,
                    points,
                    ipv4: ipv4 || 'N/A',
                    ipv6: ipv6 || 'N/A'
                });
                
                return {
                    email: updatedUser.email,
                    totalPoints: updatedUser.points,
                    ipv4: ipv4 || null,
                    ipv6: ipv6 || null
                };
            });

            res.json({
                success: true,
                data: result
            });
        } catch (error) {
            logWithTimestamp('积分更新错误', error);
            logWithTimestamp('错误堆栈', error.stack);
            logWithTimestamp('请求数据', req.body);
            
            res.status(500).json({
                success: false,
                message: 'Failed to update points',
                error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
            });
        }
    } catch (error) {
        logWithTimestamp('积分更新错误', error);
        logWithTimestamp('错误堆栈', error.stack);
        logWithTimestamp('请求数据', req.body);
        
        res.status(500).json({
            success: false,
            message: 'Failed to update points',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
};

const getBalance = async function(req, res) {
    try {
        const { email } = req.params;
        logWithTimestamp('查询积分余额', { email });

        const user = await User.findOne({
            where: { email },
            attributes: ['email', 'points']
        });

        if (!user) {
            logWithTimestamp('用户未找到', { email });
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        logWithTimestamp('查询积分成功', { email: user.email, points: user.points });
        res.json({
            success: true,
            data: {
                email: user.email,
                points: user.points
            }
        });
    } catch (error) {
        logWithTimestamp('查询积分错误', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch points balance'
        });
    }
};

// 验证处理函数
logWithTimestamp('验证处理函数', {
    updatePoints: typeof updatePoints,
    getBalance: typeof getBalance
});

// 注册路由
logWithTimestamp('开始注册路由');
router.post('/update', authenticateApiKey, updatePoints.bind(router));
logWithTimestamp('/update 路由注册完成');
router.get('/balance/:email', authenticateApiKey, getBalance.bind(router));
logWithTimestamp('/balance/:email 路由注册完成');

// 导出路由
module.exports = router;
