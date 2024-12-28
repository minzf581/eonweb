const express = require('express');
const router = express.Router();
const { User, Task, Settings } = require('../models');
const { Op } = require('sequelize');
const bcrypt = require('bcryptjs');

// Note: Authentication middleware is now applied at the app level in server.js

// 获取管理员统计数据
router.get('/stats', async (req, res) => {
    try {
        console.log('[Admin API] Getting stats, user:', {
            id: req.user.id,
            email: req.user.email,
            isAdmin: req.user.isAdmin
        });

        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);

        const [totalUsers, activeUsers, totalTasks, currentTasks] = await Promise.all([
            User.count(),
            User.count({
                where: {
                    updatedAt: {
                        [Op.gte]: yesterday
                    }
                }
            }),
            Task.count({
                where: {
                    status: {
                        [Op.in]: ['active', 'completed']
                    }
                }
            }),
            Task.count({
                where: {
                    status: 'active',
                    isActive: true
                }
            })
        ]);

        const stats = {
            totalUsers,
            activeUsers,
            totalTasks,
            currentTasks,
            currentTaskPercentage: totalTasks > 0 ? (currentTasks / totalTasks * 100).toFixed(1) : 0,
            userParticipationRate: totalUsers > 0 ? (activeUsers / totalUsers * 100).toFixed(1) : 0
        };

        console.log('[Admin API] Stats:', stats);
        res.json(stats);
    } catch (error) {
        console.error('[Admin API] Error getting stats:', error);
        res.status(500).json({ 
            success: false,
            error: 'Failed to load stats',
            details: error.message 
        });
    }
});

// 获取所有用户
router.get('/users', async (req, res) => {
    try {
        console.log('[Admin API] Getting users, user:', {
            id: req.user.id,
            email: req.user.email,
            isAdmin: req.user.isAdmin
        });

        const users = await User.findAll({
            attributes: ['id', 'email', 'points', 'referralCode', 'isAdmin', 'createdAt', 'updatedAt'],
            order: [['createdAt', 'DESC']]
        });
        
        console.log('[Admin API] Found users:', users.length);
        res.json(users);
    } catch (error) {
        console.error('[Admin API] Error getting users:', error);
        res.status(500).json({ 
            success: false,
            error: 'Failed to load users',
            details: error.message 
        });
    }
});

// 添加新用户
router.post('/users', async (req, res) => {
    try {
        console.log('[Admin API] Adding user, admin:', {
            id: req.user.id,
            email: req.user.email,
            isAdmin: req.user.isAdmin
        });

        const { email, password, isAdmin } = req.body;

        // Validate required fields
        if (!email || !password) {
            return res.status(400).json({
                success: false,
                error: 'Email and password are required'
            });
        }

        // Check if user already exists
        const existingUser = await User.findOne({ where: { email } });
        if (existingUser) {
            return res.status(400).json({
                success: false,
                error: 'User already exists'
            });
        }

        // Generate referral code
        const referralCode = crypto.randomBytes(4).toString('hex');

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create user
        const user = await User.create({
            email,
            password: hashedPassword,
            referralCode,
            isAdmin: !!isAdmin,
            points: 0
        });

        console.log('[Admin API] User created:', {
            id: user.id,
            email: user.email,
            isAdmin: user.isAdmin
        });

        res.json({
            success: true,
            user: {
                id: user.id,
                email: user.email,
                isAdmin: user.isAdmin,
                points: user.points,
                referralCode: user.referralCode,
                createdAt: user.createdAt
            }
        });
    } catch (error) {
        console.error('[Admin API] Error creating user:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to create user',
            details: error.message
        });
    }
});

// 获取所有任务
router.get('/tasks', async (req, res) => {
    try {
        console.log('[Admin API] Getting tasks, user:', {
            id: req.user.id,
            email: req.user.email,
            isAdmin: req.user.isAdmin
        });

        const tasks = await Task.findAll({
            order: [['createdAt', 'DESC']]
        });
        
        console.log('[Admin API] Found tasks:', tasks.length);
        res.json(tasks);
    } catch (error) {
        console.error('[Admin API] Error getting tasks:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// 获取系统设置
router.get('/settings', async (req, res) => {
    try {
        console.log('[Admin API] Getting settings, user:', {
            id: req.user.id,
            email: req.user.email,
            isAdmin: req.user.isAdmin
        });

        const settings = await Settings.findAll();
        console.log('[Admin API] Found settings:', settings.length);
        res.json(settings);
    } catch (error) {
        console.error('[Admin API] Error getting settings:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// 更新系统设置
router.post('/settings', async (req, res) => {
    try {
        console.log('[Admin API] Updating settings, user:', {
            id: req.user.id,
            email: req.user.email,
            isAdmin: req.user.isAdmin
        });

        const { referralPoints, taskPoints } = req.body;
        
        await Settings.upsert({
            key: 'referralPoints',
            value: referralPoints
        });
        
        await Settings.upsert({
            key: 'taskPoints',
            value: taskPoints
        });
        
        res.json({ success: true });
    } catch (error) {
        console.error('[Admin API] Error updating settings:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// 删除用户
router.delete('/users/:id', async (req, res) => {
    try {
        console.log('[Admin API] Deleting user, admin:', {
            id: req.user.id,
            email: req.user.email,
            isAdmin: req.user.isAdmin
        });

        const userId = req.params.id;

        // Prevent self-deletion
        if (userId === req.user.id.toString()) {
            return res.status(400).json({
                success: false,
                error: 'Cannot delete your own account'
            });
        }

        const user = await User.findByPk(userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'User not found'
            });
        }

        await user.destroy();
        console.log('[Admin API] User deleted:', { id: userId });

        res.json({
            success: true,
            message: 'User deleted successfully'
        });
    } catch (error) {
        console.error('[Admin API] Error deleting user:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to delete user',
            details: error.message
        });
    }
});

// 更新用户
router.patch('/users/:id', async (req, res) => {
    try {
        console.log('[Admin API] Updating user, admin:', {
            id: req.user.id,
            email: req.user.email,
            isAdmin: req.user.isAdmin
        });

        const userId = req.params.id;
        const updates = req.body;
        
        // Prevent updating sensitive fields
        delete updates.password;
        delete updates.email;
        
        const user = await User.findByPk(userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        await user.update(updates);
        res.json({
            success: true,
            user: {
                id: user.id,
                email: user.email,
                points: user.points,
                referralCode: user.referralCode,
                isAdmin: user.isAdmin,
                createdAt: user.createdAt,
                updatedAt: user.updatedAt
            }
        });
    } catch (error) {
        console.error('[Admin API] Error updating user:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
