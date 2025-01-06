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
                status: 'active'
            },
            include: [{
                model: UserTask,
                as: 'UserTasks',
                where: { userid: userId },
                required: false
            }]
        });

        console.log(`[Tasks] Found ${tasks.length} active tasks`);

        const formattedTasks = tasks.map(task => {
            const formatted = {
                id: task.id,
                name: task.name,
                description: task.description,
                points: task.points,
                type: task.type,
                completed: task.UserTasks && task.UserTasks.length > 0,
                completedAt: task.UserTasks && task.UserTasks.length > 0 ? task.UserTasks[0].endtime : null
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
                userid: userId,
                taskid: taskId
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
            userid: userId,
            taskid: taskId,
            status: 'in_progress',
            starttime: new Date(),
            points: task.points
        });

        console.log(`[Tasks] Created user task record:`, userTask.toJSON());

        res.json({
            success: true,
            message: 'Task started successfully',
            data: {
                taskId: taskId,
                status: 'in_progress',
                startTime: userTask.starttime
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
        taskid: taskId,
        status: ['pending', 'in_progress']
      }
    });
    if (existingTask) {
      return res.status(400).json({ success: false, message: 'Task already in progress' });
    }

    // 创建用户任务
    const userTask = await UserTask.create({
      userid: userId,
      taskid: taskId,
      status: 'in_progress',
      starttime: new Date()
    });

    // 如果是每日签到任务，直接完成
    if (task.type === 'daily') {
      await userTask.update({
        status: 'completed',
        endtime: new Date(),
        points: task.points
      });

      // 更新用户积分
      await User.increment('points', {
        by: task.points,
        where: { id: userId }
      });
    }

    res.json({
      success: true,
      message: 'Task started successfully',
      data: userTask
    });
  } catch (error) {
    console.error('Error in start task:', error);
    res.status(500).json({ success: false, message: 'Failed to start task', error: error.message });
  }
});

// 获取用户任务列表
router.get('/user/list', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const userTasks = await UserTask.findAll({
      where: { userid: userId },
      include: [{
        model: Task,
        attributes: ['name', 'description', 'type', 'points']
      }],
      order: [['createdat', 'DESC']]
    });

    res.json({
      success: true,
      data: userTasks
    });
  } catch (error) {
    console.error('Error in get user tasks:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch user tasks', error: error.message });
  }
});

// Get user tasks
router.get('/user', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        console.log('[Tasks] Fetching user tasks for user:', userId);

        const userTasks = await UserTask.findAll({
            where: {
                userid: userId
            },
            include: [{
                model: Task,
                attributes: ['name', 'description', 'type', 'points']
            }],
            order: [['createdat', 'DESC']]
        });

        console.log(`[Tasks] Found ${userTasks.length} user tasks`);

        const formattedTasks = userTasks.map(userTask => ({
            id: userTask.id,
            taskId: userTask.taskid,
            status: userTask.status,
            startTime: userTask.starttime,
            endTime: userTask.endtime,
            points: userTask.points,
            task: userTask.Task ? {
                name: userTask.Task.name,
                description: userTask.Task.description,
                type: userTask.Task.type,
                points: userTask.Task.points
            } : null
        }));

        res.json({
            success: true,
            data: formattedTasks
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

module.exports = router;
