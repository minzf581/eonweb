const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { Op } = require('sequelize');
const { User, Company, FundraisingInfo, Document, InvestorProfile, AccessRequest, Message } = require('../models');
const { authenticate, requireStaffOrAdmin } = require('../middleware/auth');

// 配置文件上传 - 内存存储
const storage = multer.memoryStorage();
const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB

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

// ==================== 仪表盘统计 ====================

// 获取普通管理员的统计数据（仅自己创建的企业）
router.get('/stats', authenticate, requireStaffOrAdmin, async (req, res) => {
    try {
        const whereClause = req.user.role === 'admin' 
            ? {} 
            : { created_by: req.user.id };

        const [
            totalCompanies,
            pendingCompanies,
            approvedCompanies
        ] = await Promise.all([
            Company.count({ where: whereClause }),
            Company.count({ where: { ...whereClause, status: 'pending' } }),
            Company.count({ where: { ...whereClause, status: 'approved' } })
        ]);

        // 获取这些企业收到的访问请求
        const companyIds = await Company.findAll({
            where: whereClause,
            attributes: ['id']
        }).then(companies => companies.map(c => c.id));

        const pendingRequests = companyIds.length > 0 
            ? await AccessRequest.count({ 
                where: { 
                    company_id: { [Op.in]: companyIds },
                    status: 'pending' 
                } 
            })
            : 0;

        res.json({
            companies: {
                total: totalCompanies,
                pending: pendingCompanies,
                approved: approvedCompanies
            },
            requests: {
                pending: pendingRequests
            }
        });
    } catch (error) {
        console.error('[Staff] 获取统计数据错误:', error);
        res.status(500).json({ error: '获取统计数据失败' });
    }
});

// ==================== 企业管理 ====================

// 获取我创建的企业列表
router.get('/companies', authenticate, requireStaffOrAdmin, async (req, res) => {
    try {
        const { status, page = 1, limit = 20 } = req.query;
        
        const whereClause = req.user.role === 'admin' 
            ? {} 
            : { created_by: req.user.id };

        if (status) {
            whereClause.status = status;
        }

        const { count, rows } = await Company.findAndCountAll({
            where: whereClause,
            include: [
                { model: FundraisingInfo, as: 'fundraisingInfo' },
                { model: Document, as: 'documents', attributes: ['id', 'filename', 'type', 'created_at'] }
            ],
            order: [['created_at', 'DESC']],
            limit: parseInt(limit),
            offset: (parseInt(page) - 1) * parseInt(limit)
        });

        res.json({
            companies: rows,
            pagination: {
                total: count,
                page: parseInt(page),
                limit: parseInt(limit),
                pages: Math.ceil(count / parseInt(limit))
            }
        });
    } catch (error) {
        console.error('[Staff] 获取企业列表错误:', error);
        res.status(500).json({ error: '获取企业列表失败' });
    }
});

// 获取单个企业详情
router.get('/companies/:id', authenticate, requireStaffOrAdmin, async (req, res) => {
    try {
        const whereClause = req.user.role === 'admin' 
            ? { id: req.params.id }
            : { id: req.params.id, created_by: req.user.id };

        const company = await Company.findOne({
            where: whereClause,
            include: [
                { model: FundraisingInfo, as: 'fundraisingInfo' },
                { model: Document, as: 'documents' },
                { model: User, as: 'user', attributes: ['id', 'email', 'name'] }
            ]
        });

        if (!company) {
            return res.status(404).json({ error: '企业不存在或无权访问' });
        }

        res.json({ company });
    } catch (error) {
        console.error('[Staff] 获取企业详情错误:', error);
        res.status(500).json({ error: '获取企业详情失败' });
    }
});

