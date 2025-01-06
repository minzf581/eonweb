const { Model, DataTypes } = require('sequelize');

class BandwidthTask extends Model {
    static associate(models) {
        BandwidthTask.belongsTo(models.User, {
            foreignKey: 'userid',
            as: 'user'
        });
    }
}

const initBandwidthTask = (sequelize) => {
    BandwidthTask.init({
        userid: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: 'users',
                key: 'id'
            },
            field: 'userid'
        },
        uploadSpeed: {
            type: DataTypes.INTEGER,
            allowNull: false,
            field: 'upload_speed',
            comment: '上传速度限制 (KB/s)'
        },
        downloadSpeed: {
            type: DataTypes.INTEGER,
            allowNull: false,
            field: 'download_speed',
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
            field: 'actual_duration',
            comment: '实际持续时间 (秒)'
        },
        status: {
            type: DataTypes.ENUM('pending', 'running', 'completed', 'failed'),
            allowNull: false,
            defaultValue: 'pending'
        },
        startedAt: {
            type: DataTypes.DATE,
            allowNull: true,
            field: 'started_at'
        },
        completedAt: {
            type: DataTypes.DATE,
            allowNull: true,
            field: 'completed_at'
        },
        deletedAt: {
            type: DataTypes.DATE,
            allowNull: true,
            field: 'deleted_at'
        },
        createdAt: {
            type: DataTypes.DATE,
            field: 'created_at'
        },
        updatedAt: {
            type: DataTypes.DATE,
            field: 'updated_at'
        }
    }, {
        sequelize,
        modelName: 'BandwidthTask',
        tableName: 'bandwidth_tasks',
        underscored: false,
        timestamps: true,
        paranoid: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at',
        deletedAt: 'deleted_at'
    });

    return BandwidthTask;
};

module.exports = initBandwidthTask;
