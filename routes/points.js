const express = require('express');
const router = express.Router();
const { User, PointHistory } = require('../models');
const { authenticateApiKey } = require('../middleware/auth');
const { isIP } = require('net');
const sequelize = require('../config/database');

console.log('[Points Router] 初始化 points.js 路由, 版本: 2024011604');
console.log('[Points Router] 模块加载顺序验证 #1');

// Validate IP address
const validateIP = (ipv4, ipv6) => {
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
};

console.log('[Points Router] 模块加载顺序验证 #2');

// Update user points handler
const updatePoints = async (req, res) => {
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

console.log('[Points Router] 模块加载顺序验证 #3');

// Get balance handler
const getBalance = async (req, res) => {
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

console.log('[Points Router] 模块加载顺序验证 #4');
console.log('[Points Router] updatePoints 函数类型:', typeof updatePoints);
console.log('[Points Router] getBalance 函数类型:', typeof getBalance);

// Register routes
console.log('[Points Router] 注册路由');
console.log('[Points Router] 注册 /update 路由');
router.post('/update', authenticateApiKey, updatePoints);
console.log('[Points Router] 注册 /balance/:email 路由');
router.get('/balance/:email', authenticateApiKey, getBalance);

console.log('[Points Router] 模块加载顺序验证 #5');

module.exports = router;