// 创建新企业
router.post('/companies', authenticate, requireStaffOrAdmin, async (req, res) => {
    try {
        const {
            name_cn, name_en, website, linkedin,
            industry_primary, industry_secondary,
            location_headquarters, location_rd,
            description, description_detail, stage,
            contact_name, contact_title, contact_email,
            contact_phone, contact_wechat, contact_whatsapp
        } = req.body;

        // 验证必填字段
        if (!name_cn || !industry_primary || !location_headquarters || !description || !stage || !contact_name || !contact_email) {
            return res.status(400).json({ error: '请填写所有必填字段' });
        }

        // 创建一个虚拟用户账户（用于企业门户登录）或使用现有用户
        let companyUser;
        const existingUser = await User.findOne({ where: { email: contact_email } });
        
        if (existingUser) {
            if (existingUser.role !== 'company') {
                return res.status(400).json({ error: '该邮箱已被其他角色使用' });
            }
            companyUser = existingUser;
        } else {
            // 创建新用户
            companyUser = await User.create({
                email: contact_email,
                password: Math.random().toString(36).slice(-12), // 随机密码，需要重置
                role: 'company',
                name: contact_name,
                status: 'active'
            });
        }

        // 创建企业
        const company = await Company.create({
            user_id: companyUser.id,
            created_by: req.user.id, // 记录创建者
            name_cn, name_en, website, linkedin,
            industry_primary, industry_secondary,
            location_headquarters, location_rd,
            description, description_detail, stage,
            contact_name, contact_title, contact_email,
            contact_phone, contact_wechat, contact_whatsapp,
            status: 'draft'
        });

        console.log(`[Staff] 用户 ${req.user.email} 创建企业: ${name_cn}`);

        res.status(201).json({
            message: '企业创建成功',
            company,
            user: companyUser.toSafeObject()
        });
    } catch (error) {
        console.error('[Staff] 创建企业错误:', error);
        res.status(500).json({ error: '创建企业失败: ' + error.message });
    }
});

// 更新企业信息
router.put('/companies/:id', authenticate, requireStaffOrAdmin, async (req, res) => {
    try {
        const whereClause = req.user.role === 'admin' 
            ? { id: req.params.id }
            : { id: req.params.id, created_by: req.user.id };

        const company = await Company.findOne({ where: whereClause });

        if (!company) {
            return res.status(404).json({ error: '企业不存在或无权访问' });
        }

        const updateFields = [
            'name_cn', 'name_en', 'website', 'linkedin',
            'industry_primary', 'industry_secondary',
            'location_headquarters', 'location_rd',
            'description', 'description_detail', 'stage',
            'contact_name', 'contact_title', 'contact_email',
            'contact_phone', 'contact_wechat', 'contact_whatsapp'
        ];

        const updates = {};
        updateFields.forEach(field => {
            if (req.body[field] !== undefined) {
                updates[field] = req.body[field];
            }
        });

        await company.update(updates);

        res.json({ message: '企业信息已更新', company });
    } catch (error) {
        console.error('[Staff] 更新企业错误:', error);
        res.status(500).json({ error: '更新企业失败' });
    }
});

// 保存企业融资信息
router.post('/companies/:id/fundraising', authenticate, requireStaffOrAdmin, async (req, res) => {
    try {
        const whereClause = req.user.role === 'admin' 
            ? { id: req.params.id }
            : { id: req.params.id, created_by: req.user.id };

        const company = await Company.findOne({ where: whereClause });

        if (!company) {
            return res.status(404).json({ error: '企业不存在或无权访问' });
        }

        const {
            purpose, financing_type, amount_min, amount_max,
            timeline, valuation_expectation, use_of_funds,
            overseas_structure, ip_ownership, data_sensitivity,
            additional_info
        } = req.body;

        let fundraisingInfo = await FundraisingInfo.findOne({ where: { company_id: company.id } });

        const fundraisingData = {
            company_id: company.id,
            purpose: purpose || [],
            financing_type: financing_type || [],
            amount_min: amount_min || 0,
            amount_max: amount_max || 0,
            timeline,
            valuation_expectation,
            use_of_funds,
            overseas_structure: overseas_structure || {},
            ip_ownership,
            data_sensitivity,
            additional_info
        };

        if (fundraisingInfo) {
            await fundraisingInfo.update(fundraisingData);
        } else {
            fundraisingInfo = await FundraisingInfo.create(fundraisingData);
        }

        res.json({ message: '融资信息已保存', fundraisingInfo });
    } catch (error) {
        console.error('[Staff] 保存融资信息错误:', error);
        res.status(500).json({ error: '保存融资信息失败' });
    }
});

