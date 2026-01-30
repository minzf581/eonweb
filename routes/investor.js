const express = require('express');
const router = express.Router();
const { Op } = require('sequelize');
const { User, Company, FundraisingInfo, Document, InvestorProfile, AccessRequest, CompanyPermission, CompanyComment, InterestExpression, DataRoomAccess } = require('../models');
const { authenticate, requireInvestor } = require('../middleware/auth');
const emailService = require('../services/EmailService');

// 检查投资人对企业的访问权限
async function checkInvestorAccess(userId, companyId) {
    const permission = await CompanyPermission.findOne({
        where: {
            company_id: companyId,
            user_id: userId,
            is_active: true,
            [Op.or]: [
                { expires_at: null },
                { expires_at: { [Op.gt]: new Date() } }
            ]
        }
    });
    
    if (permission) {
        return { hasAccess: true, permissionType: permission.permission_type };
    }
    
    // 检查公开可见的企业
    const company = await Company.findOne({
        where: {
            id: companyId,
            status: 'approved',
            visibility: { [Op.in]: ['investors', 'whitelist'] }
        }
    });
    
    if (company) {
        return { hasAccess: true, permissionType: 'public' };
    }
    
    return { hasAccess: false, permissionType: null };
}

// 获取投资人资料
router.get('/profile', authenticate, requireInvestor, async (req, res) => {
    try {
        const profile = await InvestorProfile.findOne({
            where: { user_id: req.user.id }
        });

        if (!profile) {
            return res.json({ profile: null, message: '尚未创建投资人资料' });
        }

        res.json({ profile });
    } catch (error) {
        console.error('[Investor] 获取投资人资料错误:', error);
        res.status(500).json({ error: '获取投资人资料失败' });
    }
});

// 创建或更新投资人资料
router.post('/profile', authenticate, requireInvestor, async (req, res) => {
    try {
        const {
            name, investor_type, organization, title,
            phone, wechat, whatsapp, linkedin,
            industries, stages,
            ticket_size_min, ticket_size_max,
            regions, bio
        } = req.body;

        if (!name || !investor_type) {
            return res.status(400).json({ error: '请填写姓名和投资人类型' });
        }

        let profile = await InvestorProfile.findOne({ where: { user_id: req.user.id } });

        const profileData = {
            user_id: req.user.id,
            name, investor_type, organization, title,
            phone, wechat, whatsapp, linkedin,
            industries: industries || [],
            stages: stages || [],
            ticket_size_min, ticket_size_max,
            regions: regions || [],
            bio
        };

        if (profile) {
            await profile.update(profileData);
        } else {
            profile = await InvestorProfile.create({
                ...profileData,
                status: 'pending'
            });
        }

        res.json({ 
            message: '投资人资料已保存',
            profile 
        });
    } catch (error) {
        console.error('[Investor] 保存投资人资料错误:', error);
        res.status(500).json({ error: '保存投资人资料失败' });
    }
});

