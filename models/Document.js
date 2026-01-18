const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Document = sequelize.define('Document', {
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
    // 文档类型 - 移除 comment 避免 Sequelize ENUM bug
    type: {
        type: DataTypes.STRING(20),
        allowNull: false,
        defaultValue: 'bp'
    },
    // 文件信息
    filename: {
        type: DataTypes.STRING,
        allowNull: false
    },
    // 改为可选，用于向后兼容
    filepath: {
        type: DataTypes.STRING,
        allowNull: true
    },
    filesize: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    mimetype: {
        type: DataTypes.STRING,
        allowNull: true
    },
    // 文件内容 - Base64 编码存储在数据库中（Railway 不支持本地文件存储）
    file_content: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    // 数据室链接（可选）
    dataroom_link: {
        type: DataTypes.STRING,
        allowNull: true
    },
    // 描述
    description: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    // 访问控制
    is_public: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    requires_approval: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
    },
    // 下载统计
    download_count: {
        type: DataTypes.INTEGER,
        defaultValue: 0
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
    tableName: 'documents',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
});

module.exports = Document;
