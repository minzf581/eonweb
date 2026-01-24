const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { User, Company, FundraisingInfo, Document, AccessRequest, Message, CompanyComment } = require('../models');
const { authenticate, requireCompany } = require('../middleware/auth');
const emailService = require('../services/EmailService');

// 配置文件上传 - 使用内存存储（Railway不支持本地文件系统写入）
// 注意：Railway 平台上传大文件容易超时，建议文件大小不超过 2MB
const storage = multer.memoryStorage();
const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB - Railway 平台的实际可用上限

const upload = multer({
    storage,
    limits: { fileSize: MAX_FILE_SIZE },
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['.pdf', '.ppt', '.pptx', '.doc', '.docx'];
        const ext = path.extname(file.originalname).toLowerCase();
        if (allowedTypes.includes(ext)) {
            cb(null, true);
        } else {
            cb(new Error('不支持的文件格式，仅支持 PDF、PPT、PPTX、DOC、DOCX'));
        }
    }
});

// 获取当前用户的企业信息
router.get('/profile', authenticate, requireCompany, async (req, res) => {
    try {
        const company = await Company.findOne({
            where: { user_id: req.user.id },
            include: [
                { model: FundraisingInfo, as: 'fundraisingInfo' },
                { model: Document, as: 'documents' }
            ]
        });

        if (!company) {
            return res.json({ company: null, message: '尚未创建企业资料' });
        }

        res.json({ company });
    } catch (error) {
        console.error('[Company] 获取企业信息错误:', error);
        res.status(500).json({ error: '获取企业信息失败' });
    }
});

// 创建或更新企业基本信息
router.post('/profile', authenticate, requireCompany, async (req, res) => {
    try {
        const {
            name_cn, name_en, website, linkedin,
            industry_primary, industry_secondary,
            location_headquarters, location_rd,
            description, description_detail,
            stage,
            contact_name, contact_title, contact_email,
            contact_phone, contact_wechat, contact_whatsapp
        } = req.body;

        // 验证必填字段
        if (!name_cn || !industry_primary || !location_headquarters || !description || !stage || !contact_name || !contact_email) {
            return res.status(400).json({ error: '请填写所有必填字段' });
        }

        let company = await Company.findOne({ where: { user_id: req.user.id } });

        const companyData = {
            user_id: req.user.id,
            name_cn, name_en, website, linkedin,
            industry_primary, industry_secondary,
            location_headquarters, location_rd,
            description, description_detail,
            stage,
            contact_name, contact_title, contact_email,
            contact_phone, contact_wechat, contact_whatsapp,
            status: 'draft'
        };

        if (company) {
            // 更新
            await company.update(companyData);
        } else {
            // 创建
            company = await Company.create(companyData);
        }

        res.json({ 
            message: company ? '企业信息已更新' : '企业信息已创建',
            company 
        });
    } catch (error) {
        console.error('[Company] 保存企业信息错误:', error);
        res.status(500).json({ error: '保存企业信息失败' });
    }
});

// 保存融资信息
router.post('/fundraising', authenticate, requireCompany, async (req, res) => {
    try {
        const company = await Company.findOne({ where: { user_id: req.user.id } });
        if (!company) {
            return res.status(400).json({ error: '请先创建企业基本信息' });
        }

        const {
            purpose, financing_type,
            amount_min, amount_max, amount_currency,
            timeline, valuation_expectation, use_of_funds,
            overseas_structure,
            ip_ownership, ip_transferable, ip_notes,
            data_sensitivity, data_sensitivity_notes,
            additional_info
        } = req.body;

        // 验证必填字段
        if (!purpose || !financing_type || !amount_min || !amount_max || !timeline) {
            return res.status(400).json({ error: '请填写所有必填字段' });
        }

        let fundraisingInfo = await FundraisingInfo.findOne({ where: { company_id: company.id } });

        const fundraisingData = {
            company_id: company.id,
            purpose: Array.isArray(purpose) ? purpose : [purpose],
            financing_type: Array.isArray(financing_type) ? financing_type : [financing_type],
            amount_min, amount_max, 
            amount_currency: amount_currency || 'USD',
            timeline, valuation_expectation, use_of_funds,
            overseas_structure: overseas_structure || {},
            ip_ownership, ip_transferable, ip_notes,
            data_sensitivity: data_sensitivity || 'medium',
            data_sensitivity_notes,
            additional_info
        };

        if (fundraisingInfo) {
            await fundraisingInfo.update(fundraisingData);
        } else {
            fundraisingInfo = await FundraisingInfo.create(fundraisingData);
        }

        res.json({ 
            message: '融资信息已保存',
            fundraisingInfo 
        });
    } catch (error) {
        console.error('[Company] 保存融资信息错误:', error);
        res.status(500).json({ error: '保存融资信息失败' });
    }
});

