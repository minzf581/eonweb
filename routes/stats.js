const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { User, Task, UserTask } = require('../models');
const { Op } = require('sequelize');

// 获取用户统计数据
router.get('/', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        console.log('Fetching stats for user:', userId);

        // 获取用户信息
        const user = await User.findByPk(userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // 获取任务完成统计
        const totalTasks = await UserTask.count({
            where: {
                userid: userId,
                status: 'completed'
            }
        });

        // 获取每日任务今日完成数
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const dailyTasks = await UserTask.count({
            where: {
                userid: userId,
                status: 'completed',
                endtime: {
                    [Op.gte]: today
                }
            },
            include: [{
                model: Task,
                where: {
                    type: 'daily'
                }
            }]
        });

        // 获取总积分
        const pointsEarned = await UserTask.sum('points', {
            where: {
                userid: userId,
                status: 'completed'
            }
        });

        // 获取今日积分
        const todayPoints = await UserTask.sum('points', {
            where: {
                userid: userId,
                status: 'completed',
                endtime: {
                    [Op.gte]: today
                }
            }
        });

        const stats = {
            totalTasks,
            dailyTasks,
            pointsEarned: pointsEarned || 0,
            todayPoints: todayPoints || 0,
            currentPoints: user.points
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
