const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { Task, UserTask, User } = require('../models');

// Get available tasks
router.get('/available', authenticateToken, async (req, res) => {
    try {
        const tasks = await Task.findAll({
            where: { status: 'active' }
        });

        res.json({
            success: true,
            data: tasks.map(task => ({
                ...task.toJSON(),
                title: task.name // Add title field for frontend compatibility
            }))
        });
    } catch (error) {
        console.error('[Tasks] Error fetching available tasks:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to fetch available tasks',
            error: error.message 
        });
    }
});

// Get all tasks
router.get('/', authenticateToken, async (req, res) => {
    try {
        console.log('[Tasks] Fetching tasks for user:', req.user.id);
        const tasks = await Task.findAll({
            attributes: [
                'id', 'name', 'description', 'type', 'points', 'status',
                'created_at', 'updated_at', 'deleted_at'
            ],
            include: [{
                model: UserTask,
                as: 'userTasks',
                attributes: [
                    'id', 'userid', 'taskid', 'status', 'points',
                    'created_at', 'updated_at', 'deleted_at'
                ],
                where: { userid: req.user.id },
                required: false
            }]
        });

        console.log('[Tasks] Successfully fetched tasks');
        res.json({
            success: true,
            data: tasks.map(task => ({
                ...task.toJSON(),
                title: task.name // Add title field for frontend compatibility
            }))
        });
    } catch (error) {
        console.error('[Tasks] Error fetching tasks:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to fetch tasks',
            error: error.message 
        });
    }
});

// Get user tasks
router.get('/user/list', authenticateToken, async (req, res) => {
    try {
        const userTasks = await UserTask.findAll({
            where: { userid: req.user.id },
            include: [{
                model: Task,
                as: 'task'
            }]
        });
        
        res.json({
            success: true,
            data: userTasks.map(userTask => ({
                ...userTask.toJSON(),
                task: userTask.task ? {
                    ...userTask.task.toJSON(),
                    title: userTask.task.name // Add title field for frontend compatibility
                } : null
            }))
        });
    } catch (error) {
        console.error('[Tasks] Error fetching user tasks:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to fetch user tasks',
            error: error.message 
        });
    }
});

// Start a task
router.post('/start/:taskId', authenticateToken, async (req, res) => {
    try {
        const task = await Task.findByPk(req.params.taskId);
        if (!task) {
            return res.status(404).json({ 
                success: false,
                message: 'Task not found' 
            });
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
            return res.status(400).json({ 
                success: false,
                message: 'Task already started' 
            });
        }

        res.json({
            success: true,
            data: {
                ...userTask.toJSON(),
                task: {
                    ...task.toJSON(),
                    title: task.name // Add title field for frontend compatibility
                }
            }
        });
    } catch (error) {
        console.error('[Tasks] Error starting task:', error);
        res.status(500).json({ 
            success: false,
            message: 'Failed to start task',
            error: error.message 
        });
    }
});

// Complete a task
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

        // Update user points
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
