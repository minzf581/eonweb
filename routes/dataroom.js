const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { Op } = require('sequelize');
const { 
    User, Company, DataRoomFolder, DataRoomFile, DataRoomAccess, 
    DataRoomMessage, DataRoomViewLog, InvestorProfile 
} = require('../models');
const { authenticate, requireAdmin, requireCompany, requireInvestor, requireStaffOrAdmin } = require('../middleware/auth');
const emailService = require('../services/EmailService');

// 配置文件上传
const storage = multer.memoryStorage();
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB for data room files

const upload = multer({
    storage,
    limits: { fileSize: MAX_FILE_SIZE },
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['.pdf', '.ppt', '.pptx', '.doc', '.docx', '.xls', '.xlsx', '.zip', '.rar'];
        const ext = path.extname(file.originalname).toLowerCase();
        if (allowedTypes.includes(ext)) {
            cb(null, true);
        } else {
            cb(new Error('不支持的文件类型'));
        }
    }
});

// ==================== 辅助函数 ====================

// 检查用户对公司资料库的访问权限
async function checkDataRoomAccess(userId, companyId, userRole) {
    // Admin 拥有完整权限
    if (userRole === 'admin') {
        return { hasAccess: true, accessLevel: 'full_dd' };
    }

    // 公司自己
    const company = await Company.findByPk(companyId);
    if (company && company.user_id === userId) {
        return { hasAccess: true, accessLevel: 'full_dd' };
    }

    // Staff 创建者
    if (userRole === 'staff' && company && company.created_by === userId) {
        return { hasAccess: true, accessLevel: 'full_dd' };
    }

    // 检查 DataRoomAccess 表
    const access = await DataRoomAccess.findOne({
        where: {
            company_id: companyId,
            user_id: userId,
            status: 'active',
            [Op.or]: [
                { expires_at: null },
                { expires_at: { [Op.gt]: new Date() } }
            ]
        }
    });

    if (access) {
        return { hasAccess: true, accessLevel: access.access_level, accessRecord: access };
    }

    return { hasAccess: false, accessLevel: null };
}

// 记录查看日志
async function logViewAction(companyId, userId, action, folderId = null, fileId = null, req = null) {
    try {
        await DataRoomViewLog.create({
            company_id: companyId,
            user_id: userId,
            action,
            folder_id: folderId,
            file_id: fileId,
            user_agent: req?.get('User-Agent')?.substring(0, 500),
            ip_address: req?.ip
        });
    } catch (error) {
        console.error('[DataRoom] 记录查看日志失败:', error);
    }
}

// ==================== 企业/Staff 端 API ====================

// 初始化资料库（创建默认文件夹）
router.post('/companies/:id/init', authenticate, async (req, res) => {
    try {
        const company = await Company.findByPk(req.params.id);
        if (!company) {
            return res.status(404).json({ error: '企业不存在' });
        }

        // 检查权限：公司自己、创建者、或管理员
        const isOwner = company.user_id === req.user.id;
        const isCreator = company.created_by === req.user.id;
        const isAdmin = req.user.role === 'admin';

        if (!isOwner && !isCreator && !isAdmin) {
            return res.status(403).json({ error: '无权操作' });
        }

        // 检查是否已初始化
        const existingFolders = await DataRoomFolder.count({ where: { company_id: req.params.id } });
        if (existingFolders > 0) {
            return res.status(400).json({ error: '资料库已初始化' });
        }

        // 创建默认文件夹
        const folders = await DataRoomFolder.createDefaultFolders(req.params.id);

        // 启用资料库
        await company.update({ data_room_enabled: true });

        console.log(`[DataRoom] 企业 ${company.name_cn} 资料库已初始化`);

        res.json({
            message: '资料库已初始化',
            folders
        });
    } catch (error) {
        console.error('[DataRoom] 初始化资料库错误:', error);
        res.status(500).json({ error: '初始化失败' });
    }
});

