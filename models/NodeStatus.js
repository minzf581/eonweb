const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const NodeStatus = sequelize.define('NodeStatus', {
        deviceId: {
            type: DataTypes.STRING,
            primaryKey: true,
            allowNull: false,
        },
        userId: {
            type: DataTypes.INTEGER,
            allowNull: true,
            references: {
                model: 'Users',
                key: 'id'
            },
            comment: '节点所属用户ID'
        },
        status: {
            type: DataTypes.ENUM('active', 'inactive'),
            allowNull: false,
        },
        uploadBandwidth: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: false,
        },
        downloadBandwidth: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: false,
        },
        ipAddress: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        country: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        city: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        lastReportTime: {
            type: DataTypes.DATE,
            allowNull: false,
        },
        proxyBackendId: {
            type: DataTypes.STRING,
            allowNull: false,
            comment: 'IP代理后台的唯一标识',
        },
        // 新增字段
        earnedPoints: {
            type: DataTypes.INTEGER,
            defaultValue: 0,
            comment: '节点获得的积分',
        },
        totalUploadBytes: {
            type: DataTypes.BIGINT,
            defaultValue: 0,
            comment: '总上传流量(bytes)',
        },
        totalDownloadBytes: {
            type: DataTypes.BIGINT,
            defaultValue: 0,
            comment: '总下载流量(bytes)',
        },
        onlineTime: {
            type: DataTypes.INTEGER,
            defaultValue: 0,
            comment: '在线时长(分钟)',
        },
        lastSettlementTime: {
            type: DataTypes.DATE,
            allowNull: true,
            comment: '最后结算时间',
        }
    }, {
        indexes: [
            {
                fields: ['status', 'lastReportTime']
            },
            {
                fields: ['proxyBackendId']
            },
            {
                fields: ['userId']
            },
            {
                fields: ['lastSettlementTime']
            },
            {
                fields: ['ipAddress']
            }
        ]
    });

    return NodeStatus;
};
