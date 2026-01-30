const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

/**
 * DataRoomFile - 资料库文件
 */
const DataRoomFile = sequelize.define('DataRoomFile', {
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
    folder_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
            model: 'data_room_folders',
            key: 'id'
        }
    },
    uploaded_by: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
            model: 'users',
            key: 'id'
        },
        comment: '上传者用户ID'
    },
    filename: {
        type: DataTypes.STRING,
        allowNull: false,
        comment: '文件名'
    },
    original_filename: {
        type: DataTypes.STRING,
        allowNull: false,
        comment: '原始文件名'
    },
    file_type: {
        type: DataTypes.STRING(10),
        allowNull: true,
        comment: '文件类型扩展名'
    },
    mime_type: {
        type: DataTypes.STRING,
        allowNull: true
    },
    file_size: {
        type: DataTypes.INTEGER,
        allowNull: true,
        comment: '文件大小（字节）'
    },
    // 文件内容存储方式：base64 或 external_link
    storage_type: {
        type: DataTypes.STRING(20),
        defaultValue: 'base64',
        comment: 'base64 或 external_link'
    },
    file_content: {
        type: DataTypes.TEXT('long'),
        allowNull: true,
        comment: 'Base64编码的文件内容'
    },
    external_link: {
        type: DataTypes.STRING(1024),
        allowNull: true,
        comment: '外部链接地址'
    },
    description: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: '文件描述'
    },
    // 访问层级：继承文件夹或单独设置
    access_level: {
        type: DataTypes.STRING(20),
        allowNull: true,
        comment: '访问层级: overview, nda, full_dd（null表示继承文件夹）'
    },
    // 下载统计
    download_count: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    // 版本控制
    version: {
        type: DataTypes.INTEGER,
        defaultValue: 1
    },
    is_latest: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
        comment: '是否为最新版本'
    },
    previous_version_id: {
        type: DataTypes.UUID,
        allowNull: true,
        comment: '上一版本文件ID'
    },
    created_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    },
    updated_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    }
}, {
    tableName: 'data_room_files',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
});

module.exports = DataRoomFile;
