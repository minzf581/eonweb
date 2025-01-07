const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { Task, UserTask, User } = require('../models');

// 获取可用任务列表
router.get('/available', authenticateToken, async (req, res) => {
    try {
        const tasks = await Task.findAll({
            where: { status: 'active' }
        });

        res.json({
            success: true,
            data: tasks
        });
    } catch (error) {
        console.error('Error in get available tasks:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch tasks', error: error.message });
    }
});

// 开始任务
router.post('/:taskId/start', authenticateToken, async (req, res) => {
    try {
        const { taskId } = req.params;
        const userId = req.user.id;

        // 检查任务是否存在
        const task = await Task.findOne({
            where: { id: taskId, status: 'active' }
        });
        if (!task) {
            return res.status(404).json({ success: false, message: 'Task not found' });
        }

        // 检查用户是否已经开始了这个任务
        const existingTask = await UserTask.findOne({
            where: {
                userid: userId,
                task_id: taskId,
                status: ['pending', 'in_progress']
            }
        });
        if (existingTask) {
            return res.status(400).json({ success: false, message: 'Task already in progress' });
        }

        // 创建用户任务
        const userTask = await UserTask.create({
            userid: userId,
            task_id: taskId,
            status: 'in_progress',
            start_time: new Date(),
            end_time: null,
            points: task.points
        });

        res.json({
            success: true,
            message: 'Task started successfully',
            data: {
                task_id: taskId,
                userid: userId,
                status: 'in_progress',
                start_time: userTask.start_time
            }
        });
    } catch (error) {
        console.error('Error in start task:', error);
        res.status(500).json({ success: false, message: 'Failed to start task', error: error.message });
    }
});

// 获取用户任务列表
router.get('/user/list', authenticateToken, async (req, res) => {
    try {
        const tasks = await UserTask.findAll({
            where: {
                userid: req.user.id
            },
            include: [{
                model: Task,
                as: 'task',
                required: true
            }],
            order: [['created_at', 'DESC']]
        });

        res.json({
            success: true,
            data: tasks
        });
    } catch (error) {
        console.error('Error in get user tasks:', error);
        res.status(500).json({ error: 'Failed to fetch user tasks' });
    }
});

// 完成任务
router.post('/:taskId/complete', authenticateToken, async (req, res) => {
    try {
        const { taskId } = req.params;
        const userId = req.user.id;

        // 查找用户任务
        const userTask = await UserTask.findOne({
            where: {
                userid: userId,
                task_id: taskId,
                status: 'in_progress'
            }
        });

        if (!userTask) {
            return res.status(404).json({ success: false, message: 'Task not found or not in progress' });
        }

        // 更新任务状态
        await userTask.update({
            status: 'completed',
            end_time: new Date()
        });

        // 更新用户积分
        await User.increment('points', {
            by: userTask.points,
            where: { id: userId }
        });

        res.json({
            success: true,
            message: 'Task completed successfully',
            data: {
                task_id: taskId,
                userid: userId,
                status: 'completed',
                points: userTask.points
            }
        });
    } catch (error) {
        console.error('Error in complete task:', error);
        res.status(500).json({ success: false, message: 'Failed to complete task', error: error.message });
    }
});

module.exports = router;
