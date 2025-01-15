const express = require('express');
const { validateApiKey } = require('../middleware/auth');

// 定义路由处理器
const handlers = {
  getNodeStats: (req, res) => {
    console.log('[DEBUG] 处理节点统计请求:', {
      deviceId: req.params.deviceId,
      headers: req.headers
    });
    res.json({
      success: true,
      data: {
        deviceId: req.params.deviceId,
        uptime: Math.floor(Math.random() * 1000000),
        memory: {
          total: 8192,
          used: Math.floor(Math.random() * 8192)
        },
        cpu: {
          cores: 4,
          usage: Math.random()
        }
      }
    });
  },
  
  postNodeReport: (req, res) => {
    console.log('[DEBUG] 处理节点报告:', {
      body: req.body,
      headers: req.headers
    });
    res.json({
      success: true,
      message: 'Report received'
    });
  }
};

// 导出处理器
module.exports = { handlers }; 