// 获取资料库文件夹列表
router.get('/companies/:id/folders', authenticate, async (req, res) => {
    try {
        const { hasAccess, accessLevel } = await checkDataRoomAccess(req.user.id, req.params.id, req.user.role);
        
        if (!hasAccess) {
            return res.status(403).json({ error: '无权访问该资料库' });
        }

        const folders = await DataRoomFolder.findAll({
            where: { company_id: req.params.id },
            include: [{
                model: DataRoomFile,
                as: 'files',
                where: { is_latest: true },
                required: false,
                attributes: ['id', 'filename', 'original_filename', 'file_type', 'file_size', 'access_level', 'created_at']
            }],
            order: [['sort_order', 'ASC'], ['created_at', 'ASC']]
        });

        // 根据访问级别过滤
        const accessLevelValue = DataRoomAccess.ACCESS_LEVELS[accessLevel]?.level || 0;
        
        const filteredFolders = folders.map(folder => {
            const folderLevelValue = DataRoomAccess.ACCESS_LEVELS[folder.access_level]?.level || 0;
            
            // 如果用户权限不足以查看该文件夹
            if (accessLevelValue < folderLevelValue) {
                return {
                    ...folder.toJSON(),
                    files: [],
                    locked: true
                };
            }

            // 过滤文件夹中的文件
            const filteredFiles = folder.files.filter(file => {
                const fileLevel = file.access_level || folder.access_level;
                const fileLevelValue = DataRoomAccess.ACCESS_LEVELS[fileLevel]?.level || 0;
                return accessLevelValue >= fileLevelValue;
            });

            return {
                ...folder.toJSON(),
                files: filteredFiles,
                locked: false
            };
        });

        // 记录查看日志
        if (req.user.role === 'investor') {
            await logViewAction(req.params.id, req.user.id, 'view_folder', null, null, req);
        }

        res.json({
            folders: filteredFolders,
            accessLevel
        });
    } catch (error) {
        console.error('[DataRoom] 获取文件夹列表错误:', error);
        res.status(500).json({ error: '获取文件夹列表失败' });
    }
});

// 创建自定义文件夹
router.post('/companies/:id/folders', authenticate, async (req, res) => {
    try {
        const { name, name_en, folder_type = 'other', access_level = 'full_dd', description } = req.body;

        const company = await Company.findByPk(req.params.id);
        if (!company) {
            return res.status(404).json({ error: '企业不存在' });
        }

        // 检查权限
        const isOwner = company.user_id === req.user.id;
        const isCreator = company.created_by === req.user.id;
        const isAdmin = req.user.role === 'admin';

        if (!isOwner && !isCreator && !isAdmin) {
            return res.status(403).json({ error: '无权操作' });
        }

        const folder = await DataRoomFolder.create({
            company_id: req.params.id,
            name,
            name_en,
            folder_type,
            access_level,
            description,
            is_system: false
        });

        res.status(201).json({
            message: '文件夹已创建',
            folder
        });
    } catch (error) {
        console.error('[DataRoom] 创建文件夹错误:', error);
        res.status(500).json({ error: '创建文件夹失败' });
    }
});

// 更新文件夹
router.put('/folders/:id', authenticate, async (req, res) => {
    try {
        const folder = await DataRoomFolder.findByPk(req.params.id, {
            include: [{ model: Company, as: 'company' }]
        });

        if (!folder) {
            return res.status(404).json({ error: '文件夹不存在' });
        }

        // 检查权限
        const company = folder.company;
        const isOwner = company.user_id === req.user.id;
        const isCreator = company.created_by === req.user.id;
        const isAdmin = req.user.role === 'admin';

        if (!isOwner && !isCreator && !isAdmin) {
            return res.status(403).json({ error: '无权操作' });
        }

        const { name, name_en, access_level, description } = req.body;
        await folder.update({
            ...(name && { name }),
            ...(name_en && { name_en }),
            ...(access_level && { access_level }),
            ...(description !== undefined && { description })
        });

        res.json({ message: '文件夹已更新', folder });
    } catch (error) {
        console.error('[DataRoom] 更新文件夹错误:', error);
        res.status(500).json({ error: '更新文件夹失败' });
    }
});

