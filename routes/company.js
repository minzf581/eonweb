const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { Op } = require('sequelize');
const { User, Company, FundraisingInfo, Document, AccessRequest, Message, CompanyComment, CompanyPermission } = require('../models');
const { authenticate, requireCompany, requireStaffOrAdmin } = require('../middleware/auth');
const emailService = require('../services/EmailService');

// Helper function: Get authorized users who can view a company (admins + staff with permissions)
async function getAuthorizedUsersForCompany(companyId, excludeUserId = null) {
    const recipients = [];
    
    // Get all admins (excluding the sender if specified)
    const adminWhere = { role: 'admin', status: 'active' };
    if (excludeUserId) {
        adminWhere.id = { [Op.ne]: excludeUserId };
    }
    const admins = await User.findAll({
        where: adminWhere,
        attributes: ['email', 'name']
    });
    recipients.push(...admins.map(a => a.email));
    
    // Get staff with permissions for this company
    const permissions = await CompanyPermission.findAll({
        where: { 
            company_id: companyId, 
            is_active: true,
            [Op.or]: [
                { expires_at: null },
                { expires_at: { [Op.gt]: new Date() } }
            ]
        },
        include: [{ 
            model: User, 
            as: 'permittedUser', 
            where: { 
                role: 'staff', 
                status: 'active',
                ...(excludeUserId ? { id: { [Op.ne]: excludeUserId } } : {})
            },
            attributes: ['email', 'name']
        }]
    });
    permissions.forEach(p => {
        if (p.permittedUser?.email) {
            recipients.push(p.permittedUser.email);
        }
    });
    
    // Also include company creator if it's a staff user
    const company = await Company.findByPk(companyId, {
        attributes: ['created_by'],
        include: [{
            model: User,
            as: 'user',
            attributes: ['email', 'name']
        }]
    });
    
    if (company?.created_by) {
        const creator = await User.findByPk(company.created_by, {
            attributes: ['email', 'name', 'role'],
            where: { status: 'active' }
        });
        if (creator && creator.role === 'staff' && creator.id !== excludeUserId) {
            if (!recipients.includes(creator.email)) {
                recipients.push(creator.email);
            }
        }
    }
    
    // Return unique emails
    return [...new Set(recipients)];
}

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

// 获取企业列表（仅 staff/admin 可见）
router.get('/companies', authenticate, requireCompany, async (req, res) => {
    try {
        // 只有 staff 和 admin 可以获取企业列表
        if (req.user.role !== 'staff' && req.user.role !== 'admin') {
            return res.status(403).json({ error: '无权访问' });
        }

        let whereClause;
        
        if (req.user.role === 'admin') {
            whereClause = {};
        } else {
            // Staff 只能看到自己创建的企业或被授权的企业
            const permittedCompanyIds = await CompanyPermission.findAll({
                where: {
                    user_id: req.user.id,
                    is_active: true,
                    [Op.or]: [
                        { expires_at: null },
                        { expires_at: { [Op.gt]: new Date() } }
                    ]
                },
                attributes: ['company_id']
            }).then(perms => perms.map(p => p.company_id));

            whereClause = {
                [Op.or]: [
                    { created_by: req.user.id },
                    ...(permittedCompanyIds.length > 0 ? [{ id: { [Op.in]: permittedCompanyIds } }] : [])
                ]
            };
        }

        const companies = await Company.findAll({
            where: whereClause,
            include: [
                { model: FundraisingInfo, as: 'fundraisingInfo', required: false },
                { model: Document, as: 'documents', required: false }
            ],
            order: [['created_at', 'DESC']]
        });

        res.json({ companies });
    } catch (error) {
        console.error('[Company] 获取企业列表错误:', error);
        res.status(500).json({ error: '获取企业列表失败' });
    }
});

