const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { User, Task, UserTask } = require('../models');

// 获取用户统计数据
router.get('/', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        console.log('Fetching stats for user:', userId);

        // 获取用户信息
        const user = await User.findByPk(userId);

        // 获取任务完成统计
        const completedTasks = await UserTask.count({
            where: { userId, status: 'completed' }
        });

        const stats = {
            credits: user.points || 0,
            completedTasks,
            referralCode: user.referralCode || ''
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
