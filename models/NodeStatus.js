const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const NodeStatus = sequelize.define('NodeStatus', {
        deviceId: {
            type: DataTypes.STRING,
            primaryKey: true,
            allowNull: false,
        },
        username: {
            type: DataTypes.STRING,
            allowNull: false,
            comment: '节点所属用户名'
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
            type: DataTypes.ENUM('online', 'offline'),
            allowNull: false,
            defaultValue: 'offline',
            comment: '节点状态'
        },
        ipAddress: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        lastStatusChange: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW,
            comment: '最后状态变更时间'
        },
        lastReportTime: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW,
            comment: '最后上报时间'
        },
        lastReportType: {
            type: DataTypes.ENUM('status_change', 'daily'),
            allowNull: false,
            defaultValue: 'status_change',
            comment: '最后上报类型'
        },
        lastReportDuration: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 0,
            comment: '上次上报到本次的在线时长(秒)'
        },
        lastReportUpload: {
            type: DataTypes.BIGINT,
            allowNull: false,
            defaultValue: 0,
            comment: '上次上报到本次的上传流量(bytes)'
        },
        lastReportDownload: {
            type: DataTypes.BIGINT,
            allowNull: false,
            defaultValue: 0,
            comment: '上次上报到本次的下载流量(bytes)'
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
        totalOnlineTime: {
            type: DataTypes.INTEGER,
            defaultValue: 0,
            comment: '总在线时长(秒)',
        },
        proxyBackendId: {
            type: DataTypes.STRING,
            allowNull: false,
            comment: 'IP代理后台的唯一标识',
        }
    }, {
        indexes: [
            {
                fields: ['status', 'lastStatusChange']
            },
            {
                fields: ['lastReportTime']
            },
            {
                fields: ['proxyBackendId']
            },
            {
                fields: ['userId']
            },
            {
                fields: ['username']
            },
            {
                fields: ['ipAddress']
            }
        ]
    });

    return NodeStatus;
};
