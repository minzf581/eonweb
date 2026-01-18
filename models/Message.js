const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Message = sequelize.define('Message', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    // 发送者（管理员）
    sender_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
            model: 'users',
            key: 'id'
        }
    },
    // 接收者
    recipient_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
            model: 'users',
            key: 'id'
        }
    },
    // 关联的企业（可选）
    company_id: {
        type: DataTypes.UUID,
        allowNull: true,
        references: {
            model: 'companies',
            key: 'id'
        }
    },
    // 消息类型
    type: {
        type: DataTypes.STRING(30),
        allowNull: false,
        defaultValue: 'general'
        // general, status_change, review_feedback, notification
    },
    // 主题
    subject: {
        type: DataTypes.STRING(500),
        allowNull: false
    },
    // 内容
    content: {
        type: DataTypes.TEXT,
        allowNull: false
    },
    // 附件 (JSON 数组，存储文件信息)
    attachments: {
        type: DataTypes.JSONB,
        defaultValue: [],
        // [{filename, mimetype, size, content (base64)}]
    },
    // 是否已发送邮件
    email_sent: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    // 邮件发送时间
    email_sent_at: {
        type: DataTypes.DATE,
        allowNull: true
    },
    // 状态变更（如果消息触发了状态变更）
    status_change: {
        type: DataTypes.JSONB,
        allowNull: true,
        // { from: 'pending', to: 'approved', entity_type: 'company' }
    },
    // 阅读状态
    is_read: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    read_at: {
        type: DataTypes.DATE,
        allowNull: true
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
    tableName: 'messages',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
});

module.exports = Message;