// 浏览项目列表（仅已审核且可见的，或被授权访问的）
router.get('/projects', authenticate, requireInvestor, async (req, res) => {
    try {
        // 检查投资人状态
        const profile = await InvestorProfile.findOne({ where: { user_id: req.user.id } });
        if (!profile || profile.status !== 'approved') {
            return res.status(403).json({ 
                error: '您的投资人账户尚未通过审核',
                status: profile?.status || 'pending'
            });
        }

        const { 
            industry, stage, amount_min, amount_max, 
            deal_status, sg_ready, search,
            page = 1, limit = 20 
        } = req.query;

        // 获取被授权访问的企业ID列表
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

        // 构建查询条件：公开可见的企业 或 被授权访问的企业
        // engage 状态的企业也对投资人可见
        const where = {
            [Op.or]: [
                // 公开对投资人可见的（包括 engage 状态）
                {
                    status: { [Op.in]: ['approved', 'engage'] },
                    visibility: { [Op.in]: ['investors', 'whitelist'] }
                },
                // 被授权访问的
                ...(permittedCompanyIds.length > 0 ? [{ id: { [Op.in]: permittedCompanyIds } }] : [])
            ]
        };

        // 初始化 and 条件数组
        where[Op.and] = [];

        // 行业筛选
        if (industry) {
            where[Op.and].push({
                [Op.or]: [
                    { industry_primary: industry },
                    { industry_secondary: industry }
                ]
            });
        }

        // 阶段筛选
        if (stage) {
            where[Op.and].push({ stage });
        }

        // 交易状态筛选
        if (deal_status) {
            where[Op.and].push({ deal_status });
        }

        // SG 准备状态筛选
        if (sg_ready) {
            where[Op.and].push({ sg_ready });
        }

        // 搜索关键词
        if (search) {
            where[Op.and].push({
                [Op.or]: [
                    { name_cn: { [Op.iLike]: `%${search}%` } },
                    { name_en: { [Op.iLike]: `%${search}%` } },
                    { description: { [Op.iLike]: `%${search}%` } }
                ]
            });
        }

        // 清空空的 and 数组
        if (where[Op.and].length === 0) {
            delete where[Op.and];
        }

        // 查询企业
        const { count, rows: companies } = await Company.findAndCountAll({
            where,
            include: [{
                model: FundraisingInfo,
                as: 'fundraisingInfo',
                required: false,
                where: amount_min || amount_max ? {
                    ...(amount_min && { amount_max: { [Op.gte]: amount_min } }),
                    ...(amount_max && { amount_min: { [Op.lte]: amount_max } })
                } : undefined
            }],
            order: [['created_at', 'DESC']],
            limit: parseInt(limit),
            offset: (parseInt(page) - 1) * parseInt(limit)
        });

        // 获取投资人对这些企业的兴趣表达记录
        const companyIds = companies.map(c => c.id);
        const interests = await InterestExpression.findAll({
            where: {
                company_id: { [Op.in]: companyIds },
                investor_id: req.user.id,
                status: 'active'
            },
            attributes: ['company_id', 'interest_type']
        });
        const interestMap = {};
        interests.forEach(i => { interestMap[i.company_id] = i.interest_type; });

        // 返回数据，标记是否为授权访问和兴趣状态
        const projects = companies.map(company => ({
            id: company.id,
            name_cn: company.name_cn,
            name_en: company.name_en,
            industry_primary: company.industry_primary,
            industry_secondary: company.industry_secondary,
            location_headquarters: company.location_headquarters,
            description: company.description,
            stage: company.stage,
            tags: company.tags,
            status: company.status,
            deal_status: company.deal_status,
            sg_ready: company.sg_ready,
            data_room_enabled: company.data_room_enabled,
            hasPermission: permittedCompanyIds.includes(company.id),
            hasExpressedInterest: !!interestMap[company.id],
            interestType: interestMap[company.id] || null,
            fundraising: company.fundraisingInfo ? {
                purpose: company.fundraisingInfo.purpose,
                financing_type: company.fundraisingInfo.financing_type,
                amount_min: company.fundraisingInfo.amount_min,
                amount_max: company.fundraisingInfo.amount_max,
                timeline: company.fundraisingInfo.timeline
            } : null,
            created_at: company.created_at
        }));

        res.json({
            projects,
            pagination: {
                total: count,
                page: parseInt(page),
                limit: parseInt(limit),
                pages: Math.ceil(count / parseInt(limit))
            }
        });
    } catch (error) {
        console.error('[Investor] 获取项目列表错误:', error);
        res.status(500).json({ error: '获取项目列表失败' });
    }
});

