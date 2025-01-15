const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { User, Task, UserTask } = require('../models');
const { Op } = require('sequelize');

// 获取用户统计数据
router.get('/', authenticateToken, async (req, res) => {
  try {
    console.log('[Stats] Fetching stats for user:', req.user.id);

    const user = await User.findOne({
      where: { id: req.user.id },
      attributes: ['id', 'email', 'points', 'credits', 'referral_code']
    });

    if (!user) {
      console.error('[Stats] User not found:', req.user.id);
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

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

    console.log('[Stats] Stats fetched successfully:', {
      userId: user.id,
      points: user.points,
      credits: user.credits,
      completedTasks,
      totalPoints,
      referralCode: user.referral_code
    });

    res.json({
      success: true,
      data: {
        points: user.points,
        credits: user.credits,
        completedTasks,
        totalPoints,
        referralCode: user.referral_code
      }
    });
  } catch (error) {
    console.error('[Stats] Error fetching stats:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to fetch stats',
      error: error.message
    });
  }
});

module.exports = router;
