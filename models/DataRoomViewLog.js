const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

/**
 * DataRoomViewLog - 资料库查看记录
 * 追踪投资人的查看行为，了解哪些投资者深度参与
 */
const DataRoomViewLog = sequelize.define('DataRoomViewLog', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    company_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
            model: 'companies',
            key: 'id'
        }
    },
    user_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
            model: 'users',
            key: 'id'
        }
    },
    // 动作类型
    action: {
        type: DataTypes.STRING(30),
        allowNull: false,
        comment: 'view_folder, view_file, download_file, preview_file'
    },
    // 目标对象
    folder_id: {
        type: DataTypes.UUID,
        allowNull: true,
        references: {
            model: 'data_room_folders',
            key: 'id'
        }
    },
    file_id: {
        type: DataTypes.UUID,
        allowNull: true,
        references: {
            model: 'data_room_files',
            key: 'id'
        }
    },
    // 时长（秒）- 预览文件时记录
    duration: {
        type: DataTypes.INTEGER,
        allowNull: true,
        comment: '查看时长（秒）'
    },
    // 设备信息
    user_agent: {
        type: DataTypes.STRING(500),
        allowNull: true
    },
    ip_address: {
        type: DataTypes.STRING(50),
        allowNull: true
    },
    created_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    }
}, {
    tableName: 'data_room_view_logs',
    timestamps: false,
    indexes: [
        {
            fields: ['company_id', 'user_id']
        },
        {
            fields: ['company_id', 'created_at']
        }
    ]
});

module.exports = DataRoomViewLog;