// 获取项目详情
router.get('/projects/:id', authenticate, requireInvestor, async (req, res) => {
    try {
        // 检查投资人状态
        const profile = await InvestorProfile.findOne({ where: { user_id: req.user.id } });
        if (!profile || profile.status !== 'approved') {
            return res.status(403).json({ error: '您的投资人账户尚未通过审核' });
        }

        // 检查是否有被授权访问的权限
        const permission = await CompanyPermission.findOne({
            where: {
                company_id: req.params.id,
                user_id: req.user.id,
                is_active: true,
                [Op.or]: [
                    { expires_at: null },
                    { expires_at: { [Op.gt]: new Date() } }
                ]
            }
        });

        // 构建查询条件
        let whereCondition;
        if (permission) {
            // 有授权权限，直接按ID查询
            whereCondition = { id: req.params.id };
        } else {
            // 没有授权权限，需要检查企业是否公开可见
            whereCondition = {
                id: req.params.id,
                status: 'approved',
                visibility: { [Op.in]: ['investors', 'whitelist'] }
            };
        }

        const company = await Company.findOne({
            where: whereCondition,
            include: [
                { model: FundraisingInfo, as: 'fundraisingInfo' },
                { 
                    model: Document, 
                    as: 'documents',
                    required: false
                }
            ]
        });

        if (!company) {
            return res.status(404).json({ error: '项目不存在或暂不可见' });
        }

        // 检查是否有已批准的访问请求
        const accessRequest = await AccessRequest.findOne({
            where: {
                investor_id: req.user.id,
                company_id: company.id,
                status: 'approved'
            }
        });

        // 是否有完整访问权限（授权权限 full 或 approved 访问请求）
        const hasFullAccess = (permission && permission.permission_type === 'full') || !!accessRequest;

        // 返回数据（根据权限决定是否包含详细信息）
        // 有被授权访问的权限（非公开）时显示管理员备注
        const canViewAdminNotes = permission && permission.permission_type;
        
        const projectData = {
            id: company.id,
            name_cn: company.name_cn,
            name_en: company.name_en,
            industry_primary: company.industry_primary,
            industry_secondary: company.industry_secondary,
            location_headquarters: company.location_headquarters,
            description: company.description,
            description_detail: company.description_detail,
            stage: company.stage,
            status: company.status,
            tags: company.tags,
            // 有授权权限时显示管理员备注
            admin_notes: canViewAdminNotes ? company.admin_notes : null,
            hasPermission: !!permission,
            permissionType: permission?.permission_type || null,
            fundraising: company.fundraisingInfo ? {
                purpose: company.fundraisingInfo.purpose,
                financing_type: company.fundraisingInfo.financing_type,
                amount_min: company.fundraisingInfo.amount_min,
                amount_max: company.fundraisingInfo.amount_max,
                timeline: company.fundraisingInfo.timeline,
                // 如果有完整访问权限，显示更多信息
                ...(hasFullAccess && {
                    use_of_funds: company.fundraisingInfo.use_of_funds,
                    overseas_structure: company.fundraisingInfo.overseas_structure
                })
            } : null,
            // 联系信息仅在有完整访问权限时显示
            contact: hasFullAccess ? {
                name: company.contact_name,
                title: company.contact_title,
                email: company.contact_email,
                phone: company.contact_phone,
                wechat: company.contact_wechat
            } : null,
            // BP 访问状态
            hasAccess: hasFullAccess,
            accessStatus: accessRequest?.status || (hasFullAccess ? 'approved' : null),
            // 文档：有完整权限显示所有，否则只显示公开的
            documents: hasFullAccess 
                ? company.documents 
                : company.documents?.filter(d => d.is_public) || [],
            created_at: company.created_at
        };

        res.json({ project: projectData });
    } catch (error) {
        console.error('[Investor] 获取项目详情错误:', error);
        res.status(500).json({ error: '获取项目详情失败' });
    }
});

// 发起访问请求
router.post('/request-access', authenticate, requireInvestor, async (req, res) => {
    try {
        // 检查投资人状态
        const profile = await InvestorProfile.findOne({ where: { user_id: req.user.id } });
        if (!profile || profile.status !== 'approved') {
            return res.status(403).json({ error: '您的投资人账户尚未通过审核' });
        }

        const { company_id, request_type, message } = req.body;

        if (!company_id || !request_type) {
            return res.status(400).json({ error: '请填写必要信息' });
        }

        // 检查企业是否存在且可见
        const company = await Company.findOne({
            where: {
                id: company_id,
                status: 'approved',
                visibility: { [Op.in]: ['investors', 'whitelist'] }
            }
        });

        if (!company) {
            return res.status(404).json({ error: '项目不存在或暂不可见' });
        }

        // 检查是否已有相同类型的待处理请求
        const existingRequest = await AccessRequest.findOne({
            where: {
                investor_id: req.user.id,
                company_id,
                request_type,
                status: 'pending'
            }
        });

        if (existingRequest) {
            return res.status(400).json({ error: '您已有相同类型的待处理请求' });
        }

        const request = await AccessRequest.create({
            investor_id: req.user.id,
            company_id,
            request_type,
            message,
            status: 'pending'
        });

        res.json({ 
            message: '请求已提交，请等待管理员处理',
            request: {
                id: request.id,
                request_type: request.request_type,
                status: request.status,
                created_at: request.created_at
            }
        });
    } catch (error) {
        console.error('[Investor] 发起访问请求错误:', error);
        res.status(500).json({ error: '提交请求失败' });
    }
});

