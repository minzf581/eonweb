const express = require('express');
const router = express.Router();
const { User } = require('../models');
const { authenticateToken } = require('../middleware/auth');
const { Op } = require('sequelize');

// Middleware to check if user is admin
const isAdmin = (req, res, next) => {
    if (!req.user || !req.user.is_admin) {
        return res.status(403).json({
            success: false,
            message: 'Access denied. Admin privileges required.'
        });
    }
    next();
};

// Get system stats
router.get('/stats', authenticateToken, isAdmin, async (req, res) => {
    try {
        console.log('[Admin] Getting system stats. Requested by:', {
            id: req.user.id,
            email: req.user.email,
            is_admin: req.user.is_admin
        });

        // Get total users count
        const totalUsers = await User.count({
            where: {
                deleted_at: null
            }
        });

        // Get active users (logged in within last 7 days)
        const activeUsers = await User.count({
            where: {
                deleted_at: null,
                last_login_at: {
                    [Op.gte]: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
                }
            }
        });

        // Get total tasks from UserTask model
        const { UserTask } = require('../models');
        const totalTasks = await UserTask.count({
            where: {
                deleted_at: null,
                status: 'completed'
            }
        });

        // Get total credits
        const totalCredits = await User.sum('credits', {
            where: {
                deleted_at: null
            }
        }) || 0;

        console.log('[Admin] Stats retrieved:', {
            totalUsers,
            activeUsers,
            totalTasks,
            totalCredits
        });

        res.json({
            success: true,
            data: {
                totalUsers,
                activeUsers,
                totalTasks,
                totalCredits: parseFloat(totalCredits).toFixed(2)
            }
        });
    } catch (error) {
        console.error('[Admin] Error getting stats:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get system stats',
            error: error.message
        });
    }
});

// Get all users
router.get('/users', authenticateToken, isAdmin, async (req, res) => {
    try {
        console.log('[Admin] Getting all users. Requested by:', {
            id: req.user.id,
            email: req.user.email,
            is_admin: req.user.is_admin
        });

        const users = await User.findAll({
            where: {
                deleted_at: null
            },
            attributes: [
                'id', 
                'email', 
                'points',
                'credits', 
                'referral_code',
                'is_admin',
                'created_at',
                'last_login_at',
                'username'
            ],
            order: [['created_at', 'DESC']]
        });

        const formatted_users = users.map(user => ({
            ...user.toJSON(),
            points: parseFloat(user.points || 0).toFixed(2),
            credits: parseFloat(user.credits || 0).toFixed(2)
        }));

        console.log(`[Admin] Retrieved ${users.length} users with extended information`);
        console.log('[Admin] Formatted users data:', formatted_users);

        // 设置响应头以防止缓存
        res.set({
            'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0'
        });

        res.json({
            success: true,
            users: formatted_users
        });
    } catch (error) {
        console.error('[Admin] Error getting users:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get users list',
            error: error.message
        });
    }
});

// Update user
router.put('/users/:id', authenticateToken, isAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;

        console.log('[Admin] Updating user:', { id, updates });

        const user = await User.findByPk(id);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Update user fields
        const allowed_updates = ['email', 'points', 'credits', 'is_admin', 'username'];
        Object.keys(updates).forEach(key => {
            if (allowed_updates.includes(key)) {
                user[key] = updates[key];
            }
        });

        await user.save();

        console.log('[Admin] User updated successfully:', user.toJSON());

        res.json({
            success: true,
            message: 'User updated successfully',
            user: {
                id: user.id,
                email: user.email,
                points: user.points,
                credits: user.credits,
                is_admin: user.is_admin,
                username: user.username,
                referral_code: user.referral_code,
                created_at: user.created_at
            }
        });
    } catch (error) {
        console.error('[Admin] Error updating user:', error);
        res.status(500).json({
            success: false,
            message: 'Error updating user',
            error: error.message
        });
    }
});

// Delete user
router.delete('/users/:id', authenticateToken, isAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        
        console.log('[Admin] Deleting user:', { id });

        const user = await User.findByPk(id);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Soft delete the user
        await user.update({ deleted_at: new Date() });

        console.log('[Admin] User deleted successfully:', { id });

        res.json({
            success: true,
            message: 'User deleted successfully'
        });
    } catch (error) {
        console.error('[Admin] Error deleting user:', error);
        res.status(500).json({
            success: false,
            message: 'Error deleting user',
            error: error.message
        });
    }
});

module.exports = router;
