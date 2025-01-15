const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { BandwidthTask, User } = require('../models');

// 创建带宽共享任务
router.post('/', authenticateToken, async (req, res) => {
    try {
        const { uploadSpeed, downloadSpeed, duration } = req.body;
        const userId = req.user.id;

        const task = await BandwidthTask.create({
            userId,
            uploadSpeed,
            downloadSpeed,
            duration,
            status: 'pending'
        });

        res.json({
            success: true,
            task
        });
    } catch (error) {
        console.error('Error creating bandwidth task:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create bandwidth task'
        });
    }
});

// 获取用户的带宽共享任务列表
router.get('/', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const tasks = await BandwidthTask.findAll({
            where: { userId },
            order: [['createdAt', 'DESC']]
        });

        res.json({
            success: true,
            tasks
        });
    } catch (error) {
        console.error('Error fetching bandwidth tasks:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch bandwidth tasks'
        });
    }
});

// 启动带宽共享任务
router.post('/:taskId/start', authenticateToken, async (req, res) => {
    try {
        const { taskId } = req.params;
        const userId = req.user.id;

        const task = await BandwidthTask.findOne({
            where: { id: taskId, userId }
        });

        if (!task) {
            return res.status(404).json({
                success: false,
                message: 'Task not found'
            });
        }

        if (task.status !== 'pending') {
            return res.status(400).json({
                success: false,
                message: 'Task is not in pending status'
            });
        }

        await task.update({ status: 'running', startedAt: new Date() });

        res.json({
            success: true,
            task
        });
    } catch (error) {
        console.error('Error starting bandwidth task:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to start bandwidth task'
        });
    }
});

// 停止带宽共享任务
router.post('/:taskId/stop', authenticateToken, async (req, res) => {
    try {
        const { taskId } = req.params;
        const userId = req.user.id;

        const task = await BandwidthTask.findOne({
            where: { id: taskId, userId }
        });

        if (!task) {
            return res.status(404).json({
                success: false,
                message: 'Task not found'
            });
        }

        if (task.status !== 'running') {
            return res.status(400).json({
                success: false,
                message: 'Task is not running'
            });
        }

        const now = new Date();
        const duration = Math.floor((now - task.startedAt) / 1000); // 计算运行时长（秒）
        const points = Math.floor(duration / 60); // 每分钟 1 点积分

        await task.update({
            status: 'completed',
            completedAt: now,
            actualDuration: duration
        });

        // 更新用户积分
        if (points > 0) {
            await User.increment('points', {
                by: points,
                where: { id: userId }
            });
        }

        res.json({
            success: true,
            task,
            pointsEarned: points
        });
    } catch (error) {
        console.error('Error stopping bandwidth task:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to stop bandwidth task'
        });
    }
});

module.exports = router;