// 获取我的请求记录
router.get('/my-requests', authenticate, requireInvestor, async (req, res) => {
    try {
        const requests = await AccessRequest.findAll({
            where: { investor_id: req.user.id },
            include: [{
                model: Company,
                as: 'company',
                attributes: ['id', 'name_cn', 'name_en', 'industry_primary', 'stage']
            }],
            order: [['created_at', 'DESC']]
        });

        res.json({ requests });
    } catch (error) {
        console.error('[Investor] 获取请求记录错误:', error);
        res.status(500).json({ error: '获取请求记录失败' });
    }
});

// ==================== 企业反馈/评论功能 ====================

// 获取企业的所有反馈评论（需要有权限）
router.get('/projects/:id/comments', authenticate, requireInvestor, async (req, res) => {
    try {
        // 检查投资人状态
        const profile = await InvestorProfile.findOne({ where: { user_id: req.user.id } });
        if (!profile || profile.status !== 'approved') {
            return res.status(403).json({ error: '您的投资人账户尚未通过审核' });
        }

        // 检查权限
        const { hasAccess } = await checkInvestorAccess(req.user.id, req.params.id);
        if (!hasAccess) {
            return res.status(403).json({ error: '无权访问该企业' });
        }

        const comments = await CompanyComment.findAll({
            where: { company_id: req.params.id },
            include: [
                { model: User, as: 'user', attributes: ['id', 'email', 'name', 'role'] }
            ],
            order: [['created_at', 'ASC']]
        });

        res.json({ comments });
    } catch (error) {
        console.error('[Investor] 获取企业评论错误:', error);
        res.status(500).json({ error: '获取评论失败' });
    }
});

// 添加评论/反馈（需要 full 权限）
router.post('/projects/:id/comments', authenticate, requireInvestor, async (req, res) => {
    try {
        const { content } = req.body;

        if (!content || !content.trim()) {
            return res.status(400).json({ error: '请输入评论内容' });
        }

        // 检查投资人状态
        const profile = await InvestorProfile.findOne({ where: { user_id: req.user.id } });
        if (!profile || profile.status !== 'approved') {
            return res.status(403).json({ error: '您的投资人账户尚未通过审核' });
        }

        const company = await Company.findByPk(req.params.id);
        if (!company) {
            return res.status(404).json({ error: '企业不存在' });
        }

        // 检查是否有 full 权限
        const { hasAccess, permissionType } = await checkInvestorAccess(req.user.id, req.params.id);
        if (!hasAccess || permissionType !== 'full') {
            return res.status(403).json({ error: '您没有发送反馈的权限（需要完整权限）' });
        }

        const comment = await CompanyComment.create({
            company_id: req.params.id,
            user_id: req.user.id,
            content: content.trim(),
            user_role: 'investor',
            is_read_by_admin: false,
            is_read_by_company: false
        });

        // 获取完整的评论信息
        const fullComment = await CompanyComment.findByPk(comment.id, {
            include: [
                { model: User, as: 'user', attributes: ['id', 'email', 'name', 'role'] }
            ]
        });

        console.log(`[Investor] 用户 ${req.user.email} 给企业 ${company.name_cn} 添加反馈`);

        res.status(201).json({ 
            message: '反馈已添加',
            comment: fullComment
        });
    } catch (error) {
        console.error('[Investor] 添加评论错误:', error);
        res.status(500).json({ error: '添加评论失败' });
    }
});

// ==================== 文档预览/下载功能 ====================

// 预览文档（需要有权限）
router.get('/documents/:id/preview', authenticate, requireInvestor, async (req, res) => {
    try {
        // 检查投资人状态
        const profile = await InvestorProfile.findOne({ where: { user_id: req.user.id } });
        if (!profile || profile.status !== 'approved') {
            return res.status(403).json({ error: '您的投资人账户尚未通过审核' });
        }

        const document = await Document.findByPk(req.params.id);
        if (!document) {
            return res.status(404).json({ error: '文档不存在' });
        }

        // 检查对企业的访问权限
        const { hasAccess, permissionType } = await checkInvestorAccess(req.user.id, document.company_id);
        
        // 如果是公开文档或有授权权限
        if (!document.is_public && (!hasAccess || permissionType === 'public')) {
            // 检查是否有访问请求被批准
            const accessRequest = await AccessRequest.findOne({
                where: {
                    investor_id: req.user.id,
                    company_id: document.company_id,
                    status: 'approved'
                }
            });
            
            if (!accessRequest) {
                return res.status(403).json({ error: '您没有权限查看该文档' });
            }
        }

        if (!document.content) {
            return res.status(404).json({ error: '文档内容不存在' });
        }

        // 解码 base64 文件内容
        const fileBuffer = Buffer.from(document.content, 'base64');

        res.setHeader('Content-Type', document.mimetype || 'application/octet-stream');
        res.setHeader('Content-Disposition', 'inline');
        res.setHeader('Content-Length', fileBuffer.length);
        res.send(fileBuffer);

        console.log(`[Investor] 用户 ${req.user.email} 预览文档 ${document.original_name}`);
    } catch (error) {
        console.error('[Investor] 预览文档错误:', error);
        res.status(500).json({ error: '预览失败' });
    }
});

