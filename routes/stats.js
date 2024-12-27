const express = require('express');
const router = express.Router();
const authenticate = require('../middleware/auth');
const { User, Task, UserTask } = require('../models');

// 获取用户统计数据
router.get('/api/stats', authenticate, async (req, res) => {
    try {
        const userId = req.user.id;
        console.log('Fetching stats for user:', userId);

        // 获取用户信息
        const user = await User.findByPk(userId);

        // 获取任务完成统计
        const completedTasks = await UserTask.count({
            where: { userId }
        });

        // 获取总任务数
        const totalTasks = await Task.count();

        // 计算任务完成率
        const completionRate = totalTasks > 0 ? (completedTasks / totalTasks * 100).toFixed(2) : 0;

        const stats = {
            points: user.points || 0,
            completedTasks,
            totalTasks,
            completionRate: parseFloat(completionRate)
        };

        console.log('Stats data:', stats);

        res.json({
            success: true,
            data: stats
        });
    } catch (error) {
        console.error('Error fetching stats:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch stats',
            error: error.message
        });
    }
});

module.exports = router;