// 上传 BP 文件 - 使用内存存储并保存到数据库
router.post('/upload-bp', (req, res, next) => {
    console.log('[Company][Upload] ===== 收到上传请求 =====');
    next();
}, authenticate, (req, res, next) => {
    console.log('[Company][Upload] 认证通过，用户:', req.user?.email);
    next();
}, requireCompany, (req, res, next) => {
    console.log('[Company][Upload] 角色验证通过');
    // 执行 multer 上传
    upload.single('file')(req, res, (err) => {
        if (err) {
            console.error('[Company][Upload] Multer 错误:', err.message, err.code);
            if (err.code === 'LIMIT_FILE_SIZE') {
                return res.status(400).json({ 
                    error: '文件大小不能超过 2MB。由于平台限制，请压缩文件后重试，或联系管理员提供其他上传方式。' 
                });
            }
            return res.status(400).json({ error: err.message || '上传失败' });
        }
        console.log('[Company][Upload] Multer 处理完成');
        next();
    });
}, async (req, res) => {
    const startTime = Date.now();
    console.log(`[Company][Upload] 开始处理文件保存`);
    
    try {
        const company = await Company.findOne({ where: { user_id: req.user.id } });
        if (!company) {
            console.log('[Company][Upload] 错误：企业信息不存在');
            return res.status(400).json({ error: '请先创建企业基本信息' });
        }
        console.log('[Company][Upload] 找到企业:', company.id);

        if (!req.file) {
            console.log('[Company][Upload] 错误：未收到文件');
            return res.status(400).json({ error: '请选择要上传的文件' });
        }

        console.log(`[Company][Upload] 收到文件: ${req.file.originalname}`);
        console.log(`[Company][Upload] 文件大小: ${req.file.size} bytes`);
        console.log(`[Company][Upload] MIME类型: ${req.file.mimetype}`);

        // 将文件内容转换为 Base64 存储
        console.log('[Company][Upload] 开始 Base64 编码...');
        const fileContent = req.file.buffer.toString('base64');
        console.log(`[Company][Upload] Base64 编码完成，长度: ${fileContent.length} 字符`);

        // 处理文件名编码 - 确保中文文件名正确存储
        let filename = req.file.originalname;
        try {
            const buffer = Buffer.from(filename, 'latin1');
            const decoded = buffer.toString('utf8');
            if (!decoded.includes('\ufffd') && decoded !== filename) {
                filename = decoded;
            }
        } catch (e) {
            // 保持原始文件名
        }
        console.log(`[Company][Upload] 处理后文件名: ${filename}`);

        console.log('[Company][Upload] 开始写入数据库...');
        const document = await Document.create({
            company_id: company.id,
            type: 'bp',
            filename: filename,
            filepath: null,
            filesize: req.file.size,
            mimetype: req.file.mimetype,
            file_content: fileContent,
            description: req.body.description || 'Business Plan',
            requires_approval: true
        });

        const duration = Date.now() - startTime;
        console.log(`[Company][Upload] ===== 上传成功 =====`);
        console.log(`[Company][Upload] 文档ID: ${document.id}`);
        console.log(`[Company][Upload] 总耗时: ${duration}ms`);

        res.json({ 
            message: 'BP 文件上传成功',
            document: {
                id: document.id,
                filename: document.filename,
                type: document.type,
                filesize: document.filesize,
                created_at: document.created_at
            }
        });
    } catch (error) {
        const duration = Date.now() - startTime;
        console.error(`[Company][Upload] ===== 上传失败 =====`);
        console.error(`[Company][Upload] 耗时: ${duration}ms`);
        console.error(`[Company][Upload] 错误类型: ${error.name}`);
        console.error(`[Company][Upload] 错误信息: ${error.message}`);
        console.error(`[Company][Upload] 错误堆栈:`, error.stack);
        
        // 检查是否是数据库相关错误
        if (error.name === 'SequelizeDatabaseError') {
            console.error(`[Company][Upload] 数据库错误SQL:`, error.sql);
        }
        
        if (!res.headersSent) {
            res.status(500).json({ error: '上传失败: ' + error.message });
        }
    }
});

