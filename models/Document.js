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
    // 文档类型
    type: {
        type: DataTypes.ENUM('bp', 'financial', 'legal', 'other'),
        allowNull: false,
        comment: '文档类型：BP/财务/法律/其他'
    },
    // 文件信息
    filename: {
        type: DataTypes.STRING,
        allowNull: false,
        comment: '原始文件名'
    },
    filepath: {
        type: DataTypes.STRING,
        allowNull: false,
        comment: '存储路径'
    },
    filesize: {
        type: DataTypes.INTEGER,
        allowNull: true,
        comment: '文件大小（字节）'
    },
    mimetype: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: 'MIME 类型'
    },
    // 数据室链接（可选）
    dataroom_link: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: '数据室链接'
    },
    // 描述
    description: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: '文档描述'
    },
    // 访问控制
    is_public: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        comment: '是否对投资人公开'
    },
    requires_approval: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
        comment: '是否需要审批才能查看'
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
