const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { User, Task, UserTask } = require('../models');
const { Op } = require('sequelize');

// 获取用户统计数据
router.get('/', authenticateToken, async (req, res) => {
  try {
    const user = await User.findOne({
      where: { id: req.user.id }
    });

    const completedTasks = await UserTask.count({
      where: {
        userid: req.user.id,
        status: 'completed'
      }
    });

    const totalPoints = await UserTask.sum('points', {
      where: {
        userid: req.user.id,
        status: 'completed'
      }
    }) || 0;

    res.json({
      success: true,
      data: {
        points: user.points,
        completedTasks,
        totalPoints
      }
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

module.exports = router;
