const express = require('express');
const router = express.Router();
const { authenticateProxyBackend } = require('../middleware/proxyAuth');
const { NodeStatus, User, PointHistory } = require('../models');
const { validateBatchReport } = require('../validators/proxyValidator');
const sequelize = require('../config/database');

// 计算积分的辅助函数
const calculatePoints = (bandwidth, timeInMinutes) => {
    // 积分计算规则：
    // 1. 基础在线积分：每小时1点
    // 2. 带宽积分：每GB上传流量10点，下载流量5点
    const onlinePoints = Math.floor(timeInMinutes / 60);
    const trafficPoints = Math.floor(bandwidth.upload / 1024) * 10 + 
                         Math.floor(bandwidth.download / 1024) * 5;
    return onlinePoints + trafficPoints;
};

// 查找或创建用户的辅助函数
const findUserByIP = async (ipAddress, transaction) => {
    const pointHistory = await PointHistory.findOne({
        where: {
            type: 'bandwidth_sharing',
            metadata: {
                [sequelize.Op.like]: `%${ipAddress}%`
            }
        },
        order: [['createdAt', 'DESC']],
        transaction
    });

    if (pointHistory) {
        return User.findByPk(pointHistory.userId, { transaction });
    }

    return null;
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
            const existingNode = existingNodesMap.get(node.deviceId);
            const timeDiff = existingNode ? 
                Math.floor((timestamp - existingNode.lastReportTime) / (1000 * 60)) : 0;
            
            // 查找关联用户
            const user = await findUserByIP(node.ipAddress, transaction);
            
            // 计算新增积分
            const newPoints = calculatePoints(node.bandwidth, timeDiff);
            
            // 如果找到用户，更新积分
            if (user && newPoints > 0) {
                await PointHistory.create({
                    userId: user.id,
                    points: newPoints,
                    type: 'bandwidth_sharing',
                    metadata: JSON.stringify({
                        deviceId: node.deviceId,
                        ipAddress: node.ipAddress,
                        uploadBandwidth: node.bandwidth.upload,
                        downloadBandwidth: node.bandwidth.download,
                        onlineTime: timeDiff,
                        timestamp: timestamp.toISOString()
                    }),
                    status: 'completed'
                }, { transaction });

                await user.increment('points', { 
                    by: newPoints, 
                    transaction 
                });
            }
            
            return {
                deviceId: node.deviceId,
                userId: user?.id,
                status: node.status,
                uploadBandwidth: node.bandwidth.upload,
                downloadBandwidth: node.bandwidth.download,
                ipAddress: node.ipAddress,
                country: node.location?.country,
                city: node.location?.city,
                lastReportTime: timestamp,
                proxyBackendId,
                totalUploadBytes: sequelize.literal(`COALESCE(totalUploadBytes, 0) + ${node.bandwidth.upload * 1024 * 1024}`),
                totalDownloadBytes: sequelize.literal(`COALESCE(totalDownloadBytes, 0) + ${node.bandwidth.download * 1024 * 1024}`),
                onlineTime: sequelize.literal(`COALESCE(onlineTime, 0) + ${timeDiff}`)
            };
        }));

        // 批量更新节点状态
        await NodeStatus.bulkCreate(nodeStatusData, {
            updateOnDuplicate: [
                'userId',
                'status', 
                'uploadBandwidth', 
                'downloadBandwidth', 
                'ipAddress', 
                'country', 
                'city', 
                'lastReportTime',
                'totalUploadBytes',
                'totalDownloadBytes',
                'onlineTime'
            ],
            transaction
        });

        // 更新代理后台统计信息
        const activeNodesCount = nodes.filter(node => node.status === 'active').length;
        await ProxyBackend.update({
            lastSyncTime: timestamp,
            totalNodes: nodes.length,
            activeNodes: activeNodesCount
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
                processedNodes: nodes.length,
                activeNodes: activeNodesCount
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
                [sequelize.fn('SUM', sequelize.col('onlineTime')), 'totalOnlineTime']
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
