const express = require('express');
const router = express.Router();
const { User, UserTask, Task } = require('../models');
const { authenticate } = require('../middleware/auth');

// 获取用户积分统计
router.get('/points/stats', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;

    // 获取用户总积分
    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // 获取用户完成的任务统计
    const taskStats = await UserTask.findAll({
      where: { userId, status: 'completed' },
      include: [{
        model: Task,
        attributes: ['type']
      }],
      attributes: [
        [sequelize.fn('COUNT', sequelize.col('UserTask.id')), 'count'],
        [sequelize.fn('SUM', sequelize.col('UserTask.points')), 'totalPoints'],
        [sequelize.col('Task.type'), 'taskType']
      ],
      group: ['Task.type']
    });

    res.json({
      success: true,
      data: {
        totalPoints: user.points,
        taskStats: taskStats.map(stat => ({
          taskType: stat.get('taskType'),
          count: parseInt(stat.get('count')),
          points: parseInt(stat.get('totalPoints'))
        }))
      }
    });
  } catch (error) {
    console.error('Error in get points stats:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch stats', error: error.message });
  }
});

module.exports = router;
