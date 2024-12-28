const express = require('express');
const router = express.Router();
const { User, Task } = require('../models');
const { Op } = require('sequelize');
const bcrypt = require('bcryptjs');
const { authenticateToken, isAdmin } = require('../middleware/auth');

// 使用认证和管理员中间件
router.use(authenticateToken);
router.use(isAdmin);

// 获取管理员统计数据
router.get('/stats', async (req, res) => {
    try {
        const [totalUsers, totalTasks] = await Promise.all([
            User.count(),
            Task.count()
        ]);

        // 获取今日活跃用户数（示例：24小时内有登录记录的用户）
        const activeUsers = await User.count({
            where: {
                updatedAt: {
                    [Op.gte]: new Date(new Date() - 24 * 60 * 60 * 1000)
                }
            }
        });

        // 获取已完成的任务数
        const completedTasks = await Task.count({
            where: { isCompleted: true }
        });

        res.json({
            totalUsers,
            activeUsers,
            totalTasks,
            completedTasks
        });
    } catch (error) {
        console.error('Error getting admin stats:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// 获取所有用户
router.get('/users', async (req, res) => {
    try {
        const users = await User.findAll({
            attributes: ['id', 'email', 'points', 'referralCode', 'createdAt']
        });
        res.json(users);
    } catch (error) {
        console.error('Error getting users:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// 添加新用户
router.post('/users', async (req, res) => {
    try {
        const { email, password } = req.body;

        // 验证必需字段
        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }

        // 检查邮箱是否已存在
        const existingUser = await User.findOne({ where: { email } });
        if (existingUser) {
            return res.status(400).json({ error: 'Email already exists' });
        }

        // 生成随机推荐码
        const referralCode = Math.random().toString(36).substring(2, 10);

        // 创建用户
        const hashedPassword = await bcrypt.hash(password, 10);
        const user = await User.create({
            email,
            password: hashedPassword,
            referralCode,
            points: 0
        });

        res.status(201).json({
            id: user.id,
            email: user.email,
            referralCode: user.referralCode
        });
    } catch (error) {
        console.error('Error creating user:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// 更新用户
router.patch('/users/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { email, password, points } = req.body;

        const user = await User.findByPk(id);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // 更新字段
        if (email) user.email = email;
        if (points) user.points = parseInt(points);
        if (password) {
            user.password = await bcrypt.hash(password, 10);
        }

        await user.save();
        res.json({ success: true });
    } catch (error) {
        console.error('Error updating user:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// 删除用户
router.delete('/users/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const user = await User.findByPk(id);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        await user.destroy();
        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting user:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// 获取所有任务
router.get('/tasks', async (req, res) => {
    try {
        const tasks = await Task.findAll();
        res.json(tasks);
    } catch (error) {
        console.error('Error getting tasks:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// 更新任务
router.patch('/tasks/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { description } = req.body;

        const task = await Task.findByPk(id);
        if (!task) {
            return res.status(404).json({ error: 'Task not found' });
        }

        if (description) {
            task.description = description;
            await task.save();
        }

        res.json({ success: true });
    } catch (error) {
        console.error('Error updating task:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// 切换任务状态
router.post('/tasks/:id/toggle', async (req, res) => {
    try {
        const { id } = req.params;

        const task = await Task.findByPk(id);
        if (!task) {
            return res.status(404).json({ error: 'Task not found' });
        }

        task.isActive = !task.isActive;
        await task.save();

        res.json({ success: true });
    } catch (error) {
        console.error('Error toggling task:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// 获取系统设置
router.get('/settings', async (req, res) => {
    try {
        // 这里可以从数据库或配置文件中获取设置
        // 目前返回默认值
        res.json({
            referralPoints: 100,
            dailyCheckInPoints: 10
        });
    } catch (error) {
        console.error('Error getting settings:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// 保存系统设置
router.post('/settings', async (req, res) => {
    try {
        const { referralPoints, dailyCheckInPoints } = req.body;
        // 这里可以将设置保存到数据库或配置文件
        // 目前只返回成功
        res.json({ success: true });
    } catch (error) {
        console.error('Error saving settings:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