// 上传文件到资料库
router.post('/folders/:folderId/files', authenticate, upload.single('file'), async (req, res) => {
    try {
        const folder = await DataRoomFolder.findByPk(req.params.folderId, {
            include: [{ model: Company, as: 'company' }]
        });

        if (!folder) {
            return res.status(404).json({ error: '文件夹不存在' });
        }

        const company = folder.company;
        const isOwner = company.user_id === req.user.id;
        const isCreator = company.created_by === req.user.id;
        const isAdmin = req.user.role === 'admin';

        if (!isOwner && !isCreator && !isAdmin) {
            return res.status(403).json({ error: '无权上传文件' });
        }

        if (!req.file) {
            return res.status(400).json({ error: '请选择文件' });
        }

        const { description, access_level } = req.body;
        const ext = path.extname(req.file.originalname).toLowerCase();
        const fileContent = req.file.buffer.toString('base64');

        const file = await DataRoomFile.create({
            company_id: company.id,
            folder_id: folder.id,
            uploaded_by: req.user.id,
            filename: `${Date.now()}_${req.file.originalname}`,
            original_filename: req.file.originalname,
            file_type: ext.replace('.', ''),
            mime_type: req.file.mimetype,
            file_size: req.file.size,
            storage_type: 'base64',
            file_content: fileContent,
            description,
            access_level: access_level || null
        });

        console.log(`[DataRoom] 用户 ${req.user.email} 上传文件到 ${folder.name}: ${req.file.originalname}`);

        res.status(201).json({
            message: '文件已上传',
            file: {
                id: file.id,
                filename: file.filename,
                original_filename: file.original_filename,
                file_type: file.file_type,
                file_size: file.file_size,
                created_at: file.created_at
            }
        });
    } catch (error) {
        console.error('[DataRoom] 上传文件错误:', error);
        res.status(500).json({ error: '上传文件失败' });
    }
});

// 添加外部链接文件
router.post('/folders/:folderId/links', authenticate, async (req, res) => {
    try {
        const { filename, url, description, access_level } = req.body;

        if (!filename || !url) {
            return res.status(400).json({ error: '请填写文件名和链接地址' });
        }

        const folder = await DataRoomFolder.findByPk(req.params.folderId, {
            include: [{ model: Company, as: 'company' }]
        });

        if (!folder) {
            return res.status(404).json({ error: '文件夹不存在' });
        }

        const company = folder.company;
        const isOwner = company.user_id === req.user.id;
        const isCreator = company.created_by === req.user.id;
        const isAdmin = req.user.role === 'admin';

        if (!isOwner && !isCreator && !isAdmin) {
            return res.status(403).json({ error: '无权添加文件' });
        }

        const file = await DataRoomFile.create({
            company_id: company.id,
            folder_id: folder.id,
            uploaded_by: req.user.id,
            filename: filename,
            original_filename: filename,
            storage_type: 'external_link',
            external_link: url,
            description,
            access_level: access_level || null
        });

        res.status(201).json({
            message: '链接已添加',
            file
        });
    } catch (error) {
        console.error('[DataRoom] 添加链接错误:', error);
        res.status(500).json({ error: '添加链接失败' });
    }
});

