const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const NodeStatus = sequelize.define('NodeStatus', {
        device_id: {
            type: DataTypes.STRING,
            primaryKey: true,
            allowNull: false,
        },
        username: {
            type: DataTypes.STRING,
            allowNull: false,
            comment: '节点所属用户名'
        },
        user_id: {
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
        ip_address: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        last_status_change: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW,
            comment: '最后状态变更时间'
        },
        last_report_time: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW,
            comment: '最后上报时间'
        },
        last_report_type: {
            type: DataTypes.ENUM('status_change', 'daily'),
            allowNull: false,
            defaultValue: 'status_change',
            comment: '最后上报类型'
        },
        last_report_duration: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 0,
            comment: '上次上报到本次的在线时长(秒)'
        },
        last_report_upload: {
            type: DataTypes.BIGINT,
            allowNull: false,
            defaultValue: 0,
            comment: '上次上报到本次的上传流量(bytes)'
        },
        last_report_download: {
            type: DataTypes.BIGINT,
            allowNull: false,
            defaultValue: 0,
            comment: '上次上报到本次的下载流量(bytes)'
        },
        total_upload_bytes: {
            type: DataTypes.BIGINT,
            defaultValue: 0,
            comment: '总上传流量(bytes)',
        },
        total_download_bytes: {
            type: DataTypes.BIGINT,
            defaultValue: 0,
            comment: '总下载流量(bytes)',
        },
        total_online_time: {
            type: DataTypes.INTEGER,
            defaultValue: 0,
            comment: '总在线时长(秒)',
        },
        proxy_backend_id: {
            type: DataTypes.STRING,
            allowNull: false,
            comment: 'IP代理后台的唯一标识',
        }
    }, {
        indexes: [
            {
                fields: ['status', 'last_status_change']
            },
            {
                fields: ['last_report_time']
            },
            {
                fields: ['proxy_backend_id']
            },
            {
                fields: ['user_id']
            },
            {
                fields: ['username']
            },
            {
                fields: ['ip_address']
            }
        ]
    });

    return NodeStatus;
};
