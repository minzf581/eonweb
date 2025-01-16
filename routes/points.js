const express = require('express');
const router = express.Router();
const { User, PointHistory } = require('../models');
const { authenticateApiKey } = require('../middleware/auth');
const { isIP } = require('net');
const sequelize = require('../config/database');

console.log('[Points Router] 初始化 points.js 路由, 版本: 2024011608');

// 辅助函数
function validateIP(ipv4, ipv6) {
    console.log('[Points Router] 验证IP地址:', { ipv4, ipv6 });
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

// 导出路由处理函数
exports.updatePoints = async (req, res) => {
    console.log('[Points Router] 处理 /update 请求');
    try {
        console.log('[Points] Received update request:', req.body);
        
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
            console.log('[Points] Validation failed:', { email, points });
            return res.status(400).json({
                success: false,
                message: 'Invalid request. Email and points are required.'
            });
        }

        // Validate IP addresses
        const ipErrors = validateIP(ipv4, ipv6);
        if (ipErrors.length > 0) {
            console.log('[Points] IP validation failed:', ipErrors);
            return res.status(400).json({
                success: false,
                message: 'IP validation failed',
                errors: ipErrors
            });
        }

        // Start transaction
        const result = await sequelize.transaction(async (t) => {
            console.log('[Points] Starting transaction for user:', email);
            
            // Find user
            const user = await User.findOne({
                where: { email },
                transaction: t
            });

            if (!user) {
                console.log('[Points] User not found:', email);
                throw new Error('User not found');
            }

            console.log('[Points] Found user:', { id: user.id, currentPoints: user.points });

            // Update user points
            const updatedUser = await user.update({
                points: user.points + points
            }, { transaction: t });

            console.log('[Points] Updated user points:', { 
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

            console.log('[Points] Created point history record:', pointHistory.id);

            return updatedUser;
        });

        console.log(`[Points] Successfully updated points for user ${email}: +${points} points (IPv4: ${ipv4 || 'N/A'}, IPv6: ${ipv6 || 'N/A'})`);
        
        res.json({
            success: true,
            data: {
                email: result.email,
                totalPoints: result.points,
                ipv4: ipv4 || null,
                ipv6: ipv6 || null
            }
        });

    } catch (error) {
        console.error('[Points] Error in points update:', error);
        console.error('[Points] Error stack:', error.stack);
        console.error('[Points] Request body:', req.body);
        
        res.status(500).json({
            success: false,
            message: 'Failed to update points',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
};

exports.getBalance = async (req, res) => {
    try {
        const { email } = req.params;

        const user = await User.findOne({
            where: { email },
            attributes: ['email', 'points']
        });

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        res.json({
            success: true,
            data: {
                email: user.email,
                points: user.points
            }
        });
    } catch (error) {
        console.error('[Points] Error fetching points balance:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch points balance'
        });
    }
};

// 验证处理函数存在
console.log('[Points Router] 验证处理函数:', {
    updatePoints: typeof exports.updatePoints === 'function',
    getBalance: typeof exports.getBalance === 'function'
});

// 注册路由
console.log('[Points Router] 开始注册路由');
router.post('/update', authenticateApiKey, exports.updatePoints);
console.log('[Points Router] /update 路由注册完成');
router.get('/balance/:email', authenticateApiKey, exports.getBalance);
console.log('[Points Router] /balance/:email 路由注册完成');

module.exports = router;
