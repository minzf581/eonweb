const express = require('express');
const router = express.Router();
const { authenticateProxyBackend } = require('../middleware/proxyAuth');
const { NodeStatus, User, PointHistory, ProxyBackend } = require('../models');
const { validateBatchReport } = require('../validators/proxyValidator');
const sequelize = require('../config/sequelize');
const { ProxyNode } = require('../models');
const { checkApiKey } = require('../middleware/auth');
const { authenticateToken } = require('../middleware/auth');

// 计算积分的辅助函数
const calculatePoints = (traffic, duration) => {
    // 积分计算规则：
    // 1. 基础在线积分：每小时1点
    // 2. 带宽积分：每GB上传流量10点，下载流量5点
    const onlinePoints = Math.floor(duration / 3600); // 将秒转换为小时
    const trafficPoints = Math.floor(traffic.upload / (1024 * 1024 * 1024)) * 10 + 
                         Math.floor(traffic.download / (1024 * 1024 * 1024)) * 5;
    return onlinePoints + trafficPoints;
};

// 查找用户的辅助函数
const findUser = async (username, transaction) => {
    return User.findOne({
        where: { username },
        transaction
    });
};

// 批量上报节点状态
router.post('/report/batch', authenticateProxyBackend, validateBatchReport, async (req, res) => {
    const transaction = await sequelize.transaction();
    
    try {
        const { nodes } = req.body;
        const proxyBackendId = req.proxyBackend.id;
        const timestamp = new Date();

        // 获取现有节点状态
        const existingNodes = await NodeStatus.findAll({
            where: {
                deviceId: nodes.map(n => n.deviceId),
                proxyBackendId
            },
            transaction
        });

        // 创建deviceId到现有节点的映射
        const existingNodesMap = new Map(
            existingNodes.map(node => [node.deviceId, node])
        );

        // 处理每个节点
        const nodeStatusData = await Promise.all(nodes.map(async node => {
            // 查找用户
            const user = await findUser(node.username, transaction);
            if (!user) {
                console.warn(`User not found for username: ${node.username}`);
                return null;
            }

            const existingNode = existingNodesMap.get(node.deviceId);
            
            // 计算新增积分
            const newPoints = calculatePoints(node.traffic, node.duration);
            
            // 更新积分
            if (newPoints > 0) {
                await PointHistory.create({
                    userId: user.id,
                    points: newPoints,
                    type: 'bandwidth_sharing',
                    metadata: JSON.stringify({
                        deviceId: node.deviceId,
                        ipAddress: node.ipAddress,
                        status: node.status,
                        duration: node.duration,
                        upload: node.traffic.upload,
                        download: node.traffic.download,
                        reportType: node.reportType,
                        timestamp: timestamp.toISOString()
                    }),
                    status: 'completed'
                }, { transaction });

                await user.increment('points', { 
                    by: newPoints, 
                    transaction 
                });
            }
            
            const nodeData = {
                deviceId: node.deviceId,
                username: node.username,
                userId: user.id,
                proxyBackendId: proxyBackendId,
                status: node.status,
                ipAddress: node.ipAddress,
                lastReportTime: timestamp,
                lastReportType: node.reportType,
                lastReportDuration: node.duration,
                lastReportUpload: node.traffic.upload,
                lastReportDownload: node.traffic.download,
                totalUploadBytes: sequelize.literal(`COALESCE(totalUploadBytes, 0) + ${node.traffic.upload}`),
                totalDownloadBytes: sequelize.literal(`COALESCE(totalDownloadBytes, 0) + ${node.traffic.download}`),
                totalOnlineTime: sequelize.literal(`COALESCE(totalOnlineTime, 0) + ${node.duration}`)
            };

            // 如果是状态变更上报，更新状态变更时间
            if (node.reportType === 'status_change') {
                nodeData.lastStatusChange = timestamp;
            }

            return nodeData;
        }));

        // 过滤掉无效的节点（用户不存在的情况）
        const validNodes = nodeStatusData.filter(node => node !== null);

        // 批量更新节点状态
        await NodeStatus.bulkCreate(validNodes, {
            updateOnDuplicate: [
                'username',
                'userId',
                'proxyBackendId',
                'status', 
                'ipAddress',
                'lastStatusChange',
                'lastReportTime',
                'lastReportType',
                'lastReportDuration',
                'lastReportUpload',
                'lastReportDownload',
                'totalUploadBytes',
                'totalDownloadBytes',
                'totalOnlineTime'
            ],
            transaction
        });

        // 更新代理后台统计信息
        const onlineNodesCount = validNodes.filter(node => node.status === 'online').length;
        await ProxyBackend.update({
            lastSyncTime: timestamp,
            totalNodes: validNodes.length,
            activeNodes: onlineNodesCount
        }, {
            where: { id: proxyBackendId },
            transaction
        });

        await transaction.commit();

        res.json({
            code: 200,
            message: 'success',
            data: {
                syncTime: timestamp,
                processedNodes: validNodes.length,
                activeNodes: onlineNodesCount,
                skippedNodes: nodes.length - validNodes.length
            }
        });
    } catch (error) {
        await transaction.rollback();
        console.error('Error in batch report:', error);
        res.status(500).json({
            code: 500,
            message: 'Internal server error',
            error: error.message
        });
    }
});