// 上传企业 BP 文件
router.post('/companies/:id/upload-bp', authenticate, requireStaffOrAdmin, upload.single('file'), async (req, res) => {
    try {
        const whereClause = req.user.role === 'admin' 
            ? { id: req.params.id }
            : { id: req.params.id, created_by: req.user.id };

        const company = await Company.findOne({ where: whereClause });

        if (!company) {
            return res.status(404).json({ error: '企业不存在或无权访问' });
        }

        if (!req.file) {
            return res.status(400).json({ error: '请选择要上传的文件' });
        }

        // 将文件内容转换为 Base64 存储
        const fileContent = req.file.buffer.toString('base64');

        // 处理文件名编码
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

        console.log(`[Staff] 用户 ${req.user.email} 上传 BP: ${filename} for company ${company.id}`);

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
        console.error('[Staff] 上传 BP 错误:', error);
        res.status(500).json({ error: '上传失败: ' + error.message });
    }
});

// 保存企业 BP 链接
router.post('/companies/:id/bp-link', authenticate, requireStaffOrAdmin, async (req, res) => {
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

        const whereClause = req.user.role === 'admin' 
            ? { id: req.params.id }
            : { id: req.params.id, created_by: req.user.id };

        const company = await Company.findOne({ where: whereClause });

        if (!company) {
            return res.status(404).json({ error: '企业不存在或无权访问' });
        }

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

        console.log(`[Staff] BP 链接已保存: ${url} for company ${company.id}`);

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
        console.error('[Staff] 保存 BP 链接错误:', error);
        res.status(500).json({ error: '保存失败: ' + error.message });
    }
});

// 提交企业审核
router.post('/companies/:id/submit', authenticate, requireStaffOrAdmin, async (req, res) => {
    try {
        const whereClause = req.user.role === 'admin' 
            ? { id: req.params.id }
            : { id: req.params.id, created_by: req.user.id };

        const company = await Company.findOne({ 
            where: whereClause,
            include: [
                { model: FundraisingInfo, as: 'fundraisingInfo' },
                { model: Document, as: 'documents' }
            ]
        });

        if (!company) {
            return res.status(404).json({ error: '企业不存在或无权访问' });
        }

        if (!company.fundraisingInfo) {
            return res.status(400).json({ error: '请先填写融资信息' });
        }

        const hasBP = company.documents.some(doc => doc.type === 'bp');
        if (!hasBP) {
            return res.status(400).json({ error: '请先上传 BP 文件或填写 BP 链接' });
        }

        await company.update({ status: 'pending' });

        console.log(`[Staff] 用户 ${req.user.email} 提交企业审核: ${company.name_cn}`);

        res.json({ 
            message: '已提交审核，请等待管理员审核',
            status: 'pending'
        });
    } catch (error) {
        console.error('[Staff] 提交审核错误:', error);
        res.status(500).json({ error: '提交失败，请稍后重试' });
    }
});

// 删除企业文档
router.delete('/companies/:companyId/documents/:docId', authenticate, requireStaffOrAdmin, async (req, res) => {
    try {
        const whereClause = req.user.role === 'admin' 
            ? { id: req.params.companyId }
            : { id: req.params.companyId, created_by: req.user.id };

        const company = await Company.findOne({ where: whereClause });

        if (!company) {
            return res.status(404).json({ error: '企业不存在或无权访问' });
        }

        const document = await Document.findOne({
            where: { id: req.params.docId, company_id: company.id }
        });

        if (!document) {
            return res.status(404).json({ error: '文档不存在' });
        }

        await document.destroy();

        res.json({ message: '文档已删除' });
    } catch (error) {
        console.error('[Staff] 删除文档错误:', error);
        res.status(500).json({ error: '删除文档失败' });
    }
});

// ==================== 访问请求管理 ====================

// 获取我的企业收到的访问请求
router.get('/requests', authenticate, requireStaffOrAdmin, async (req, res) => {
    try {
        const { status, page = 1, limit = 20 } = req.query;

        // 获取该用户创建的企业ID列表
        const companyWhere = req.user.role === 'admin' 
            ? {} 
            : { created_by: req.user.id };

        const companyIds = await Company.findAll({
            where: companyWhere,
            attributes: ['id']
        }).then(companies => companies.map(c => c.id));

        if (companyIds.length === 0) {
            return res.json({
                requests: [],
                pagination: { total: 0, page: 1, limit: 20, pages: 0 }
            });
        }

        const where = { company_id: { [Op.in]: companyIds } };
        if (status) {
            where.status = status;
        }

        const { count, rows } = await AccessRequest.findAndCountAll({
            where,
            include: [
                { 
                    model: Company, 
                    as: 'company',
                    attributes: ['id', 'name_cn', 'name_en', 'industry_primary']
                },
                { 
                    model: User, 
                    as: 'investor',
                    attributes: ['id', 'email', 'name'],
                    include: [{
                        model: InvestorProfile,
                        as: 'investorProfile',
                        attributes: ['name', 'organization', 'investor_type']
                    }]
                }
            ],
            order: [['created_at', 'DESC']],
            limit: parseInt(limit),
            offset: (parseInt(page) - 1) * parseInt(limit)
        });

        res.json({
            requests: rows,
            pagination: {
                total: count,
                page: parseInt(page),
                limit: parseInt(limit),
                pages: Math.ceil(count / parseInt(limit))
            }
        });
    } catch (error) {
        console.error('[Staff] 获取访问请求错误:', error);
        res.status(500).json({ error: '获取访问请求失败' });
    }
});

