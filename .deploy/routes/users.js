const express = require('express');
const { authenticateToken, isAdmin } = require('../middleware/auth');
const { User } = require('../models');

const router = express.Router();

// 获取用户列表
router.get('/', authenticateToken, isAdmin, async (req, res) => {
    try {
        const users = await User.findAll({
            attributes: ['id', 'email', 'is_admin', 'points', 'referral_code', 'credits']
        });
        res.json({
            success: true,
            data: users
        });
    } catch (error) {
        console.error('[Users] Error getting users:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// 获取单个用户
router.get('/:id', authenticateToken, async (req, res) => {
    try {
        const user = await User.findByPk(req.params.id, {
            attributes: ['id', 'email', 'is_admin', 'points', 'referral_code', 'credits']
        });
        
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        res.json({
            success: true,
            data: user
        });
    } catch (error) {
        console.error('[Users] Error getting user:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

module.exports = router; 