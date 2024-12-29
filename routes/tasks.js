const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { Task, UserTask } = require('../models');

// Get tasks list
router.get('/', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        console.log('[Tasks] Fetching tasks for user:', userId);

        // Get all active tasks and their completion status
        const tasks = await Task.findAll({
            where: {
                isActive: true,
                status: 'active'
            },
            include: [{
                model: UserTask,
                as: 'userTasks',
                where: { userId },
                required: false
            }]
        });

        console.log(`[Tasks] Found ${tasks.length} active tasks`);

        const formattedTasks = tasks.map(task => {
            const formatted = {
                id: task.id,
                title: task.title,
                description: task.description,
                points: task.points,
                type: task.type,
                completed: task.userTasks && task.userTasks.length > 0,
                completedAt: task.userTasks && task.userTasks.length > 0 ? task.userTasks[0].completedAt : null
            };
            console.log(`[Tasks] Task ${task.id} formatted:`, formatted);
            return formatted;
        });

        console.log('[Tasks] Sending response with formatted tasks');
        res.json({
            success: true,
            data: formattedTasks
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

// Start a task
router.post('/:taskId/start', authenticateToken, async (req, res) => {
    try {
        const { taskId } = req.params;
        const userId = req.user.id;
        console.log(`[Tasks] Starting task ${taskId} for user ${userId}`);

        // Check if task exists and is active
        const task = await Task.findOne({
            where: {
                id: taskId,
                isActive: true,
                status: 'active'
            }
        });

        if (!task) {
            console.log(`[Tasks] Task ${taskId} not found or not active`);
            return res.status(404).json({
                success: false,
                message: 'Task not found or not available'
            });
        }

        // Check if user has already started/completed this task
        const existingUserTask = await UserTask.findOne({
            where: {
                userId,
                taskId
            }
        });

        if (existingUserTask) {
            console.log(`[Tasks] User ${userId} has already started/completed task ${taskId}`);
            return res.status(400).json({
                success: false,
                message: 'You have already started or completed this task'
            });
        }

        // Create user task record
        const userTask = await UserTask.create({
            userId,
            taskId,
            status: 'in_progress',
            startedAt: new Date()
        });

        console.log(`[Tasks] Task ${taskId} started successfully for user ${userId}`);
        res.json({
            success: true,
            message: 'Task started successfully',
            data: {
                taskId,
                status: 'in_progress',
                startedAt: userTask.startedAt
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

module.exports = router;