// 获取当前用户的企业信息（支持 staff 通过 companyId 参数访问特定企业）
router.get('/profile', authenticate, requireCompany, async (req, res) => {
    try {
        const { companyId } = req.query;
        let company;

        let isCreator = false;
        let hasPermission = false;

        // Staff 或 Admin 可以通过 companyId 参数访问特定企业
        if ((req.user.role === 'staff' || req.user.role === 'admin') && companyId) {
            // 检查权限
            const targetCompany = await Company.findByPk(companyId);
            if (!targetCompany) {
                return res.status(404).json({ error: '企业不存在' });
            }

            // 检查是否是创建者
            isCreator = targetCompany.created_by === req.user.id;
            
            // 检查是否有被授权的权限
            const permission = await CompanyPermission.findOne({
                where: {
                    company_id: companyId,
                    user_id: req.user.id,
                    is_active: true,
                    [Op.or]: [
                        { expires_at: null },
                        { expires_at: { [Op.gt]: new Date() } }
                    ]
                }
            });

            hasPermission = !!permission;

            if (!isCreator && !hasPermission && req.user.role !== 'admin') {
                return res.status(403).json({ error: '无权访问该企业' });
            }

            company = await Company.findOne({
                where: { id: companyId },
                include: [
                    { model: FundraisingInfo, as: 'fundraisingInfo' },
                    { model: Document, as: 'documents' }
                ]
            });
        } else {
            // Company 角色或未指定 companyId 时，获取自己的企业
            company = await Company.findOne({
                where: { user_id: req.user.id },
                include: [
                    { model: FundraisingInfo, as: 'fundraisingInfo' },
                    { model: Document, as: 'documents' }
                ]
            });
            if (company) {
                isCreator = company.user_id === req.user.id;
            }
        }

        if (!company) {
            return res.json({ company: null, message: '尚未创建企业资料' });
        }

        // 返回时标记是否是创建者
        res.json({ 
            company,
            isCreator,
            canManage: isCreator || req.user.role === 'admin' || hasPermission
        });
    } catch (error) {
        console.error('[Company] 获取企业信息错误:', error);
        res.status(500).json({ error: '获取企业信息失败' });
    }
});