// 全局错误处理 - 捕获未处理的路由错误
router.use((err, req, res, next) => {
    console.error('[Company] 路由错误:', err);
    if (!res.headersSent) {
        res.status(500).json({ error: '服务器错误: ' + err.message });
    }
});

// 诊断端点 - 检查上传功能状态
router.get('/upload-diagnostics', authenticate, async (req, res) => {
    console.log('[Company][Diag] 开始诊断...');
    const diagnostics = {
        timestamp: new Date().toISOString(),
        user: req.user?.email,
        checks: []
    };

    try {
        // 检查1: 用户是否有企业
        const company = await Company.findOne({ where: { user_id: req.user.id } });
        diagnostics.checks.push({
            name: '企业信息',
            status: company ? 'OK' : 'MISSING',
            detail: company ? `ID: ${company.id}` : '请先创建企业信息'
        });

        if (company) {
            // 检查2: 现有文档数量
            const docCount = await Document.count({ where: { company_id: company.id } });
            diagnostics.checks.push({
                name: '现有文档数',
                status: 'OK',
                detail: `${docCount} 个文档`
            });

            // 检查3: 测试创建一个小文档
            const testDoc = await Document.create({
                company_id: company.id,
                type: 'test',
                filename: 'diagnostic_test.txt',
                filesize: 100,
                mimetype: 'text/plain',
                file_content: Buffer.from('Test content').toString('base64'),
                description: 'Diagnostic test - will be deleted'
            });
            
            // 验证是否能读取
            const readBack = await Document.findByPk(testDoc.id);
            const hasContent = readBack && readBack.file_content && readBack.file_content.length > 0;
            
            diagnostics.checks.push({
                name: '数据库写入测试',
                status: hasContent ? 'OK' : 'FAILED',
                detail: hasContent ? `写入成功，内容长度: ${readBack.file_content.length}` : '写入后无法读取'
            });

            // 删除测试文档
            await testDoc.destroy();
            diagnostics.checks.push({
                name: '数据库删除测试',
                status: 'OK',
                detail: '测试文档已删除'
            });
        }

        diagnostics.overall = diagnostics.checks.every(c => c.status === 'OK') ? 'PASS' : 'FAIL';
        console.log('[Company][Diag] 诊断完成:', diagnostics.overall);

    } catch (error) {
        console.error('[Company][Diag] 诊断错误:', error);
        diagnostics.checks.push({
            name: '诊断过程',
            status: 'ERROR',
            detail: error.message
        });
        diagnostics.overall = 'ERROR';
    }

    res.json(diagnostics);
});

// 获取企业的所有文档
router.get('/documents', authenticate, requireCompany, async (req, res) => {
    try {
        const company = await Company.findOne({ where: { user_id: req.user.id } });
        if (!company) {
            return res.json({ documents: [] });
        }

        const documents = await Document.findAll({
            where: { company_id: company.id },
            order: [['created_at', 'DESC']]
        });

        res.json({ documents });
    } catch (error) {
        console.error('[Company] 获取文档列表错误:', error);
        res.status(500).json({ error: '获取文档列表失败' });
    }
});

// 删除文档
router.delete('/documents/:id', authenticate, requireCompany, async (req, res) => {
    try {
        const company = await Company.findOne({ where: { user_id: req.user.id } });
        if (!company) {
            return res.status(404).json({ error: '企业不存在' });
        }

        const document = await Document.findOne({
            where: { id: req.params.id, company_id: company.id }
        });

        if (!document) {
            return res.status(404).json({ error: '文档不存在' });
        }

        // 直接从数据库删除（文件内容已存储在数据库中）
        await document.destroy();

        res.json({ message: '文档已删除' });
    } catch (error) {
        console.error('[Company] 删除文档错误:', error);
        res.status(500).json({ error: '删除文档失败' });
    }
});

