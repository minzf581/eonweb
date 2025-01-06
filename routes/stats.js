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
                user_id: userId,
                status: 'completed'
            }
        });

        // 获取每日任务今日完成数
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const dailyTasks = await UserTask.count({
            where: {
                user_id: userId,
                status: 'completed',
                end_time: {
                    [Op.gte]: today
                }
            },
            include: [{
                model: Task,
                as: 'task',
                where: {
                    type: 'daily'
                }
            }]
        });

        // 获取总积分
        const pointsEarned = await UserTask.sum('points', {
            where: {
                user_id: userId,
                status: 'completed'
            }
        });

        // 获取今日积分
        const todayPoints = await UserTask.sum('points', {
            where: {
                user_id: userId,
                status: 'completed',
                end_time: {
                    [Op.gte]: today
                }
            }
        });

        // 获取带宽任务统计
        const bandwidthTasks = await UserTask.count({
            where: {
                user_id: userId,
                status: 'completed'
            },
            include: [{
                model: Task,
                as: 'task',
                where: {
                    type: 'bandwidth'
                }
            }]
        });

        const stats = {
            total_tasks: totalTasks,
            daily_tasks: dailyTasks,
            points_earned: pointsEarned || 0,
            today_points: todayPoints || 0,
            current_points: user.points
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
