const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const NodeStatus = sequelize.define('NodeStatus', {
        nodeid: {
            type: DataTypes.STRING,
            allowNull: false,
            references: {
                model: 'proxy_nodes',
                key: 'nodeid'
            }
        },
        status: {
            type: DataTypes.ENUM('online', 'offline', 'active'),
            allowNull: false
        },
        bandwidth: {
            type: DataTypes.BIGINT,
            defaultValue: 0
        },
        connections: {
            type: DataTypes.INTEGER,
            defaultValue: 0
        },
        uptime: {
            type: DataTypes.INTEGER,
            defaultValue: 0
        },
        timestamp: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW
        }
    }, {
        sequelize,
        modelName: 'NodeStatus',
        tableName: 'node_statuses',
        underscored: true,
        timestamps: true,
        createdAt: 'createdat',
        updatedAt: 'updatedat',
        indexes: [
            {
                fields: ['status', 'timestamp']
            },
            {
                fields: ['timestamp']
            },
            {
                fields: ['nodeid']
            }
        ]
    });

    NodeStatus.associate = function(models) {
        NodeStatus.belongsTo(models.ProxyNode, {
            foreignKey: 'nodeid'
        });
    };

    return NodeStatus;
};