// 预览/下载文件
router.get('/files/:id/download', authenticate, async (req, res) => {
    try {
        const file = await DataRoomFile.findByPk(req.params.id, {
            include: [
                { model: DataRoomFolder, as: 'folder' },
                { model: Company, as: 'company' }
            ]
        });

        if (!file) {
            return res.status(404).json({ error: '文件不存在' });
        }

        // 检查访问权限
        const { hasAccess, accessLevel } = await checkDataRoomAccess(req.user.id, file.company_id, req.user.role);
        if (!hasAccess) {
            return res.status(403).json({ error: '无权访问该文件' });
        }

        // 检查文件访问级别
        const fileAccessLevel = file.access_level || file.folder.access_level;
        if (!DataRoomAccess.checkAccess(accessLevel, fileAccessLevel)) {
            return res.status(403).json({ error: '您的访问权限不足' });
        }

        // 记录下载日志
        if (req.user.role === 'investor') {
            await logViewAction(file.company_id, req.user.id, 'download_file', file.folder_id, file.id, req);
        }

        // 增加下载计数
        await file.increment('download_count');

        // 外部链接
        if (file.storage_type === 'external_link') {
            return res.json({
                redirect: true,
                url: file.external_link,
                filename: file.original_filename
            });
        }

        // Base64 文件
        const buffer = Buffer.from(file.file_content, 'base64');
        res.setHeader('Content-Type', file.mime_type || 'application/octet-stream');
        res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(file.original_filename)}`);
        res.send(buffer);
    } catch (error) {
        console.error('[DataRoom] 下载文件错误:', error);
        res.status(500).json({ error: '下载文件失败' });
    }
});

// 删除文件
router.delete('/files/:id', authenticate, async (req, res) => {
    try {
        const file = await DataRoomFile.findByPk(req.params.id, {
            include: [{ model: Company, as: 'company' }]
        });

        if (!file) {
            return res.status(404).json({ error: '文件不存在' });
        }

        const company = file.company;
        const isOwner = company.user_id === req.user.id;
        const isCreator = company.created_by === req.user.id;
        const isAdmin = req.user.role === 'admin';
        const isUploader = file.uploaded_by === req.user.id;

        if (!isOwner && !isCreator && !isAdmin && !isUploader) {
            return res.status(403).json({ error: '无权删除该文件' });
        }

        await file.destroy();

        res.json({ message: '文件已删除' });
    } catch (error) {
        console.error('[DataRoom] 删除文件错误:', error);
        res.status(500).json({ error: '删除文件失败' });
    }
});

// ==================== 权限管理 API ====================

// 获取企业资料库访问列表
router.get('/companies/:id/access', authenticate, async (req, res) => {
    try {
        const company = await Company.findByPk(req.params.id);
        if (!company) {
            return res.status(404).json({ error: '企业不存在' });
        }

        // 只有公司自己、创建者、管理员可以查看
        const isOwner = company.user_id === req.user.id;
        const isCreator = company.created_by === req.user.id;
        const isAdmin = req.user.role === 'admin';

        if (!isOwner && !isCreator && !isAdmin) {
            return res.status(403).json({ error: '无权查看' });
        }

        const accessList = await DataRoomAccess.findAll({
            where: { company_id: req.params.id },
            include: [
                { model: User, as: 'user', attributes: ['id', 'email', 'name', 'role'] },
                { model: User, as: 'grantedByUser', attributes: ['id', 'email', 'name'] }
            ],
            order: [['created_at', 'DESC']]
        });

        res.json({ accessList });
    } catch (error) {
        console.error('[DataRoom] 获取访问列表错误:', error);
        res.status(500).json({ error: '获取访问列表失败' });
    }
});

// 授予/更新资料库访问权限
router.post('/companies/:id/access', authenticate, async (req, res) => {
    try {
        const { user_id, access_level, expires_at, notes } = req.body;

        const company = await Company.findByPk(req.params.id);
        if (!company) {
            return res.status(404).json({ error: '企业不存在' });
        }

        // 只有管理员可以授权
        if (req.user.role !== 'admin') {
            return res.status(403).json({ error: '无权授权' });
        }

        // 查找或创建访问记录
        let [access, created] = await DataRoomAccess.findOrCreate({
            where: {
                company_id: req.params.id,
                user_id
            },
            defaults: {
                granted_by: req.user.id,
                access_level: access_level || 'overview',
                expires_at,
                notes,
                status: 'active'
            }
        });

        if (!created) {
            await access.update({
                access_level: access_level || access.access_level,
                expires_at: expires_at !== undefined ? expires_at : access.expires_at,
                notes: notes !== undefined ? notes : access.notes,
                status: 'active'
            });
        }

        // 获取用户信息用于日志
        const user = await User.findByPk(user_id, { attributes: ['email', 'name'] });
        console.log(`[DataRoom] 管理员 ${req.user.email} 授权 ${user?.email} 访问 ${company.name_cn} 资料库，级别: ${access.access_level}`);

        res.json({
            message: created ? '访问权限已授予' : '访问权限已更新',
            access
        });
    } catch (error) {
        console.error('[DataRoom] 授权错误:', error);
        res.status(500).json({ error: '授权失败' });
    }
});

// 撤销访问权限
router.delete('/companies/:id/access/:userId', authenticate, requireAdmin, async (req, res) => {
    try {
        const access = await DataRoomAccess.findOne({
            where: {
                company_id: req.params.id,
                user_id: req.params.userId
            }
        });

        if (!access) {
            return res.status(404).json({ error: '访问权限不存在' });
        }

        await access.update({ status: 'revoked' });

        res.json({ message: '访问权限已撤销' });
    } catch (error) {
        console.error('[DataRoom] 撤销权限错误:', error);
        res.status(500).json({ error: '撤销失败' });
    }
});

// 更新 NDA 签署状态
router.put('/companies/:id/access/:userId/nda', authenticate, requireAdmin, async (req, res) => {
    try {
        const { nda_signed, nda_document_id } = req.body;

        const access = await DataRoomAccess.findOne({
            where: {
                company_id: req.params.id,
                user_id: req.params.userId
            }
        });

        if (!access) {
            return res.status(404).json({ error: '访问权限不存在' });
        }

        await access.update({
            nda_signed: nda_signed === true,
            nda_signed_at: nda_signed ? new Date() : null,
            nda_document_id,
            // NDA 签署后自动升级到 nda 级别
            access_level: nda_signed && access.access_level === 'overview' ? 'nda' : access.access_level
        });

        res.json({ message: 'NDA 状态已更新', access });
    } catch (error) {
        console.error('[DataRoom] 更新 NDA 状态错误:', error);
        res.status(500).json({ error: '更新失败' });
    }
});

// ==================== 查看追踪 API ====================

// 获取查看统计
router.get('/companies/:id/analytics', authenticate, async (req, res) => {
    try {
        const company = await Company.findByPk(req.params.id);
        if (!company) {
            return res.status(404).json({ error: '企业不存在' });
        }

        // 只有公司自己、创建者、管理员可以查看
        const isOwner = company.user_id === req.user.id;
        const isCreator = company.created_by === req.user.id;
        const isAdmin = req.user.role === 'admin';

        if (!isOwner && !isCreator && !isAdmin) {
            return res.status(403).json({ error: '无权查看' });
        }

        // 获取投资人查看统计
        const viewLogs = await DataRoomViewLog.findAll({
            where: { company_id: req.params.id },
            include: [
                { model: User, as: 'user', attributes: ['id', 'email', 'name', 'role'] },
                { model: DataRoomFolder, as: 'folder', attributes: ['id', 'name'] },
                { model: DataRoomFile, as: 'file', attributes: ['id', 'original_filename'] }
            ],
            order: [['created_at', 'DESC']],
            limit: 500
        });

        // 按用户聚合统计
        const userStats = {};
        viewLogs.forEach(log => {
            if (!userStats[log.user_id]) {
                userStats[log.user_id] = {
                    user: log.user,
                    totalViews: 0,
                    downloads: 0,
                    foldersViewed: new Set(),
                    filesViewed: new Set(),
                    lastViewAt: log.created_at
                };
            }
            userStats[log.user_id].totalViews++;
            if (log.action === 'download_file') userStats[log.user_id].downloads++;
            if (log.folder_id) userStats[log.user_id].foldersViewed.add(log.folder_id);
            if (log.file_id) userStats[log.user_id].filesViewed.add(log.file_id);
        });

        // 转换为数组
        const investorEngagement = Object.values(userStats).map(stat => ({
            user: stat.user,
            totalViews: stat.totalViews,
            downloads: stat.downloads,
            foldersViewed: stat.foldersViewed.size,
            filesViewed: stat.filesViewed.size,
            lastViewAt: stat.lastViewAt
        })).sort((a, b) => b.totalViews - a.totalViews);

        res.json({
            totalViews: viewLogs.length,
            uniqueVisitors: Object.keys(userStats).length,
            investorEngagement,
            recentLogs: viewLogs.slice(0, 50)
        });
    } catch (error) {
        console.error('[DataRoom] 获取统计错误:', error);
        res.status(500).json({ error: '获取统计失败' });
    }
});

// ==================== 私密对话 API ====================

// 获取与特定投资人的对话
router.get('/companies/:companyId/conversations/:investorId', authenticate, async (req, res) => {
    try {
        const { companyId, investorId } = req.params;

        // 检查权限
        const company = await Company.findByPk(companyId);
        if (!company) {
            return res.status(404).json({ error: '企业不存在' });
        }

        const isOwner = company.user_id === req.user.id;
        const isCreator = company.created_by === req.user.id;
        const isAdmin = req.user.role === 'admin';
        const isTheInvestor = req.user.id === investorId && req.user.role === 'investor';

        if (!isOwner && !isCreator && !isAdmin && !isTheInvestor) {
            return res.status(403).json({ error: '无权查看该对话' });
        }

        const messages = await DataRoomMessage.findAll({
            where: {
                company_id: companyId,
                investor_id: investorId
            },
            include: [
                { model: User, as: 'messageSender', attributes: ['id', 'email', 'name', 'role'] },
                { model: DataRoomFile, as: 'file', attributes: ['id', 'original_filename'] }
            ],
            order: [['created_at', 'ASC']]
        });

        // 标记已读
        if (isTheInvestor) {
            await DataRoomMessage.update(
                { is_read_by_investor: true },
                { where: { company_id: companyId, investor_id: investorId, is_read_by_investor: false } }
            );
        } else {
            await DataRoomMessage.update(
                { is_read_by_company: true },
                { where: { company_id: companyId, investor_id: investorId, is_read_by_company: false } }
            );
        }

        res.json({ messages });
    } catch (error) {
        console.error('[DataRoom] 获取对话错误:', error);
        res.status(500).json({ error: '获取对话失败' });
    }
});

// 发送消息
router.post('/companies/:companyId/conversations/:investorId', authenticate, async (req, res) => {
    try {
        const { companyId, investorId } = req.params;
        const { content, file_id } = req.body;

        if (!content?.trim()) {
            return res.status(400).json({ error: '请输入消息内容' });
        }

        const company = await Company.findByPk(companyId, {
            include: [{ model: User, as: 'user', attributes: ['id', 'email', 'name'] }]
        });
        if (!company) {
            return res.status(404).json({ error: '企业不存在' });
        }

        // 检查权限
        const isOwner = company.user_id === req.user.id;
        const isCreator = company.created_by === req.user.id;
        const isAdmin = req.user.role === 'admin';
        const isTheInvestor = req.user.id === investorId && req.user.role === 'investor';

        if (!isOwner && !isCreator && !isAdmin && !isTheInvestor) {
            return res.status(403).json({ error: '无权发送消息' });
        }

        // 投资人发消息需要有访问权限
        if (isTheInvestor) {
            const { hasAccess } = await checkDataRoomAccess(req.user.id, companyId, 'investor');
            if (!hasAccess) {
                return res.status(403).json({ error: '您没有该资料库的访问权限' });
            }
        }

        const message = await DataRoomMessage.create({
            company_id: companyId,
            investor_id: investorId,
            sender_id: req.user.id,
            sender_role: req.user.role,
            content: content.trim(),
            file_id,
            is_read_by_investor: isTheInvestor,
            is_read_by_company: !isTheInvestor
        });

        // 获取完整消息
        const fullMessage = await DataRoomMessage.findByPk(message.id, {
            include: [
                { model: User, as: 'messageSender', attributes: ['id', 'email', 'name', 'role'] }
            ]
        });

        // 发送邮件通知
        try {
            if (emailService.isConfigured()) {
                let recipientEmail;
                if (isTheInvestor) {
                    // 通知公司/管理员
                    recipientEmail = company.user?.email;
                } else {
                    // 通知投资人
                    const investor = await User.findByPk(investorId, { attributes: ['email'] });
                    recipientEmail = investor?.email;
                }

                if (recipientEmail) {
                    const companyName = company.name_cn || company.name_en;
                    await emailService.sendFeedbackNotification({
                        to: recipientEmail,
                        companyName,
                        senderName: req.user.name || req.user.email,
                        senderRole: req.user.role,
                        content: content.trim()
                    });
                }
            }
        } catch (emailError) {
            console.error('[DataRoom] 发送通知邮件失败:', emailError);
        }

        res.status(201).json({
            message: '消息已发送',
            data: fullMessage
        });
    } catch (error) {
        console.error('[DataRoom] 发送消息错误:', error);
        res.status(500).json({ error: '发送消息失败' });
    }
});

// 获取所有对话列表（公司/管理员视角）
router.get('/companies/:id/conversations', authenticate, async (req, res) => {
    try {
        const company = await Company.findByPk(req.params.id);
        if (!company) {
            return res.status(404).json({ error: '企业不存在' });
        }

        const isOwner = company.user_id === req.user.id;
        const isCreator = company.created_by === req.user.id;
        const isAdmin = req.user.role === 'admin';

        if (!isOwner && !isCreator && !isAdmin) {
            return res.status(403).json({ error: '无权查看' });
        }

        // 获取所有有对话的投资人
        const conversations = await DataRoomMessage.findAll({
            where: { company_id: req.params.id },
            attributes: ['investor_id', [sequelize.fn('COUNT', sequelize.col('id')), 'message_count'],
                [sequelize.fn('MAX', sequelize.col('created_at')), 'last_message_at']],
            group: ['investor_id'],
            raw: true
        });

        // 获取投资人信息
        const investorIds = conversations.map(c => c.investor_id);
        const investors = await User.findAll({
            where: { id: investorIds },
            attributes: ['id', 'email', 'name'],
            include: [{
                model: InvestorProfile,
                as: 'investorProfile',
                attributes: ['organization', 'title']
            }]
        });

        const investorMap = {};
        investors.forEach(inv => { investorMap[inv.id] = inv; });

        // 获取未读消息数
        const unreadCounts = await DataRoomMessage.findAll({
            where: {
                company_id: req.params.id,
                is_read_by_company: false
            },
            attributes: ['investor_id', [sequelize.fn('COUNT', sequelize.col('id')), 'unread_count']],
            group: ['investor_id'],
            raw: true
        });

        const unreadMap = {};
        unreadCounts.forEach(u => { unreadMap[u.investor_id] = parseInt(u.unread_count); });

        const result = conversations.map(c => ({
            investor: investorMap[c.investor_id],
            messageCount: parseInt(c.message_count),
            lastMessageAt: c.last_message_at,
            unreadCount: unreadMap[c.investor_id] || 0
        })).sort((a, b) => new Date(b.lastMessageAt) - new Date(a.lastMessageAt));

        res.json({ conversations: result });
    } catch (error) {
        console.error('[DataRoom] 获取对话列表错误:', error);
        res.status(500).json({ error: '获取对话列表失败' });
    }
});

// 需要引入 sequelize 用于聚合查询
const { sequelize } = require('../config/database');

module.exports = router;