// 下载文档（需要有权限）
router.get('/documents/:id/download', authenticate, requireInvestor, async (req, res) => {
    try {
        // 检查投资人状态
        const profile = await InvestorProfile.findOne({ where: { user_id: req.user.id } });
        if (!profile || profile.status !== 'approved') {
            return res.status(403).json({ error: '您的投资人账户尚未通过审核' });
        }

        const document = await Document.findByPk(req.params.id);
        if (!document) {
            return res.status(404).json({ error: '文档不存在' });
        }

        // 检查对企业的访问权限
        const { hasAccess, permissionType } = await checkInvestorAccess(req.user.id, document.company_id);
        
        // 如果是公开文档或有授权权限
        if (!document.is_public && (!hasAccess || permissionType === 'public')) {
            // 检查是否有访问请求被批准
            const accessRequest = await AccessRequest.findOne({
                where: {
                    investor_id: req.user.id,
                    company_id: document.company_id,
                    status: 'approved'
                }
            });
            
            if (!accessRequest) {
                return res.status(403).json({ error: '您没有权限下载该文档' });
            }
        }

        if (!document.content) {
            return res.status(404).json({ error: '文档内容不存在' });
        }

        // 解码 base64 文件内容
        const fileBuffer = Buffer.from(document.content, 'base64');

        res.setHeader('Content-Type', document.mimetype || 'application/octet-stream');
        res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(document.original_name)}"`);
        res.setHeader('Content-Length', fileBuffer.length);
        res.send(fileBuffer);

        console.log(`[Investor] 用户 ${req.user.email} 下载文档 ${document.original_name}`);
    } catch (error) {
        console.error('[Investor] 下载文档错误:', error);
        res.status(500).json({ error: '下载失败' });
    }
});

// ==================== 表达兴趣功能 ====================

// 表达兴趣
router.post('/projects/:id/interest', authenticate, requireInvestor, async (req, res) => {
    try {
        const { interest_type = 'general', message } = req.body;

        // 检查投资人状态
        const profile = await InvestorProfile.findOne({ where: { user_id: req.user.id } });
        if (!profile || profile.status !== 'approved') {
            return res.status(403).json({ error: '您的投资人账户尚未通过审核' });
        }

        const company = await Company.findByPk(req.params.id, {
            include: [{ model: User, as: 'user', attributes: ['id', 'email', 'name'] }]
        });
        if (!company) {
            return res.status(404).json({ error: '企业不存在' });
        }

        // 检查是否已经表达过兴趣
        let interest = await InterestExpression.findOne({
            where: {
                company_id: req.params.id,
                investor_id: req.user.id
            }
        });

        if (interest) {
            // 更新兴趣
            await interest.update({
                interest_type,
                message: message || interest.message,
                status: 'active'
            });
        } else {
            // 创建新的兴趣表达
            interest = await InterestExpression.create({
                company_id: req.params.id,
                investor_id: req.user.id,
                interest_type,
                message
            });
        }

        const companyName = company.name_cn || company.name_en;
        console.log(`[Investor] 用户 ${req.user.email} 对企业 ${companyName} 表达兴趣`);

        // 发送邮件通知公司和管理员
        try {
            if (emailService.isConfigured()) {
                const recipients = [];
                
                // 通知公司
                if (company.user?.email) {
                    recipients.push(company.user.email);
                }

                // 通知所有管理员
                const admins = await User.findAll({
                    where: { role: 'admin', status: 'active' },
                    attributes: ['email']
                });
                recipients.push(...admins.map(a => a.email));

                if (recipients.length > 0) {
                    const investorName = profile.name || req.user.email;
                    const interestTypeText = {
                        general: '一般关注',
                        high: '高度关注',
                        watching: '持续关注'
                    }[interest_type] || '关注';

                    const html = emailService.generateTemplate({
                        title: '新的投资人兴趣表达',
                        content: `<p>投资人 <strong>${investorName}</strong> 对企业 <strong>${companyName}</strong> 表达了兴趣。</p>
                            <table style="width: 100%; margin: 20px 0; border-collapse: collapse;">
                                <tr>
                                    <td style="padding: 12px; background: #F9FAFB; border: 1px solid #E5E7EB; font-weight: 500; width: 120px;">兴趣级别</td>
                                    <td style="padding: 12px; border: 1px solid #E5E7EB;">${interestTypeText}</td>
                                </tr>
                                <tr>
                                    <td style="padding: 12px; background: #F9FAFB; border: 1px solid #E5E7EB; font-weight: 500;">投资人</td>
                                    <td style="padding: 12px; border: 1px solid #E5E7EB;">${investorName} (${profile.organization || '-'})</td>
                                </tr>
                                ${message ? `<tr><td style="padding: 12px; background: #F9FAFB; border: 1px solid #E5E7EB; font-weight: 500;">留言</td><td style="padding: 12px; border: 1px solid #E5E7EB;">${message}</td></tr>` : ''}
                            </table>`,
                        actionUrl: `${process.env.SITE_URL || 'https://eonprotocol.ai'}/admin/fundraising.html#companies`,
                        actionText: '查看详情'
                    });

                    await emailService.sendEmail({
                        to: [...new Set(recipients)],
                        subject: `[EON Protocol] 新投资人兴趣 - ${investorName} → ${companyName}`,
                        html
                    });
                }
            }
        } catch (emailError) {
            console.error('[Investor] 发送兴趣通知邮件失败:', emailError);
        }

        res.json({
            message: '已成功表达兴趣',
            interest
        });
    } catch (error) {
        console.error('[Investor] 表达兴趣错误:', error);
        res.status(500).json({ error: '表达兴趣失败' });
    }
});