// 获取节点状态统计
router.get('/stats', authenticateProxyBackend, async (req, res) => {
    try {
        const proxyBackendId = req.proxyBackend.id;
        
        const stats = await NodeStatus.findAll({
            attributes: [
                'status',
                [sequelize.fn('COUNT', sequelize.col('deviceId')), 'count'],
                [sequelize.fn('SUM', sequelize.col('totalUploadBytes')), 'totalUploadBytes'],
                [sequelize.fn('SUM', sequelize.col('totalDownloadBytes')), 'totalDownloadBytes'],
                [sequelize.fn('SUM', sequelize.col('totalOnlineTime')), 'totalOnlineTime']
            ],
            where: { proxyBackendId },
            group: ['status']
        });

        res.json({
            code: 200,
            message: 'success',
            data: stats
        });
    } catch (error) {
        console.error('Error in getting stats:', error);
        res.status(500).json({
            code: 500,
            message: 'Internal server error',
            error: error.message
        });
    }
});

// 代理节点状态上报
router.post('/nodes/report', checkApiKey, async (req, res) => {
  try {
    const { deviceId, username, status, ipAddress, duration, traffic, reportType } = req.body;

    // 查找用户
    const user = await User.findOne({ where: { email: username } });
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // 查找或创建代理节点
    let proxyNode = await ProxyNode.findOne({ where: { deviceId } });
    if (!proxyNode) {
      proxyNode = await ProxyNode.create({
        deviceId,
        userId: user.id,
        status,
        ipAddress,
        lastSeenAt: new Date()
      });
    } else {
      // 更新节点状态
      await proxyNode.update({
        status,
        ipAddress,
        lastSeenAt: new Date()
      });
    }

    // 如果是每日上报，更新流量统计
    if (reportType === 'daily') {
      await proxyNode.increment({
        totalUploadBytes: traffic.upload,
        totalDownloadBytes: traffic.download,
        totalOnlineSeconds: duration
      });
    }

    res.json({ success: true, message: 'Report received' });
  } catch (error) {
    console.error('Error in proxy report:', error);
    res.status(500).json({ success: false, message: 'Failed to process report' });
  }
});

// 获取节点统计
router.get('/nodes/:deviceId/stats', checkApiKey, async (req, res) => {
  try {
    const { deviceId } = req.params;

    const proxyNode = await ProxyNode.findOne({ where: { deviceId } });
    if (!proxyNode) {
      return res.status(404).json({ success: false, message: 'Node not found' });
    }

    res.json({
      success: true,
      data: {
        deviceId: proxyNode.deviceId,
        status: proxyNode.status,
        ipAddress: proxyNode.ipAddress,
        lastSeenAt: proxyNode.lastSeenAt,
        totalUploadBytes: proxyNode.totalUploadBytes,
        totalDownloadBytes: proxyNode.totalDownloadBytes,
        totalOnlineSeconds: proxyNode.totalOnlineSeconds
      }
    });
  } catch (error) {
    console.error('Error in get node stats:', error);
    res.status(500).json({ success: false, message: 'Failed to get node stats' });
  }
});

