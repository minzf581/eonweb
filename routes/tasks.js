const express = require('express');
const router = express.Router();
const authenticate = require('../middleware/auth');
const { Task, UserTask } = require('../models');

// 获取任务列表
router.get('/tasks', authenticate, async (req, res) => {
    try {
        const userId = req.user.id;
        console.log('Fetching tasks for user:', userId);

        // 获取所有任务及其完成状态
        const tasks = await Task.findAll({
            include: [{
                model: UserTask,
                where: { userId },
                required: false
            }]
        });

        const formattedTasks = tasks.map(task => ({
            id: task.id,
            title: task.title,
            description: task.description,
            points: task.points,
            type: task.type,
            completed: task.UserTasks && task.UserTasks.length > 0,
            completedAt: task.UserTasks && task.UserTasks.length > 0 ? task.UserTasks[0].completedAt : null
        }));

        console.log('Tasks data:', formattedTasks);

        res.json({
            success: true,
            data: formattedTasks
        });
    } catch (error) {
        console.error('Error fetching tasks:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch tasks',
            error: error.message
        });
    }
});

module.exports = router;