// 撤回兴趣
router.delete('/projects/:id/interest', authenticate, requireInvestor, async (req, res) => {
    try {
        const interest = await InterestExpression.findOne({
            where: {
                company_id: req.params.id,
                investor_id: req.user.id
            }
        });

        if (!interest) {
            return res.status(404).json({ error: '未找到兴趣表达记录' });
        }

        await interest.update({ status: 'withdrawn' });

        res.json({ message: '已撤回兴趣表达' });
    } catch (error) {
        console.error('[Investor] 撤回兴趣错误:', error);
        res.status(500).json({ error: '撤回失败' });
    }
});

// 获取我表达过兴趣的企业列表
router.get('/my-interests', authenticate, requireInvestor, async (req, res) => {
    try {
        const profile = await InvestorProfile.findOne({ where: { user_id: req.user.id } });
        if (!profile || profile.status !== 'approved') {
            return res.status(403).json({ error: '您的投资人账户尚未通过审核' });
        }

        const interests = await InterestExpression.findAll({
            where: {
                investor_id: req.user.id,
                status: 'active'
            },
            include: [{
                model: Company,
                as: 'company',
                attributes: ['id', 'name_cn', 'name_en', 'industry_primary', 'stage', 'deal_status', 'description']
            }],
            order: [['created_at', 'DESC']]
        });

        res.json({ interests });
    } catch (error) {
        console.error('[Investor] 获取兴趣列表错误:', error);
        res.status(500).json({ error: '获取列表失败' });
    }
});

// 获取我的资料库访问权限列表
router.get('/my-dataroom-access', authenticate, requireInvestor, async (req, res) => {
    try {
        const profile = await InvestorProfile.findOne({ where: { user_id: req.user.id } });
        if (!profile || profile.status !== 'approved') {
            return res.status(403).json({ error: '您的投资人账户尚未通过审核' });
        }

        const accessList = await DataRoomAccess.findAll({
            where: {
                user_id: req.user.id,
                status: 'active',
                [Op.or]: [
                    { expires_at: null },
                    { expires_at: { [Op.gt]: new Date() } }
                ]
            },
            include: [{
                model: Company,
                as: 'company',
                attributes: ['id', 'name_cn', 'name_en', 'industry_primary', 'stage', 'deal_status']
            }],
            order: [['created_at', 'DESC']]
        });

        res.json({ accessList });
    } catch (error) {
        console.error('[Investor] 获取资料库访问权限错误:', error);
        res.status(500).json({ error: '获取列表失败' });
    }
});

module.exports = router;