// 保存 BP 链接（替代上传文件）
router.post('/bp-link', authenticate, requireCompany, async (req, res) => {
    try {
        const { url, description } = req.body;

        if (!url) {
            return res.status(400).json({ error: '请输入 BP 链接' });
        }

        // 验证 URL 格式
        try {
            new URL(url);
        } catch (e) {
            return res.status(400).json({ error: '请输入有效的 URL 链接' });
        }

        const company = await Company.findOne({ where: { user_id: req.user.id } });
        if (!company) {
            return res.status(400).json({ error: '请先创建企业基本信息' });
        }

        // 创建一个 BP 链接类型的文档记录
        const document = await Document.create({
            company_id: company.id,
            type: 'bp',
            filename: 'BP Link - ' + new URL(url).hostname,
            filepath: null,
            filesize: 0,
            mimetype: 'text/x-uri',
            file_content: null,
            dataroom_link: url,
            description: description || 'Business Plan (External Link)',
            requires_approval: true
        });

        console.log(`[Company] BP 链接已保存: ${url} for company ${company.id}`);

        res.json({ 
            message: 'BP 链接保存成功',
            document: {
                id: document.id,
                filename: document.filename,
                type: document.type,
                dataroom_link: document.dataroom_link,
                created_at: document.created_at
            }
        });
    } catch (error) {
        console.error('[Company] 保存 BP 链接错误:', error);
        res.status(500).json({ error: '保存失败: ' + error.message });
    }
});

// 提交审核
router.post('/submit', authenticate, requireCompany, async (req, res) => {
    try {
        const company = await Company.findOne({ 
            where: { user_id: req.user.id },
            include: [
                { model: FundraisingInfo, as: 'fundraisingInfo' },
                { model: Document, as: 'documents' }
            ]
        });

        if (!company) {
            return res.status(400).json({ error: '请先创建企业基本信息' });
        }

        if (!company.fundraisingInfo) {
            return res.status(400).json({ error: '请先填写融资信息' });
        }

        // 检查是否有 BP（文件上传或链接）
        const hasBP = company.documents.some(doc => doc.type === 'bp');
        if (!hasBP) {
            return res.status(400).json({ error: '请先上传 BP 文件或填写 BP 链接' });
        }

        await company.update({ status: 'pending' });

        res.json({ 
            message: '已提交审核，请等待管理员审核',
            status: 'pending'
        });
    } catch (error) {
        console.error('[Company] 提交审核错误:', error);
        res.status(500).json({ error: '提交失败，请稍后重试' });
    }
});

// 获取访问请求列表（企业收到的）
router.get('/access-requests', authenticate, requireCompany, async (req, res) => {
    try {
        const company = await Company.findOne({ where: { user_id: req.user.id } });
        if (!company) {
            return res.json({ requests: [] });
        }

        const requests = await AccessRequest.findAll({
            where: { company_id: company.id },
            order: [['created_at', 'DESC']]
        });

        res.json({ requests });
    } catch (error) {
        console.error('[Company] 获取访问请求错误:', error);
        res.status(500).json({ error: '获取访问请求失败' });
    }
});

