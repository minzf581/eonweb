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

        const [totalUsers, activeUsers, totalTasks, completedTasks] = await Promise.all([
            User.count(),
            User.count({
                where: {
                    updatedAt: {
                        [Op.gte]: yesterday
                    }
                }
            }),
            Task.count(),
            Task.count({
                where: {
                    status: 'completed'
                }
            })
        ]);

        const stats = {
            totalUsers,
            activeUsers,
            totalTasks,
            completedTasks
        };

        console.log('[Admin API] Stats:', stats);
        res.json(stats);
    } catch (error) {
        console.error('[Admin API] Error getting stats:', error);
        res.status(500).json({ error: 'Internal server error' });
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
        res.status(500).json({ error: 'Internal server error' });
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

// 添加用户
router.post('/users', async (req, res) => {
    try {
        console.log('[Admin API] Adding user, admin:', {
            id: req.user.id,
            email: req.user.email,
            isAdmin: req.user.isAdmin
        });

        const { email, password } = req.body;
        
        // Check if user exists
        const existingUser = await User.findOne({ where: { email } });
        if (existingUser) {
            return res.status(400).json({ error: 'User already exists' });
        }
        
        // Hash password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);
        
        // Create user
        const user = await User.create({
            email,
            password: hashedPassword,
            referralCode: crypto.randomBytes(4).toString('hex'),
            points: 0,
            isAdmin: false
        });
        
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
        console.error('[Admin API] Error adding user:', error);
        res.status(500).json({ error: 'Internal server error' });
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

// 删除用户
router.delete('/users/:id', async (req, res) => {
    try {
        console.log('[Admin API] Deleting user, admin:', {
            id: req.user.id,
            email: req.user.email,
            isAdmin: req.user.isAdmin
        });

        const userId = req.params.id;
        
        const user = await User.findByPk(userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        await user.destroy();
        res.json({ success: true });
    } catch (error) {
        console.error('[Admin API] Error deleting user:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
