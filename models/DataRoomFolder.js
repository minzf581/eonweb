const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

/**
 * DataRoomFolder - 资料库文件夹
 * 预设文件夹类型：财务/法律/知识产权/股权结构/团队
 */
const DataRoomFolder = sequelize.define('DataRoomFolder', {
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
    name: {
        type: DataTypes.STRING,
        allowNull: false,
        comment: '文件夹名称'
    },
    name_en: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: '文件夹英文名称'
    },
    folder_type: {
        type: DataTypes.STRING(30),
        allowNull: false,
        comment: '文件夹类型: financial, legal, ip, equity, team, other'
    },
    description: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: '文件夹描述'
    },
    // 访问层级：overview（概览）, nda（签署NDA后）, full_dd（全面尽职调查）
    access_level: {
        type: DataTypes.STRING(20),
        defaultValue: 'full_dd',
        comment: '访问层级: overview, nda, full_dd'
    },
    sort_order: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        comment: '排序顺序'
    },
    is_system: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        comment: '是否为系统预设文件夹'
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
    tableName: 'data_room_folders',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
});

// 预设文件夹类型
DataRoomFolder.FOLDER_TYPES = {
    financial: { name: '财务资料', name_en: 'Financials', order: 1 },
    legal: { name: '法律文件', name_en: 'Legal', order: 2 },
    ip: { name: '知识产权', name_en: 'Intellectual Property', order: 3 },
    equity: { name: '股权结构', name_en: 'Equity Structure', order: 4 },
    team: { name: '团队资料', name_en: 'Team', order: 5 },
    other: { name: '其他资料', name_en: 'Other', order: 6 }
};

// 访问层级
DataRoomFolder.ACCESS_LEVELS = {
    overview: { name: '概览', name_en: 'Overview', level: 1 },
    nda: { name: 'NDA签署后', name_en: 'Post-NDA', level: 2 },
    full_dd: { name: '全面尽职调查', name_en: 'Full Due Diligence', level: 3 }
};

// 为公司创建默认文件夹
DataRoomFolder.createDefaultFolders = async function(companyId) {
    const folders = [];
    for (const [type, info] of Object.entries(DataRoomFolder.FOLDER_TYPES)) {
        folders.push({
            company_id: companyId,
            name: info.name,
            name_en: info.name_en,
            folder_type: type,
            access_level: 'full_dd',
            sort_order: info.order,
            is_system: true
        });
    }
    return await DataRoomFolder.bulkCreate(folders);
};

module.exports = DataRoomFolder;