// 下载文档 - 从数据库返回文件内容
router.get('/documents/:id/download', authenticate, requireCompany, async (req, res) => {
    try {
        const company = await Company.findOne({ where: { user_id: req.user.id } });
        if (!company) {
            return res.status(404).json({ error: '企业不存在' });
        }

        const document = await Document.findOne({
            where: { id: req.params.id, company_id: company.id }
        });

        if (!document) {
            return res.status(404).json({ error: '文档不存在' });
        }

        if (!document.file_content) {
            return res.status(404).json({ error: '文件内容不存在' });
        }

        // 将 Base64 内容转换回 Buffer
        const fileBuffer = Buffer.from(document.file_content, 'base64');

        // 设置响应头 - 使用 RFC 5987 编码支持中文文件名
        const filename = document.filename;
        const encodedFilename = encodeURIComponent(filename).replace(/['()]/g, escape);
        
        res.setHeader('Content-Type', document.mimetype || 'application/octet-stream');
        res.setHeader('Content-Disposition', `attachment; filename="${encodedFilename}"; filename*=UTF-8''${encodedFilename}`);
        res.setHeader('Content-Length', fileBuffer.length);

        res.send(fileBuffer);
    } catch (error) {
        console.error('[Company] 下载文档错误:', error);
        res.status(500).json({ error: '下载失败' });
    }
});

// ==================== 消息功能 ====================

// 获取企业收到的消息列表
router.get('/messages', authenticate, requireCompany, async (req, res) => {
    try {
        const messages = await Message.findAll({
            where: { recipient_id: req.user.id },
            include: [
                { model: User, as: 'sender', attributes: ['id', 'email', 'name', 'role'] },
                { model: Company, as: 'company', attributes: ['id', 'name_cn', 'name_en'] }
            ],
            order: [['created_at', 'DESC']]
        });

        res.json({ messages });
    } catch (error) {
        console.error('[Company] 获取消息列表错误:', error);
        res.status(500).json({ error: '获取消息列表失败' });
    }
});

// 获取消息详情
router.get('/messages/:id', authenticate, requireCompany, async (req, res) => {
    try {
        const message = await Message.findOne({
            where: { 
                id: req.params.id,
                recipient_id: req.user.id 
            },
            include: [
                { model: User, as: 'sender', attributes: ['id', 'email', 'name', 'role'] },
                { model: Company, as: 'company', attributes: ['id', 'name_cn', 'name_en'] }
            ]
        });

        if (!message) {
            return res.status(404).json({ error: '消息不存在' });
        }

        // 标记为已读
        if (!message.is_read) {
            await message.update({ is_read: true, read_at: new Date() });
        }

        res.json({ message });
    } catch (error) {
        console.error('[Company] 获取消息详情错误:', error);
        res.status(500).json({ error: '获取消息详情失败' });
    }
});

// 回复消息 - 企业只能回复收到的消息
router.post('/messages/:id/reply', authenticate, requireCompany, async (req, res) => {
    try {
        const { content, send_email = false } = req.body;

        if (!content) {
            return res.status(400).json({ error: '请填写回复内容' });
        }

        // 获取原消息，确保是发给当前用户的
        const originalMessage = await Message.findOne({
            where: { 
                id: req.params.id,
                recipient_id: req.user.id 
            },
            include: [
                { model: User, as: 'sender', attributes: ['id', 'email', 'name', 'role'] }
            ]
        });

        if (!originalMessage) {
            return res.status(404).json({ error: '原消息不存在或无权回复' });
        }

        // 获取企业信息
        const company = await Company.findOne({ where: { user_id: req.user.id } });

        // 创建回复消息 - 发送给原消息的发送者
        const replyMessage = await Message.create({
            sender_id: req.user.id,
            recipient_id: originalMessage.sender_id,
            company_id: originalMessage.company_id || company?.id,
            type: 'reply',
            subject: `Re: ${originalMessage.subject}`,
            content
        });

        // 发送邮件通知
        let emailSent = false;
        if ((send_email === true || send_email === 'true') && emailService.isConfigured() && originalMessage.sender) {
            const result = await emailService.sendMessageNotification({
                to: originalMessage.sender.email,
                senderName: company?.name_cn || req.user.name || '企业用户',
                subject: `Re: ${originalMessage.subject}`,
                content: content.replace(/\n/g, '<br>')
            });
            emailSent = result.success;
            if (result.success) {
                await replyMessage.update({ email_sent: true, email_sent_at: new Date() });
                console.log(`[Company] 回复邮件发送成功: ${originalMessage.sender.email}`);
            }
        }

        console.log(`[Company] 企业 ${req.user.email} 回复消息: ${originalMessage.subject}`);

        res.json({ 
            message: '回复发送成功', 
            data: replyMessage,
            email_sent: emailSent
        });
    } catch (error) {
        console.error('[Company] 回复消息错误:', error);
        res.status(500).json({ error: '回复失败' });
    }
});

// 获取企业发送的消息（回复）
router.get('/messages/sent', authenticate, requireCompany, async (req, res) => {
    try {
        const messages = await Message.findAll({
            where: { sender_id: req.user.id },
            include: [
                { model: User, as: 'recipient', attributes: ['id', 'email', 'name', 'role'] },
                { model: Company, as: 'company', attributes: ['id', 'name_cn', 'name_en'] }
            ],
            order: [['created_at', 'DESC']]
        });

        res.json({ messages });
    } catch (error) {
        console.error('[Company] 获取已发送消息错误:', error);
        res.status(500).json({ error: '获取消息列表失败' });
    }
});

// 获取未读消息数量
router.get('/messages/unread-count', authenticate, requireCompany, async (req, res) => {
    try {
        const count = await Message.count({
            where: { 
                recipient_id: req.user.id,
                is_read: false
            }
        });

        res.json({ unread_count: count });
    } catch (error) {
        console.error('[Company] 获取未读消息数量错误:', error);
        res.status(500).json({ error: '获取未读消息数量失败' });
    }
});

// ==================== 企业反馈/评论功能 ====================

// 获取企业收到的所有反馈评论（排除内部评论）
router.get('/feedback', authenticate, requireCompany, async (req, res) => {
    try {
        const company = await Company.findOne({ where: { user_id: req.user.id } });
        if (!company) {
            return res.json({ comments: [] });
        }

        // 企业只能看到非内部评论（is_internal = false 或 null）
        const { Op } = require('sequelize');
        const comments = await CompanyComment.findAll({
            where: { 
                company_id: company.id,
                [Op.or]: [
                    { is_internal: false },
                    { is_internal: null }
                ]
            },
            include: [
                { model: User, as: 'user', attributes: ['id', 'email', 'name', 'role'] }
            ],
            order: [['created_at', 'ASC']]
        });

        // 标记企业已读（仅外部评论）
        await CompanyComment.update(
            { is_read_by_company: true, company_read_at: new Date() },
            { 
                where: { 
                    company_id: company.id, 
                    user_role: { [Op.in]: ['admin', 'staff'] },
                    is_read_by_company: false,
                    [Op.or]: [
                        { is_internal: false },
                        { is_internal: null }
                    ]
                } 
            }
        );

        res.json({ comments });
    } catch (error) {
        console.error('[Company] 获取反馈错误:', error);
        res.status(500).json({ error: '获取反馈失败' });
    }
});

// 企业添加回复/评论
router.post('/feedback', authenticate, requireCompany, async (req, res) => {
    try {
        const { content } = req.body;

        if (!content || !content.trim()) {
            return res.status(400).json({ error: '请输入回复内容' });
        }

        const company = await Company.findOne({ where: { user_id: req.user.id } });
        if (!company) {
            return res.status(400).json({ error: '请先创建企业信息' });
        }

        const comment = await CompanyComment.create({
            company_id: company.id,
            user_id: req.user.id,
            content: content.trim(),
            user_role: 'company',
            is_read_by_company: true, // 企业自己发的，自己已读
            is_read_by_admin: false // 管理员未读
        });

        // 获取完整的评论信息
        const fullComment = await CompanyComment.findByPk(comment.id, {
            include: [
                { model: User, as: 'user', attributes: ['id', 'email', 'name', 'role'] }
            ]
        });

        console.log(`[Company] 企业 ${company.name_cn} 添加了反馈回复`);

        res.status(201).json({ 
            message: '回复已发送',
            comment: fullComment
        });
    } catch (error) {
        console.error('[Company] 添加回复错误:', error);
        res.status(500).json({ error: '发送回复失败' });
    }
});

// 获取企业未读反馈数量（管理员/Staff发的未读，排除内部评论）
router.get('/feedback/unread-count', authenticate, requireCompany, async (req, res) => {
    try {
        const company = await Company.findOne({ where: { user_id: req.user.id } });
        if (!company) {
            return res.json({ unread_count: 0 });
        }

        const { Op } = require('sequelize');
        // 只统计非内部评论的未读数量
        const count = await CompanyComment.count({
            where: { 
                company_id: company.id,
                user_role: { [Op.in]: ['admin', 'staff'] },
                is_read_by_company: false,
                [Op.or]: [
                    { is_internal: false },
                    { is_internal: null }
                ]
            }
        });

        res.json({ unread_count: count });
    } catch (error) {
        console.error('[Company] 获取未读反馈数量错误:', error);
        res.status(500).json({ error: '获取未读数量失败' });
    }
});

module.exports = router;
