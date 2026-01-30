const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

/**
 * DataRoomMessage - 资料库私密对话
 * 投资人与公司/Staff的私密交流，投资人之间互相不可见
 */
const DataRoomMessage = sequelize.define('DataRoomMessage', {
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
    // 对话参与者：投资人
    investor_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
            model: 'users',
            key: 'id'
        },
        comment: '投资人用户ID'
    },
    // 消息发送者
    sender_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
            model: 'users',
            key: 'id'
        }
    },
    sender_role: {
        type: DataTypes.STRING(20),
        allowNull: false,
        comment: 'investor, company, staff, admin'
    },
    content: {
        type: DataTypes.TEXT,
        allowNull: false
    },
    // 附件（可选）
    attachment_name: {
        type: DataTypes.STRING,
        allowNull: true
    },
    attachment_content: {
        type: DataTypes.TEXT('long'),
        allowNull: true,
        comment: 'Base64编码的附件'
    },
    attachment_type: {
        type: DataTypes.STRING(10),
        allowNull: true
    },
    // 阅读状态
    is_read_by_investor: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    is_read_by_company: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    read_at: {
        type: DataTypes.DATE,
        allowNull: true
    },
    // 关联文件（如果消息针对特定文件）
    file_id: {
        type: DataTypes.UUID,
        allowNull: true,
        references: {
            model: 'data_room_files',
            key: 'id'
        }
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
    tableName: 'data_room_messages',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
        {
            fields: ['company_id', 'investor_id']
        }
    ]
});

module.exports = DataRoomMessage;
