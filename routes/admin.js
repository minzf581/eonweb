const express = require('express');
const router = express.Router();
const { User, Task, Settings } = require('../models');
const { Op } = require('sequelize');
const bcrypt = require('bcryptjs');

// Note: Authentication middleware is now applied at the app level in server.js

// 获取管理员统计数据
router.get('/stats', async (req, res) => {
    try {
        console.log('[Admin API] Getting stats');
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
        console.log('[Admin API] Getting users');
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
        console.log('[Admin API] Getting tasks');
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
        console.log('[Admin API] Getting settings');
        const settings = await Settings.findAll();
        console.log('[Admin API] Found settings:', settings.length);
        res.json(settings);
    } catch (error) {
        console.error('[Admin API] Error getting settings:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