// ==================== 投资人浏览 ====================

// 获取已审核通过的投资人列表
router.get('/investors', authenticate, requireStaffOrAdmin, async (req, res) => {
    try {
        const { page = 1, limit = 20 } = req.query;

        const { count, rows } = await InvestorProfile.findAndCountAll({
            where: { status: 'approved' },
            include: [{
                model: User,
                as: 'user',
                attributes: ['id', 'email', 'name', 'created_at']
            }],
            order: [['created_at', 'DESC']],
            limit: parseInt(limit),
            offset: (parseInt(page) - 1) * parseInt(limit)
        });

        res.json({
            investors: rows,
            pagination: {
                total: count,
                page: parseInt(page),
                limit: parseInt(limit),
                pages: Math.ceil(count / parseInt(limit))
            }
        });
    } catch (error) {
        console.error('[Staff] 获取投资人列表错误:', error);
        res.status(500).json({ error: '获取投资人列表失败' });
    }
});

// 获取投资人详情
router.get('/investors/:id', authenticate, requireStaffOrAdmin, async (req, res) => {
    try {
        const profile = await InvestorProfile.findOne({
            where: { id: req.params.id, status: 'approved' },
            include: [{
                model: User,
                as: 'user',
                attributes: ['id', 'email', 'name', 'created_at']
            }]
        });

        if (!profile) {
            return res.status(404).json({ error: '投资人不存在或未审核' });
        }

        res.json({ investor: profile });
    } catch (error) {
        console.error('[Staff] 获取投资人详情错误:', error);
        res.status(500).json({ error: '获取投资人详情失败' });
    }
});

// ==================== 消息发送 ====================

// 发送消息给投资人
router.post('/messages', authenticate, requireStaffOrAdmin, async (req, res) => {
    try {
        const { recipient_id, subject, content, company_id } = req.body;

        if (!recipient_id || !subject || !content) {
            return res.status(400).json({ error: '请填写收件人、主题和内容' });
        }

        // 验证收件人是投资人
        const recipient = await User.findByPk(recipient_id);
        if (!recipient || recipient.role !== 'investor') {
            return res.status(400).json({ error: '收件人必须是投资人' });
        }

        // 如果指定了企业，验证是否有权限
        if (company_id) {
            const companyWhere = req.user.role === 'admin' 
                ? { id: company_id }
                : { id: company_id, created_by: req.user.id };

            const company = await Company.findOne({ where: companyWhere });
            if (!company) {
                return res.status(404).json({ error: '企业不存在或无权访问' });
            }
        }

        // 创建消息
        const message = await Message.create({
            sender_id: req.user.id,
            recipient_id,
            subject,
            content,
            related_company_id: company_id || null
        });

        console.log(`[Staff] 用户 ${req.user.email} 发送消息给 ${recipient.email}: ${subject}`);

        res.json({ message: '消息发送成功', data: message });
    } catch (error) {
        console.error('[Staff] 发送消息错误:', error);
        res.status(500).json({ error: '发送消息失败' });
    }
});

// 获取已发送的消息
router.get('/messages/sent', authenticate, requireStaffOrAdmin, async (req, res) => {
    try {
        const messages = await Message.findAll({
            where: { sender_id: req.user.id },
            include: [{
                model: User,
                as: 'recipient',
                attributes: ['id', 'email', 'name']
            }],
            order: [['created_at', 'DESC']]
        });

        res.json({ messages });
    } catch (error) {
        console.error('[Staff] 获取发送消息错误:', error);
        res.status(500).json({ error: '获取消息失败' });
    }
});

module.exports = router;