// 创建或更新企业基本信息（所有字段可选）
router.post('/profile', authenticate, requireCompany, async (req, res) => {
    try {
        const {
            companyId, // Staff 使用此参数指定要更新的企业
            name_cn, name_en, website, linkedin,
            industry_primary, industry_secondary,
            location_headquarters, location_rd,
            description, description_detail,
            stage,
            contact_name, contact_title, contact_email,
            contact_phone, contact_wechat, contact_whatsapp
        } = req.body;

        // 只验证公司名称（至少需要一个名称用于标识）
        if (!name_cn && !name_en) {
            return res.status(400).json({ 
                error: '请至少填写公司中文名称或英文名称',
                field: 'name'
            });
        }

        let company;
        let isUpdate = false;

        // Staff 或 Admin 可以通过 companyId 更新特定企业
        if ((req.user.role === 'staff' || req.user.role === 'admin') && companyId) {
            company = await Company.findByPk(companyId);
            if (!company) {
                return res.status(404).json({ error: '企业不存在' });
            }

            // 检查权限
            const isCreator = company.created_by === req.user.id;
            const permission = await CompanyPermission.findOne({
                where: {
                    company_id: companyId,
                    user_id: req.user.id,
                    is_active: true,
                    [Op.or]: [
                        { expires_at: null },
                        { expires_at: { [Op.gt]: new Date() } }
                    ]
                }
            });

            if (!isCreator && !permission && req.user.role !== 'admin') {
                return res.status(403).json({ error: '无权访问该企业' });
            }

            isUpdate = true;
        } else {
            // Company 角色获取自己的企业
            company = await Company.findOne({ where: { user_id: req.user.id } });
            isUpdate = !!company;
        }

        const companyData = {
            name_cn: name_cn || null,
            name_en: name_en || null,
            website: website || null,
            linkedin: linkedin || null,
            industry_primary: industry_primary || null,
            industry_secondary: industry_secondary || null,
            location_headquarters: location_headquarters || null,
            location_rd: location_rd || null,
            description: description || null,
            description_detail: description_detail || null,
            stage: stage || null,
            contact_name: contact_name || null,
            contact_title: contact_title || null,
            contact_email: contact_email || null,
            contact_phone: contact_phone || null,
            contact_wechat: contact_wechat || null,
            contact_whatsapp: contact_whatsapp || null
        };

        // 只有 Company 角色创建新企业时才设置 user_id
        if (!isUpdate && req.user.role === 'company') {
            companyData.user_id = req.user.id;
            companyData.status = 'draft';
        }

        if (company) {
            // 更新（保持原有状态，允许在提交后继续编辑）
            await company.update(companyData);
        } else {
            // 创建时设为草稿状态
            company = await Company.create(companyData);
        }

        res.json({ 
            message: isUpdate ? '企业信息已更新' : '企业信息已创建',
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
        const { companyId } = req.body; // Staff 使用此参数
        let company;

        // Staff 或 Admin 可以通过 companyId 更新特定企业
        if ((req.user.role === 'staff' || req.user.role === 'admin') && companyId) {
            company = await Company.findByPk(companyId);
            if (!company) {
                return res.status(404).json({ error: '企业不存在' });
            }

            // 检查权限
            const isCreator = company.created_by === req.user.id;
            const permission = await CompanyPermission.findOne({
                where: {
                    company_id: companyId,
                    user_id: req.user.id,
                    is_active: true,
                    [Op.or]: [
                        { expires_at: null },
                        { expires_at: { [Op.gt]: new Date() } }
                    ]
                }
            });

            if (!isCreator && !permission && req.user.role !== 'admin') {
                return res.status(403).json({ error: '无权访问该企业' });
            }
        } else {
            // Company 角色获取自己的企业
            company = await Company.findOne({ where: { user_id: req.user.id } });
        }

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
        const { companyId } = req.body; // Staff 使用此参数
        let company;

        // Staff 或 Admin 可以通过 companyId 更新特定企业
        if ((req.user.role === 'staff' || req.user.role === 'admin') && companyId) {
            company = await Company.findByPk(companyId);
            if (!company) {
                return res.status(404).json({ error: '企业不存在' });
            }

            // 检查权限
            const isCreator = company.created_by === req.user.id;
            const permission = await CompanyPermission.findOne({
                where: {
                    company_id: companyId,
                    user_id: req.user.id,
                    is_active: true,
                    [Op.or]: [
                        { expires_at: null },
                        { expires_at: { [Op.gt]: new Date() } }
                    ]
                }
            });

            if (!isCreator && !permission && req.user.role !== 'admin') {
                return res.status(403).json({ error: '无权访问该企业' });
            }
        } else {
            // Company 角色获取自己的企业
            company = await Company.findOne({ where: { user_id: req.user.id } });
        }

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

        // Send email notification to authorized users
        try {
            if (emailService.isConfigured()) {
                const recipients = await getAuthorizedUsersForCompany(company.id, req.user.id);
                
                if (recipients.length > 0) {
                    const companyName = company.name_en || company.name_cn || 'Company';
                    const uploaderName = req.user.name || req.user.email;
                    
                    const html = emailService.generateTemplate({
                        title: 'New File Uploaded',
                        content: `
                            <p>A new file has been uploaded for company <strong>${companyName}</strong>.</p>
                            <table style="width: 100%; margin: 20px 0; border-collapse: collapse;">
                                <tr>
                                    <td style="padding: 12px; background: #F9FAFB; border: 1px solid #E5E7EB; font-weight: 500; width: 120px;">File Name</td>
                                    <td style="padding: 12px; border: 1px solid #E5E7EB;">${document.filename}</td>
                                </tr>
                                <tr>
                                    <td style="padding: 12px; background: #F9FAFB; border: 1px solid #E5E7EB; font-weight: 500;">File Type</td>
                                    <td style="padding: 12px; border: 1px solid #E5E7EB;">${document.type === 'bp' ? 'Business Plan' : document.type}</td>
                                </tr>
                                <tr>
                                    <td style="padding: 12px; background: #F9FAFB; border: 1px solid #E5E7EB; font-weight: 500;">File Size</td>
                                    <td style="padding: 12px; border: 1px solid #E5E7EB;">${(document.filesize / 1024).toFixed(2)} KB</td>
                                </tr>
                                <tr>
                                    <td style="padding: 12px; background: #F9FAFB; border: 1px solid #E5E7EB; font-weight: 500;">Uploaded By</td>
                                    <td style="padding: 12px; border: 1px solid #E5E7EB;">${uploaderName}</td>
                                </tr>
                            </table>
                        `,
                        actionUrl: `${process.env.SITE_URL || 'https://eonprotocol.ai'}/admin/fundraising.html#companies`,
                        actionText: 'View Company'
                    });

                    await emailService.sendBulkEmail({
                        recipients,
                        subject: `[EON Protocol] New File Uploaded - ${companyName}`,
                        html
                    });

                    console.log(`[Company] File upload notification sent to ${recipients.length} recipients`);
                }
            }
        } catch (emailError) {
            console.error('[Company] Failed to send file upload notification:', emailError);
            // Don't fail the upload if email fails
        }

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
        const { url, description, companyId } = req.body; // Staff 使用此参数

        if (!url) {
            return res.status(400).json({ error: '请输入 BP 链接' });
        }

        // 验证 URL 格式
        try {
            new URL(url);
        } catch (e) {
            return res.status(400).json({ error: '请输入有效的 URL 链接' });
        }

        let company;

        // Staff 或 Admin 可以通过 companyId 更新特定企业
        if ((req.user.role === 'staff' || req.user.role === 'admin') && companyId) {
            company = await Company.findByPk(companyId);
            if (!company) {
                return res.status(404).json({ error: '企业不存在' });
            }

            // 检查权限
            const isCreator = company.created_by === req.user.id;
            const permission = await CompanyPermission.findOne({
                where: {
                    company_id: companyId,
                    user_id: req.user.id,
                    is_active: true,
                    [Op.or]: [
                        { expires_at: null },
                        { expires_at: { [Op.gt]: new Date() } }
                    ]
                }
            });

            if (!isCreator && !permission && req.user.role !== 'admin') {
                return res.status(403).json({ error: '无权访问该企业' });
            }
        } else {
            // Company 角色获取自己的企业
            company = await Company.findOne({ where: { user_id: req.user.id } });
        }

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

// 提交审核（只需要公司名称和 BP 即可提交，融资信息可选）
router.post('/submit', authenticate, requireCompany, async (req, res) => {
    try {
        const { companyId } = req.body; // Staff 使用此参数
        let company;

        // Staff 或 Admin 可以通过 companyId 提交特定企业
        if ((req.user.role === 'staff' || req.user.role === 'admin') && companyId) {
            company = await Company.findOne({ 
                where: { id: companyId },
                include: [
                    { model: FundraisingInfo, as: 'fundraisingInfo' },
                    { model: Document, as: 'documents' }
                ]
            });
            if (!company) {
                return res.status(404).json({ error: '企业不存在' });
            }

            // 检查权限
            const isCreator = company.created_by === req.user.id;
            const permission = await CompanyPermission.findOne({
                where: {
                    company_id: companyId,
                    user_id: req.user.id,
                    is_active: true,
                    [Op.or]: [
                        { expires_at: null },
                        { expires_at: { [Op.gt]: new Date() } }
                    ]
                }
            });

            if (!isCreator && !permission && req.user.role !== 'admin') {
                return res.status(403).json({ error: '无权访问该企业' });
            }
        } else {
            // Company 角色获取自己的企业
            company = await Company.findOne({ 
                where: { user_id: req.user.id },
                include: [
                    { model: FundraisingInfo, as: 'fundraisingInfo' },
                    { model: Document, as: 'documents' }
                ]
            });
        }

        if (!company) {
            return res.status(400).json({ error: '请先创建企业基本信息' });
        }

        // 检查企业是否已经提交或审核中
        if (company.status !== 'draft') {
            return res.status(400).json({ error: '企业已提交审核或已通过审核' });
        }

        // 只需要有公司名称
        if (!company.name_cn && !company.name_en) {
            return res.status(400).json({ error: '请先填写公司名称' });
        }

        // 检查是否有 BP（文件上传或链接）
        const hasBP = company.documents && company.documents.some(doc => doc.type === 'bp');
        if (!hasBP) {
            return res.status(400).json({ error: '请先上传 BP 文件或填写 BP 链接' });
        }

        await company.update({ status: 'pending' });

        // 通知所有管理员有新公司提交审核
        try {
            const admins = await User.findAll({ 
                where: { role: ['admin', 'staff'], status: 'active' },
                attributes: ['email']
            });
            
            const adminEmails = admins.map(a => a.email);
            if (adminEmails.length > 0 && emailService.isConfigured()) {
                const companyName = company.name_cn || company.name_en;
                await emailService.sendCompanySubmittedNotification({
                    to: adminEmails,
                    companyName,
                    submitterName: req.user.name,
                    submitterEmail: req.user.email
                });
                console.log(`[Company] 已通知 ${adminEmails.length} 位管理员: ${companyName} 提交审核`);
            }
        } catch (emailError) {
            console.error('[Company] 发送通知邮件失败:', emailError);
            // 不影响主流程
        }

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

        const companyName = company.name_en || company.name_cn || 'Company';
        console.log(`[Company] Company ${companyName} added feedback reply`);

        // Send email notification to authorized users
        try {
            if (emailService.isConfigured()) {
                const recipients = await getAuthorizedUsersForCompany(company.id, req.user.id);
                
                if (recipients.length > 0) {
                    await emailService.sendFeedbackNotification({
                        to: recipients,
                        companyName,
                        senderName: req.user.name || req.user.email,
                        senderRole: 'company',
                        content: content.trim()
                    });

                    console.log(`[Company] Feedback notification sent to ${recipients.length} recipients`);
                }
            }
        } catch (emailError) {
            console.error('[Company] Failed to send feedback notification:', emailError);
            // Don't fail the request if email fails
        }

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

// ==================== 访问控制功能 ====================

// 获取企业可见性设置
router.get('/visibility', authenticate, requireCompany, async (req, res) => {
    try {
        const { companyId } = req.query;
        
        let company;
        if (req.user.role === 'staff' || req.user.role === 'admin') {
            if (!companyId) {
                return res.status(400).json({ error: '请指定企业ID' });
            }
            company = await Company.findByPk(companyId);
        } else {
            company = await Company.findOne({ where: { user_id: req.user.id } });
        }

        if (!company) {
            return res.status(404).json({ error: '企业不存在' });
        }

        res.json({ 
            visibility: company.visibility || 'private',
            companyId: company.id
        });
    } catch (error) {
        console.error('[Company] 获取可见性设置错误:', error);
        res.status(500).json({ error: '获取可见性设置失败' });
    }
});

// 更新企业可见性设置
router.post('/visibility', authenticate, requireCompany, async (req, res) => {
    try {
        const { visibility, companyId } = req.body;
        
        // 验证可见性值
        const validVisibilities = ['private', 'admin_only', 'partial', 'public'];
        if (!validVisibilities.includes(visibility)) {
            return res.status(400).json({ error: '无效的可见性设置' });
        }
        
        let company;
        if (req.user.role === 'staff' || req.user.role === 'admin') {
            if (!companyId) {
                return res.status(400).json({ error: '请指定企业ID' });
            }
            company = await Company.findByPk(companyId);
            // 检查 staff 权限
            if (req.user.role === 'staff' && company.created_by !== req.user.id) {
                const permission = await CompanyPermission.findOne({
                    where: { company_id: companyId, user_id: req.user.id, is_active: true }
                });
                if (!permission) {
                    return res.status(403).json({ error: '无权修改该企业' });
                }
            }
        } else {
            company = await Company.findOne({ where: { user_id: req.user.id } });
        }

        if (!company) {
            return res.status(404).json({ error: '企业不存在' });
        }

        await company.update({ visibility });

        console.log(`[Company] 企业 ${company.name_cn || company.name_en} 可见性更新为 ${visibility}`);

        res.json({ 
            message: '可见性设置已更新',
            visibility: company.visibility
        });
    } catch (error) {
        console.error('[Company] 更新可见性设置错误:', error);
        res.status(500).json({ error: '更新可见性设置失败' });
    }
});

// 获取待审批的访问请求（投资人发来的）
router.get('/access-requests', authenticate, requireCompany, async (req, res) => {
    try {
        const { companyId, status = 'pending' } = req.query;
        
        let whereClause = {};
        
        if (req.user.role === 'staff' || req.user.role === 'admin') {
            if (companyId) {
                whereClause.company_id = companyId;
            } else {
                // 获取该 staff 有权限的所有企业
                const permittedCompanyIds = await CompanyPermission.findAll({
                    where: { user_id: req.user.id, is_active: true },
                    attributes: ['company_id']
                }).then(perms => perms.map(p => p.company_id));
                
                const createdCompanyIds = await Company.findAll({
                    where: { created_by: req.user.id },
                    attributes: ['id']
                }).then(comps => comps.map(c => c.id));
                
                const allCompanyIds = [...new Set([...permittedCompanyIds, ...createdCompanyIds])];
                if (allCompanyIds.length === 0) {
                    return res.json({ requests: [] });
                }
                whereClause.company_id = { [Op.in]: allCompanyIds };
            }
        } else {
            // Company 角色只能看到自己企业的请求
            const company = await Company.findOne({ where: { user_id: req.user.id } });
            if (!company) {
                return res.json({ requests: [] });
            }
            whereClause.company_id = company.id;
        }
        
        if (status !== 'all') {
            whereClause.status = status;
        }

        const requests = await AccessRequest.findAll({
            where: whereClause,
            include: [
                { 
                    model: User, 
                    as: 'investor', 
                    attributes: ['id', 'email', 'name']
                },
                {
                    model: Company,
                    as: 'company',
                    attributes: ['id', 'name_cn', 'name_en']
                }
            ],
            order: [['created_at', 'DESC']]
        });

        res.json({ requests });
    } catch (error) {
        console.error('[Company] 获取访问请求错误:', error);
        res.status(500).json({ error: '获取访问请求失败' });
    }
});

// 审批访问请求
router.post('/access-requests/:id/review', authenticate, requireCompany, async (req, res) => {
    try {
        const { id } = req.params;
        const { action, response } = req.body; // action: 'approve' 或 'reject'
        
        if (!['approve', 'reject'].includes(action)) {
            return res.status(400).json({ error: '无效的操作' });
        }

        const request = await AccessRequest.findByPk(id, {
            include: [
                { model: User, as: 'investor', attributes: ['id', 'email', 'name'] },
                { model: Company, as: 'company' }
            ]
        });

        if (!request) {
            return res.status(404).json({ error: '请求不存在' });
        }

        // 检查权限
        let hasPermission = false;
        if (req.user.role === 'admin') {
            hasPermission = true;
        } else if (req.user.role === 'staff') {
            // Staff 需要是创建者或有权限
            if (request.company.created_by === req.user.id) {
                hasPermission = true;
            } else {
                const permission = await CompanyPermission.findOne({
                    where: { company_id: request.company_id, user_id: req.user.id, is_active: true }
                });
                hasPermission = !!permission;
            }
        } else {
            // Company 角色需要是企业所有者
            hasPermission = request.company.user_id === req.user.id;
        }

        if (!hasPermission) {
            return res.status(403).json({ error: '无权审批该请求' });
        }

        // 更新请求状态
        await request.update({
            status: action === 'approve' ? 'approved' : 'rejected',
            admin_response: response,
            processed_at: new Date(),
            processed_by: req.user.id,
            processed_by_role: req.user.role
        });

        const companyName = request.company.name_cn || request.company.name_en;
        console.log(`[Company] 用户 ${req.user.email} ${action === 'approve' ? '批准' : '拒绝'}了访问请求 (企业: ${companyName})`);

        // 发送邮件通知投资人
        try {
            if (emailService.isConfigured() && request.investor?.email) {
                const statusText = action === 'approve' ? '已批准' : '已拒绝';
                const html = emailService.generateTemplate({
                    title: `访问请求${statusText}`,
                    content: `<p>您对企业 <strong>${companyName}</strong> 的访问请求已被${statusText}。</p>
                        ${response ? `<p><strong>回复：</strong>${response}</p>` : ''}
                        ${action === 'approve' ? '<p>您现在可以查看该企业的详细信息和文档。</p>' : ''}`,
                    actionUrl: `${process.env.SITE_URL || 'https://eonprotocol.ai'}/investor`,
                    actionText: '查看详情'
                });

                await emailService.sendEmail({
                    to: request.investor.email,
                    subject: `[EON Protocol] 访问请求${statusText} - ${companyName}`,
                    html
                });
            }
        } catch (emailError) {
            console.error('[Company] 发送访问请求审批邮件失败:', emailError);
        }

        res.json({ 
            message: action === 'approve' ? '请求已批准' : '请求已拒绝',
            request
        });
    } catch (error) {
        console.error('[Company] 审批访问请求错误:', error);
        res.status(500).json({ error: '审批失败' });
    }
});

// 获取待审批请求数量
router.get('/access-requests/pending-count', authenticate, requireCompany, async (req, res) => {
    try {
        const { companyId } = req.query;
        
        let whereClause = { status: 'pending' };
        
        if (req.user.role === 'staff' || req.user.role === 'admin') {
            if (companyId) {
                whereClause.company_id = companyId;
            } else {
                const permittedCompanyIds = await CompanyPermission.findAll({
                    where: { user_id: req.user.id, is_active: true },
                    attributes: ['company_id']
                }).then(perms => perms.map(p => p.company_id));
                
                const createdCompanyIds = await Company.findAll({
                    where: { created_by: req.user.id },
                    attributes: ['id']
                }).then(comps => comps.map(c => c.id));
                
                const allCompanyIds = [...new Set([...permittedCompanyIds, ...createdCompanyIds])];
                if (allCompanyIds.length === 0) {
                    return res.json({ count: 0 });
                }
                whereClause.company_id = { [Op.in]: allCompanyIds };
            }
        } else {
            const company = await Company.findOne({ where: { user_id: req.user.id } });
            if (!company) {
                return res.json({ count: 0 });
            }
            whereClause.company_id = company.id;
        }

        const count = await AccessRequest.count({ where: whereClause });

        res.json({ count });
    } catch (error) {
        console.error('[Company] 获取待审批请求数量错误:', error);
        res.status(500).json({ error: '获取数量失败' });
    }
});

module.exports = router;
