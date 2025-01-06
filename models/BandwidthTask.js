const { Model, DataTypes } = require('sequelize');

class BandwidthTask extends Model {
    static associate(models) {
        BandwidthTask.belongsTo(models.User, {
            foreignKey: 'userId',
            as: 'user'
        });
    }
}

const initBandwidthTask = (sequelize) => {
    BandwidthTask.init({
        userId: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: 'Users',
                key: 'id'
            }
        },
        uploadSpeed: {
            type: DataTypes.INTEGER,
            allowNull: false,
            comment: '上传速度限制 (KB/s)'
        },
        downloadSpeed: {
            type: DataTypes.INTEGER,
            allowNull: false,
            comment: '下载速度限制 (KB/s)'
        },
        duration: {
            type: DataTypes.INTEGER,
            allowNull: false,
            comment: '计划持续时间 (秒)'
        },
        actualDuration: {
            type: DataTypes.INTEGER,
            allowNull: true,
            comment: '实际持续时间 (秒)'
        },
        status: {
            type: DataTypes.ENUM('pending', 'running', 'completed', 'failed'),
            allowNull: false,
            defaultValue: 'pending'
        },
        startedAt: {
            type: DataTypes.DATE,
            allowNull: true
        },
        completedAt: {
            type: DataTypes.DATE,
            allowNull: true
        }
    }, {
        sequelize,
        modelName: 'BandwidthTask',
        underscored: true,  
        indexes: [
            {
                fields: ['userId']
            },
            {
                fields: ['status']
            }
        ]
    });

    return BandwidthTask;
};

module.exports = initBandwidthTask;
