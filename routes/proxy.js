const express = require('express');
const router = express.Router();
const { authenticateProxyBackend } = require('../middleware/proxyAuth');
const { NodeStatus, User, PointHistory, ProxyBackend } = require('../models');
const { validateBatchReport } = require('../validators/proxyValidator');
const sequelize = require('../config/sequelize');

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

module.exports = router;