// Node online report
router.post('/online', authenticateToken, async (req, res) => {
    try {
        const { nodeId, ip, port } = req.body;
        console.log(`[Proxy] Node online report - nodeId: ${nodeId}, ip: ${ip}, port: ${port}`);

        // Create or update proxy node
        const [node, created] = await ProxyNode.findOrCreate({
            where: { deviceId: nodeId },
            defaults: {
                ip,
                port,
                status: 'online',
                lastSeenAt: new Date()
            }
        });

        if (!created) {
            await node.update({
                ip,
                port,
                status: 'online',
                lastSeenAt: new Date()
            });
        }

        // Create node status record
        await NodeStatus.create({
            deviceId: nodeId,
            status: 'online',
            timestamp: new Date()
        });

        res.json({
            success: true,
            message: 'Node online status reported successfully'
        });
    } catch (error) {
        console.error('[Proxy] Error reporting node online status:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to report node online status',
            error: error.message
        });
    }
});

// Node daily report
router.post('/daily', authenticateToken, async (req, res) => {
    try {
        const { nodeId, bandwidth, connections, uptime } = req.body;
        console.log(`[Proxy] Node daily report - nodeId: ${nodeId}`);

        // Update proxy node stats
        const node = await ProxyNode.findOne({
            where: { deviceId: nodeId }
        });

        if (!node) {
            return res.status(404).json({
                success: false,
                message: 'Node not found'
            });
        }

        await node.update({
            bandwidth,
            connections,
            uptime,
            lastReport: new Date()
        });

        // Create node status record
        await NodeStatus.create({
            deviceId: nodeId,
            status: 'active',
            bandwidth,
            connections,
            uptime,
            timestamp: new Date()
        });

        res.json({
            success: true,
            message: 'Node daily report submitted successfully'
        });
    } catch (error) {
        console.error('[Proxy] Error submitting node daily report:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to submit node daily report',
            error: error.message
        });
    }
});

// Node offline report
router.post('/offline', authenticateToken, async (req, res) => {
    try {
        const { nodeId } = req.body;
        console.log(`[Proxy] Node offline report - nodeId: ${nodeId}`);

        // Update proxy node status
        const node = await ProxyNode.findOne({
            where: { deviceId: nodeId }
        });

        if (!node) {
            return res.status(404).json({
                success: false,
                message: 'Node not found'
            });
        }

        await node.update({
            status: 'offline',
            lastOffline: new Date()
        });

        // Create node status record
        await NodeStatus.create({
            deviceId: nodeId,
            status: 'offline',
            timestamp: new Date()
        });

        res.json({
            success: true,
            message: 'Node offline status reported successfully'
        });
    } catch (error) {
        console.error('[Proxy] Error reporting node offline status:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to report node offline status',
            error: error.message
        });
    }
});

// Get node statistics
router.get('/stats', authenticateToken, async (req, res) => {
    try {
        console.log('[Proxy] Fetching node statistics');

        // Get all nodes with their latest status
        const nodes = await ProxyNode.findAll({
            attributes: [
                'deviceId',
                'ip',
                'port',
                'status',
                'bandwidth',
                'connections',
                'uptime',
                'lastSeenAt',
                'lastOffline',
                'lastReport'
            ],
            order: [['createdAt', 'DESC']]
        });

        // Get total statistics
        const totalStats = await ProxyNode.findAll({
            attributes: [
                [sequelize.fn('COUNT', sequelize.col('deviceId')), 'totalNodes'],
                [sequelize.fn('SUM', sequelize.col('bandwidth')), 'totalBandwidth'],
                [sequelize.fn('SUM', sequelize.col('connections')), 'totalConnections'],
                [sequelize.fn('AVG', sequelize.col('uptime')), 'averageUptime']
            ],
            where: {
                status: 'online'
            }
        });

        res.json({
            success: true,
            data: {
                nodes,
                stats: totalStats[0]
            }
        });
    } catch (error) {
        console.error('[Proxy] Error fetching node statistics:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch node statistics',
            error: error.message
        });
    }
});

module.exports = router;
