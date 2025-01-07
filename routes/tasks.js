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

// 获取所有任务
router.get('/', authenticateToken, async (req, res) => {
    try {
        const tasks = await Task.findAll({
            include: [{
                model: UserTask,
                as: 'userTasks',
                where: { userid: req.user.id },
                required: false
            }]
        });
        res.json(tasks);
    } catch (error) {
        console.error('Error fetching tasks:', error);
        res.status(500).json({ message: 'Error fetching tasks' });
    }
});

// 获取用户任务列表
router.get('/user', authenticateToken, async (req, res) => {
    try {
        const userTasks = await UserTask.findAll({
            where: { userid: req.user.id },
            include: [{
                model: Task,
                as: 'task'
            }]
        });
        res.json(userTasks);
    } catch (error) {
        console.error('Error fetching user tasks:', error);
        res.status(500).json({ message: 'Error fetching user tasks' });
    }
});

// 开始任务
router.post('/start/:taskId', authenticateToken, async (req, res) => {
    try {
        const task = await Task.findByPk(req.params.taskId);
        if (!task) {
            return res.status(404).json({ message: 'Task not found' });
        }

        const [userTask, created] = await UserTask.findOrCreate({
            where: {
                userid: req.user.id,
                taskid: task.id,
                status: 'pending'
            },
            defaults: {
                start_time: new Date(),
                points: task.points
            }
        });

        if (!created) {
            return res.status(400).json({ message: 'Task already started' });
        }

        res.json(userTask);
    } catch (error) {
        console.error('Error starting task:', error);
        res.status(500).json({ message: 'Error starting task' });
    }
});

// 完成任务
router.post('/complete/:taskId', authenticateToken, async (req, res) => {
    try {
        const userTask = await UserTask.findOne({
            where: {
                userid: req.user.id,
                taskid: req.params.taskId,
                status: 'pending'
            }
        });

        if (!userTask) {
            return res.status(404).json({ message: 'Active task not found' });
        }

        userTask.status = 'completed';
        userTask.end_time = new Date();
        await userTask.save();

        // 更新用户积分
        await User.increment('points', {
            by: userTask.points,
            where: { id: req.user.id }
        });

        res.json(userTask);
    } catch (error) {
        console.error('Error completing task:', error);
        res.status(500).json({ message: 'Error completing task' });
    }
});

module.exports = router;
