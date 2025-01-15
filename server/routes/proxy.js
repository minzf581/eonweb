const express = require('express');
const { validateApiKey } = require('../middleware/auth');

// 定义路由处理器
const handlers = {
  async getNodeStats(req, res) {
    console.log('[DEBUG] 进入节点统计路由处理:', {
      requestId: req.requestId,
      deviceId: req.params.deviceId,
      path: req.path,
      baseUrl: req.baseUrl,
      originalUrl: req.originalUrl,
      stack: new Error().stack
    });
    try {
      res.json({
        success: true,
        data: {
          deviceId: req.params.deviceId,
          status: 'online',
          stats: {
            uptime: 0,
            traffic: {
              upload: 0,
              download: 0
            }
          }
        }
      });
    } catch (error) {
      console.error('获取节点统计错误:', error);
      res.status(500).json({ 
        success: false, 
        message: error.message,
        requestId: req.requestId
      });
    }
  },
  
  async postNodeReport(req, res) {
    console.log('[DEBUG] 进入节点报告路由处理:', {
      requestId: req.requestId,
      path: req.path,
      baseUrl: req.baseUrl,
      originalUrl: req.originalUrl,
      stack: new Error().stack
    });
    try {
      console.log('处理节点报告:', req.body);
      res.json({ 
        success: true, 
        message: 'Report received',
        data: req.body,
        requestId: req.requestId
      });
    } catch (error) {
      console.error('节点报告错误:', error);
      res.status(500).json({ 
        success: false, 
        message: error.message,
        requestId: req.requestId
      });
    }
  }
};

// 导出处理器
module.exports = {
  handlers,
  validateApiKey
}; 