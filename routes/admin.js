const express = require('express');
const router = express.Router();
const { Op } = require('sequelize');
const multer = require('multer');
const bcrypt = require('bcryptjs');
const { User, Company, FundraisingInfo, Document, InvestorProfile, AccessRequest, Message, CompanyComment, CompanyPermission, InterestExpression, DataRoomAccess, DataRoomFolder, DataRoomFile } = require('../models');
const { authenticate, requireAdmin } = require('../middleware/auth');
const emailService = require('../services/EmailService');

// 配置文件上传 - 内存存储用于附件
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB
});

// 仪表盘统计
router.get('/stats', authenticate, requireAdmin, async (req, res) => {
    try {
        const [
            totalCompanies,
            pendingCompanies,
            approvedCompanies,
            totalInvestors,
            pendingInvestors,
            approvedInvestors,
            pendingRequests,
            totalRequests
        ] = await Promise.all([
            Company.count(),
            Company.count({ where: { status: 'pending' } }),
            Company.count({ where: { status: 'approved' } }),
            InvestorProfile.count(),
            InvestorProfile.count({ where: { status: 'pending' } }),
            InvestorProfile.count({ where: { status: 'approved' } }),
            AccessRequest.count({ where: { status: 'pending' } }),
            AccessRequest.count()
        ]);

        res.json({
            companies: {
                total: totalCompanies,
                pending: pendingCompanies,
                approved: approvedCompanies
            },
            investors: {
                total: totalInvestors,
                pending: pendingInvestors,
                approved: approvedInvestors
            },
            requests: {
                total: totalRequests,
                pending: pendingRequests
            }
        });
    } catch (error) {
        console.error('[Admin] 获取统计数据错误:', error);
        res.status(500).json({ error: '获取统计数据失败' });
    }
});

// 企业列表
router.get('/companies', authenticate, requireAdmin, async (req, res) => {
    try {
        const { status, industry, stage, page = 1, limit = 20 } = req.query;

        const where = {};
        if (status) where.status = status;
        if (industry) {
            where[Op.or] = [
                { industry_primary: industry },
                { industry_secondary: industry }
            ];
        }
        if (stage) where.stage = stage;

        const { count, rows: companies } = await Company.findAndCountAll({
            where,
            include: [
                { model: User, as: 'user', attributes: ['email'] },
                { model: FundraisingInfo, as: 'fundraisingInfo' },
                { model: Document, as: 'documents', attributes: ['id', 'type', 'filename', 'filesize', 'mimetype', 'dataroom_link'] }
            ],
            order: [['created_at', 'DESC']],
            limit: parseInt(limit),
            offset: (parseInt(page) - 1) * parseInt(limit)
        });

        res.json({
            companies,
            pagination: {
                total: count,
                page: parseInt(page),
                limit: parseInt(limit),
                pages: Math.ceil(count / parseInt(limit))
            }
        });
    } catch (error) {
        console.error('[Admin] 获取企业列表错误:', error);
        res.status(500).json({ error: '获取企业列表失败' });
    }
});

// 获取企业详情
router.get('/companies/:id', authenticate, requireAdmin, async (req, res) => {
    try {
        const company = await Company.findByPk(req.params.id, {
            include: [
                { model: User, as: 'user', attributes: ['id', 'email', 'name', 'created_at'] },
                { 
                    model: User, 
                    as: 'contactPerson', 
                    required: false,
                    attributes: ['id', 'email', 'name', 'role'],
                    foreignKey: 'contact_person_id'
                },
                { model: FundraisingInfo, as: 'fundraisingInfo' },
                { model: Document, as: 'documents' },
                { 
                    model: AccessRequest, 
                    as: 'accessRequests',
                    include: [{ model: User, as: 'investor', attributes: ['email', 'name'] }]
                }
            ]
        });

        if (!company) {
            return res.status(404).json({ error: '企业不存在' });
        }

        res.json({ company });
    } catch (error) {
        console.error('[Admin] 获取企业详情错误:', error);
        res.status(500).json({ error: '获取企业详情失败' });
    }
});

// 审核企业
router.put('/companies/:id/review', authenticate, requireAdmin, async (req, res) => {
    try {
        const { status, visibility, admin_notes, admin_feedback, tags, deal_status, sg_ready, data_room_enabled, send_email = false } = req.body;

        const company = await Company.findByPk(req.params.id, {
            include: [{ model: User, as: 'user', attributes: ['id', 'email', 'name'] }]
        });
        if (!company) {
            return res.status(404).json({ error: '企业不存在' });
        }

        const oldStatus = company.status;
        const updateData = {
            reviewed_at: new Date(),
            reviewed_by: req.user.id
        };

        if (status) updateData.status = status;
        if (visibility) updateData.visibility = visibility;
        if (admin_notes !== undefined) updateData.admin_notes = admin_notes;
        if (admin_feedback !== undefined) updateData.admin_feedback = admin_feedback;
        if (tags) updateData.tags = tags;
        if (deal_status) updateData.deal_status = deal_status;
        if (sg_ready) updateData.sg_ready = sg_ready;
        if (data_room_enabled !== undefined) updateData.data_room_enabled = data_room_enabled;

        await company.update(updateData);

        const companyName = company.name_en || company.name_cn;

        // 如果状态发生变化，发送邮件通知给所有相关人员
        let emailSent = false;
        if (status && status !== oldStatus && emailService.isConfigured()) {
            try {
                const recipients = [];
                
                // 1. 通知公司（如果是外部可见的状态变更）
                if (company.user?.email) {
                    recipients.push(company.user.email);
                }

                // 2. 通知所有管理员（排除自己）
                const admins = await User.findAll({
                    where: { role: 'admin', status: 'active', id: { [Op.ne]: req.user.id } },
                    attributes: ['email']
                });
                recipients.push(...admins.map(a => a.email));

                // 3. 获取有权限的 staff
                const permissions = await CompanyPermission.findAll({
                    where: { company_id: req.params.id, is_active: true },
                    include: [{ 
                        model: User, 
                        as: 'permittedUser', 
                        where: { role: 'staff', status: 'active', id: { [Op.ne]: req.user.id } },
                        attributes: ['email']
                    }]
                });
                permissions.forEach(p => {
                    if (p.permittedUser?.email) recipients.push(p.permittedUser.email);
                });

                // 4. 如果是 staff 创建的企业，通知该 staff
                if (company.created_by && company.created_by !== req.user.id) {
                    const creator = await User.findByPk(company.created_by, { attributes: ['email'] });
                    if (creator?.email) recipients.push(creator.email);
                }

                // 去重后发送
                const uniqueRecipients = [...new Set(recipients)];

                if (uniqueRecipients.length > 0) {
                    // 对于新的三级状态使用 Verdict 通知
                    if (['engage', 'explore', 'pass'].includes(status)) {
                        await emailService.sendVerdictNotification({
                            to: uniqueRecipients,
                            companyName,
                            verdict: status,
                            reviewerName: req.user.name || req.user.email,
                            adminNotes: admin_notes
                        });
                    } else {
                        // 旧的 approved/rejected 状态
                        await emailService.sendVerdictNotification({
                            to: uniqueRecipients,
                            companyName,
                            verdict: status,
                            reviewerName: req.user.name || req.user.email,
                            adminNotes: admin_feedback || admin_notes
                        });
                    }
                    emailSent = true;
                    console.log(`[Admin] 已发送审核结果(${status})通知邮件给 ${uniqueRecipients.length} 人`);
                }
            } catch (emailError) {
                console.error('[Admin] 发送审核通知邮件失败:', emailError);
            }
        }

        res.json({ 
            message: '企业信息已更新',
            company,
            email_sent: emailSent
        });
    } catch (error) {
        console.error('[Admin] 审核企业错误:', error);
        res.status(500).json({ error: '审核失败' });
    }
});

// 投资人列表
router.get('/investors', authenticate, requireAdmin, async (req, res) => {
    try {
        const { status, investor_type, page = 1, limit = 20 } = req.query;

        const where = {};
        if (status) where.status = status;
        if (investor_type) where.investor_type = investor_type;

        const { count, rows: investors } = await InvestorProfile.findAndCountAll({
            where,
            include: [
                { model: User, as: 'user', attributes: ['email', 'created_at'] }
            ],
            order: [['created_at', 'DESC']],
            limit: parseInt(limit),
            offset: (parseInt(page) - 1) * parseInt(limit)
        });

        res.json({
            investors,
            pagination: {
                total: count,
                page: parseInt(page),
                limit: parseInt(limit),
                pages: Math.ceil(count / parseInt(limit))
            }
        });
    } catch (error) {
        console.error('[Admin] 获取投资人列表错误:', error);
        res.status(500).json({ error: '获取投资人列表失败' });
    }
});

// 审核投资人
router.put('/investors/:id/review', authenticate, requireAdmin, async (req, res) => {
    try {
        const { status, admin_notes, send_email = false } = req.body;

        const profile = await InvestorProfile.findByPk(req.params.id, {
            include: [{ model: User, as: 'user', attributes: ['id', 'email', 'name'] }]
        });
        if (!profile) {
            return res.status(404).json({ error: '投资人不存在' });
        }

        const oldStatus = profile.status;
        const updateData = {
            reviewed_at: new Date(),
            reviewed_by: req.user.id
        };

        if (status) updateData.status = status;
        if (admin_notes !== undefined) updateData.admin_notes = admin_notes;

        await profile.update(updateData);

        // 同时更新用户状态
        if (status === 'approved') {
            await User.update(
                { status: 'active' },
                { where: { id: profile.user_id } }
            );
        }

        // 如果状态发生变化，发送邮件通知
        let emailSent = false;
        if (status && status !== oldStatus && profile.user?.email) {
            const shouldSendEmail = send_email === true || send_email === 'true' || 
                                   (status === 'approved' || status === 'rejected');
            if (shouldSendEmail) {
                const result = await emailService.sendReviewNotification({
                    to: profile.user.email,
                    entityType: 'investor',
                    entityName: profile.name || profile.user.name,
                    status,
                    feedback: admin_notes
                });
                emailSent = result.success;
                if (result.success) {
                    console.log(`[Admin] 已发送投资人审核通知邮件: ${profile.user.email}`);
                }
            }
        }

        res.json({ 
            message: '投资人信息已更新',
            profile,
            email_sent: emailSent
        });
    } catch (error) {
        console.error('[Admin] 审核投资人错误:', error);
        res.status(500).json({ error: '审核失败' });
    }
});

// 访问请求列表
router.get('/requests', authenticate, requireAdmin, async (req, res) => {
    try {
        const { status, request_type, page = 1, limit = 20 } = req.query;

        const where = {};
        if (status) where.status = status;
        if (request_type) where.request_type = request_type;

        const { count, rows: requests } = await AccessRequest.findAndCountAll({
            where,
            include: [
                { model: User, as: 'investor', attributes: ['email', 'name'] },
                { model: Company, as: 'company', attributes: ['id', 'name_cn', 'name_en'] }
            ],
            order: [['created_at', 'DESC']],
            limit: parseInt(limit),
            offset: (parseInt(page) - 1) * parseInt(limit)
        });

        res.json({
            requests,
            pagination: {
                total: count,
                page: parseInt(page),
                limit: parseInt(limit),
                pages: Math.ceil(count / parseInt(limit))
            }
        });
    } catch (error) {
        console.error('[Admin] 获取请求列表错误:', error);
        res.status(500).json({ error: '获取请求列表失败' });
    }
});

// 处理访问请求
router.put('/requests/:id', authenticate, requireAdmin, async (req, res) => {
    try {
        const { status, admin_response, expires_days } = req.body;

        const request = await AccessRequest.findByPk(req.params.id, {
            include: [
                { model: User, as: 'investor', attributes: ['id', 'email', 'name'] },
                { model: Company, as: 'company', attributes: ['id', 'name_cn', 'name_en'] }
            ]
        });
        if (!request) {
            return res.status(404).json({ error: '请求不存在' });
        }

        const updateData = {
            processed_at: new Date(),
            processed_by: req.user.id
        };

        if (status) updateData.status = status;
        if (admin_response !== undefined) updateData.admin_response = admin_response;
        
        // 设置过期时间
        if (status === 'approved' && expires_days) {
            const expiresAt = new Date();
            expiresAt.setDate(expiresAt.getDate() + parseInt(expires_days));
            updateData.expires_at = expiresAt;
        }

        await request.update(updateData);

        // 发送邮件通知投资人
        let emailSent = false;
        if ((status === 'approved' || status === 'rejected') && request.investor?.email) {
            const result = await emailService.sendAccessRequestNotification({
                to: request.investor.email,
                companyName: request.company?.name_en || request.company?.name_cn || 'Unknown Company',
                requestType: request.request_type,
                status,
                adminResponse: admin_response
            });
            emailSent = result.success;
            if (result.success) {
                console.log(`[Admin] 已发送访问请求处理通知邮件: ${request.investor.email}`);
            }
        }

        res.json({ 
            message: '请求已处理',
            request,
            email_sent: emailSent
        });
    } catch (error) {
        console.error('[Admin] 处理请求错误:', error);
        res.status(500).json({ error: '处理请求失败' });
    }
});

// 用户管理
router.get('/users', authenticate, requireAdmin, async (req, res) => {
    try {
        const { role, status, page = 1, limit = 20 } = req.query;

        const where = {};
        if (role) where.role = role;
        if (status) where.status = status;

        const { count, rows: users } = await User.findAndCountAll({
            where,
            attributes: { exclude: ['password'] },
            order: [['created_at', 'DESC']],
            limit: parseInt(limit),
            offset: (parseInt(page) - 1) * parseInt(limit)
        });

        res.json({
            users,
            pagination: {
                total: count,
                page: parseInt(page),
                limit: parseInt(limit),
                pages: Math.ceil(count / parseInt(limit))
            }
        });
    } catch (error) {
        console.error('[Admin] 获取用户列表错误:', error);
        res.status(500).json({ error: '获取用户列表失败' });
    }
});

// 更新用户状态
router.put('/users/:id', authenticate, requireAdmin, async (req, res) => {
    try {
        const { status, role } = req.body;

        const user = await User.findByPk(req.params.id);
        if (!user) {
            return res.status(404).json({ error: '用户不存在' });
        }

        const updateData = {};
        if (status) updateData.status = status;
        if (role) updateData.role = role;

        await user.update(updateData);

        res.json({ 
            message: '用户信息已更新',
            user: user.toSafeObject()
        });
    } catch (error) {
        console.error('[Admin] 更新用户错误:', error);
        res.status(500).json({ error: '更新用户失败' });
    }
});

// ============ 新增管理员功能 ============

// 修改自己的密码
router.put('/change-password', authenticate, requireAdmin, async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;

        if (!currentPassword || !newPassword) {
            return res.status(400).json({ error: '请提供当前密码和新密码' });
        }

        if (newPassword.length < 6) {
            return res.status(400).json({ error: '新密码长度至少6位' });
        }

        const admin = await User.findByPk(req.user.id);
        
        // 验证当前密码
        const isValid = await admin.validatePassword(currentPassword);
        if (!isValid) {
            return res.status(400).json({ error: '当前密码不正确' });
        }

        // 更新密码（bcrypt hook 会自动加密）
        admin.password = newPassword;
        await admin.save();

        res.json({ message: '密码修改成功' });
    } catch (error) {
        console.error('[Admin] 修改密码错误:', error);
        res.status(500).json({ error: '修改密码失败' });
    }
});

// 创建新用户（管理员/企业/投资人）
router.post('/users', authenticate, requireAdmin, async (req, res) => {
    try {
        const { email, password, role, name, phone, wechat, whatsapp } = req.body;

        // 验证必填字段
        if (!email || !password || !role) {
            return res.status(400).json({ error: '请提供邮箱、密码和角色' });
        }

        // 验证角色
        if (!['admin', 'staff', 'company', 'investor'].includes(role)) {
            return res.status(400).json({ error: '无效的角色类型' });
        }

        // 检查邮箱是否已存在
        const existingUser = await User.findOne({ where: { email } });
        if (existingUser) {
            return res.status(400).json({ error: '该邮箱已被注册' });
        }

        // 创建用户
        const user = await User.create({
            email,
            password,
            role,
            name: name || '',
            phone: phone || null,
            wechat: wechat || null,
            whatsapp: whatsapp || null,
            status: 'active' // 管理员创建的用户直接激活
        });

        console.log(`[Admin] 管理员 ${req.user.email} 创建了用户: ${email} (${role})`);

        res.status(201).json({
            message: '用户创建成功',
            user: user.toSafeObject()
        });
    } catch (error) {
        console.error('[Admin] 创建用户错误:', error);
        res.status(500).json({ error: '创建用户失败' });
    }
});

// 删除用户
router.delete('/users/:id', authenticate, requireAdmin, async (req, res) => {
    try {
        const user = await User.findByPk(req.params.id);
        if (!user) {
            return res.status(404).json({ error: '用户不存在' });
        }

        // 不能删除自己
        if (user.id === req.user.id) {
            return res.status(400).json({ error: '不能删除自己的账户' });
        }

        const email = user.email;
        await user.destroy();

        console.log(`[Admin] 管理员 ${req.user.email} 删除了用户: ${email}`);

        res.json({ message: '用户已删除' });
    } catch (error) {
        console.error('[Admin] 删除用户错误:', error);
        res.status(500).json({ error: '删除用户失败' });
    }
});

// 重置用户密码
router.put('/users/:id/reset-password', authenticate, requireAdmin, async (req, res) => {
    try {
        const { newPassword } = req.body;

        if (!newPassword || newPassword.length < 6) {
            return res.status(400).json({ error: '请提供至少6位的新密码' });
        }

        const user = await User.findByPk(req.params.id);
        if (!user) {
            return res.status(404).json({ error: '用户不存在' });
        }

        user.password = newPassword;
        await user.save();

        console.log(`[Admin] 管理员 ${req.user.email} 重置了用户 ${user.email} 的密码`);

        res.json({ message: '密码重置成功' });
    } catch (error) {
        console.error('[Admin] 重置密码错误:', error);
        res.status(500).json({ error: '重置密码失败' });
    }
});

// 发送消息给企业或投资人（支持附件和可选邮件）
router.post('/messages', authenticate, requireAdmin, upload.array('attachments', 5), async (req, res) => {
    try {
        const { 
            recipient_id, 
            company_id, 
            subject, 
            content, 
            type = 'general',
            send_email = false,
            change_status = null // { entity_type: 'company'|'investor', new_status: 'approved'|'rejected'|etc }
        } = req.body;

        if (!recipient_id || !subject || !content) {
            return res.status(400).json({ error: '请提供收件人、主题和内容' });
        }

        // 获取收件人信息
        const recipient = await User.findByPk(recipient_id);
        if (!recipient) {
            return res.status(404).json({ error: '收件人不存在' });
        }

        // 处理附件
        const attachments = [];
        if (req.files && req.files.length > 0) {
            for (const file of req.files) {
                attachments.push({
                    filename: file.originalname,
                    mimetype: file.mimetype,
                    size: file.size,
                    content: file.buffer.toString('base64')
                });
            }
        }

        // 处理状态变更
        let statusChange = null;
        if (change_status) {
            const parsed = typeof change_status === 'string' ? JSON.parse(change_status) : change_status;
            const { entity_type, new_status } = parsed;
            
            if (entity_type === 'company' && company_id) {
                const company = await Company.findByPk(company_id);
                if (company) {
                    const oldStatus = company.status;
                    await company.update({ 
                        status: new_status,
                        reviewed_at: new Date(),
                        reviewed_by: req.user.id
                    });
                    statusChange = { from: oldStatus, to: new_status, entity_type: 'company' };
                }
            } else if (entity_type === 'investor') {
                const profile = await InvestorProfile.findOne({ where: { user_id: recipient_id } });
                if (profile) {
                    const oldStatus = profile.status;
                    await profile.update({
                        status: new_status,
                        reviewed_at: new Date(),
                        reviewed_by: req.user.id
                    });
                    statusChange = { from: oldStatus, to: new_status, entity_type: 'investor' };
                    
                    // 同步更新用户状态
                    if (new_status === 'approved') {
                        await User.update({ status: 'active' }, { where: { id: recipient_id } });
                    }
                }
            }
        }

        // 创建消息
        const message = await Message.create({
            sender_id: req.user.id,
            recipient_id,
            company_id: company_id || null,
            type,
            subject,
            content,
            attachments,
            status_change: statusChange
        });

        // Send email notification
        let emailSent = false;
        if (send_email === 'true' || send_email === true) {
            if (emailService.isConfigured()) {
                try {
                    const statusChangeText = statusChange 
                        ? `Your status has been updated to: ${statusChange.to}` 
                        : null;

                    const recipients = [];
                    let companyName = null;
                    
                    // Always notify the recipient
                    recipients.push(recipient.email);
                    
                    // If message is for a company, also notify authorized users
                    if (company_id) {
                        const company = await Company.findByPk(company_id, {
                            include: [{ model: User, as: 'user', attributes: ['email'] }]
                        });
                        
                        if (company) {
                            companyName = company.name_en || company.name_cn || 'Company';
                            
                            // Get all admins (excluding the sender)
                            const admins = await User.findAll({
                                where: { role: 'admin', status: 'active', id: { [Op.ne]: req.user.id } },
                                attributes: ['email']
                            });
                            admins.forEach(a => {
                                if (!recipients.includes(a.email)) {
                                    recipients.push(a.email);
                                }
                            });
                            
                            // Get staff with permissions for this company
                            const permissions = await CompanyPermission.findAll({
                                where: { 
                                    company_id: company.id, 
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
                                        id: { [Op.ne]: req.user.id }
                                    },
                                    attributes: ['email']
                                }]
                            });
                            permissions.forEach(p => {
                                if (p.permittedUser?.email && !recipients.includes(p.permittedUser.email)) {
                                    recipients.push(p.permittedUser.email);
                                }
                            });
                            
                            // Also include company creator if different from sender
                            if (company.created_by && company.created_by !== req.user.id) {
                                const creator = await User.findByPk(company.created_by, {
                                    attributes: ['email', 'role'],
                                    where: { status: 'active' }
                                });
                                if (creator && creator.role === 'staff' && !recipients.includes(creator.email)) {
                                    recipients.push(creator.email);
                                }
                            }
                        }
                    }
                    
                    // Send to all recipients
                    const result = await emailService.sendFeedbackNotification({
                        to: [...new Set(recipients)],
                        companyName: companyName || 'Company',
                        senderName: req.user.name || req.user.email,
                        senderRole: req.user.role,
                        content: content.replace(/\n/g, '<br>')
                    });

                    if (result.success) {
                        emailSent = true;
                        await message.update({ email_sent: true, email_sent_at: new Date() });
                        console.log(`[Admin] Message notification sent to ${recipients.length} recipients`);
                    } else {
                        console.error('[Admin] Email send failed:', result.error);
                    }
                } catch (emailError) {
                    console.error('[Admin] Email send failed:', emailError);
                }
            } else {
                console.log('[Admin] Email service not configured, skipping');
            }
        }

        console.log(`[Admin] Admin ${req.user.email} sent message to ${recipient.email}`);

        res.status(201).json({
            message: '消息发送成功',
            data: {
                id: message.id,
                email_sent: emailSent,
                status_change: statusChange
            }
        });
    } catch (error) {
        console.error('[Admin] 发送消息错误:', error);
        res.status(500).json({ error: '发送消息失败' });
    }
});

// 获取已发送的消息列表
router.get('/messages/sent', authenticate, requireAdmin, async (req, res) => {
    try {
        const { page = 1, limit = 20 } = req.query;

        const { count, rows: messages } = await Message.findAndCountAll({
            where: { sender_id: req.user.id },
            include: [
                { model: User, as: 'recipient', attributes: ['id', 'email', 'name', 'role'] },
                { model: Company, as: 'company', attributes: ['id', 'name_cn', 'name_en'] }
            ],
            order: [['created_at', 'DESC']],
            limit: parseInt(limit),
            offset: (parseInt(page) - 1) * parseInt(limit)
        });

        res.json({
            messages,
            pagination: {
                total: count,
                page: parseInt(page),
                limit: parseInt(limit),
                pages: Math.ceil(count / parseInt(limit))
            }
        });
    } catch (error) {
        console.error('[Admin] 获取消息列表错误:', error);
        res.status(500).json({ error: '获取消息列表失败' });
    }
});

// 获取所有消息（管理员查看所有）
router.get('/messages', authenticate, requireAdmin, async (req, res) => {
    try {
        const { page = 1, limit = 20, recipient_id, company_id } = req.query;

        const where = {};
        if (recipient_id) where.recipient_id = recipient_id;
        if (company_id) where.company_id = company_id;

        const { count, rows: messages } = await Message.findAndCountAll({
            where,
            include: [
                { model: User, as: 'sender', attributes: ['id', 'email', 'name'] },
                { model: User, as: 'recipient', attributes: ['id', 'email', 'name', 'role'] },
                { model: Company, as: 'company', attributes: ['id', 'name_cn', 'name_en'] }
            ],
            order: [['created_at', 'DESC']],
            limit: parseInt(limit),
            offset: (parseInt(page) - 1) * parseInt(limit)
        });

        res.json({
            messages,
            pagination: {
                total: count,
                page: parseInt(page),
                limit: parseInt(limit),
                pages: Math.ceil(count / parseInt(limit))
            }
        });
    } catch (error) {
        console.error('[Admin] 获取消息列表错误:', error);
        res.status(500).json({ error: '获取消息列表失败' });
    }
});

// 获取消息详情
router.get('/messages/:id', authenticate, requireAdmin, async (req, res) => {
    try {
        const message = await Message.findByPk(req.params.id, {
            include: [
                { model: User, as: 'sender', attributes: ['id', 'email', 'name'] },
                { model: User, as: 'recipient', attributes: ['id', 'email', 'name', 'role'] },
                { model: Company, as: 'company', attributes: ['id', 'name_cn', 'name_en'] }
            ]
        });

        if (!message) {
            return res.status(404).json({ error: '消息不存在' });
        }

        res.json({ message });
    } catch (error) {
        console.error('[Admin] 获取消息详情错误:', error);
        res.status(500).json({ error: '获取消息详情失败' });
    }
});

// 下载消息附件
router.get('/messages/:id/attachments/:index', authenticate, requireAdmin, async (req, res) => {
    try {
        const message = await Message.findByPk(req.params.id);
        if (!message) {
            return res.status(404).json({ error: '消息不存在' });
        }

        const index = parseInt(req.params.index);
        if (!message.attachments || index < 0 || index >= message.attachments.length) {
            return res.status(404).json({ error: '附件不存在' });
        }

        const attachment = message.attachments[index];
        const buffer = Buffer.from(attachment.content, 'base64');

        res.setHeader('Content-Type', attachment.mimetype || 'application/octet-stream');
        res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(attachment.filename)}`);
        res.setHeader('Content-Length', buffer.length);

        res.send(buffer);
    } catch (error) {
        console.error('[Admin] 下载附件错误:', error);
        res.status(500).json({ error: '下载附件失败' });
    }
});

// 获取邮件配置状态
router.get('/email-status', authenticate, requireAdmin, async (req, res) => {
    const status = emailService.getStatus();
    res.json(status);
});

// ============ 文档管理 ============

// 获取企业文档列表
router.get('/companies/:id/documents', authenticate, requireAdmin, async (req, res) => {
    try {
        const documents = await Document.findAll({
            where: { company_id: req.params.id },
            attributes: ['id', 'type', 'filename', 'filesize', 'mimetype', 'description', 'created_at', 'download_count'],
            order: [['created_at', 'DESC']]
        });

        res.json({ documents });
    } catch (error) {
        console.error('[Admin] 获取文档列表错误:', error);
        res.status(500).json({ error: '获取文档列表失败' });
    }
});

// 下载企业文档（管理员）
router.get('/documents/:id/download', authenticate, requireAdmin, async (req, res) => {
    try {
        const document = await Document.findByPk(req.params.id);
        
        if (!document) {
            return res.status(404).json({ error: '文档不存在' });
        }

        // 如果是外部链接，返回链接信息让前端重定向
        if (document.dataroom_link && !document.file_content) {
            return res.json({ 
                redirect: true, 
                url: document.dataroom_link,
                filename: document.filename 
            });
        }

        if (!document.file_content) {
            return res.status(404).json({ error: '文件内容不存在' });
        }

        // 更新下载计数
        await document.increment('download_count');

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
        console.error('[Admin] 下载文档错误:', error);
        res.status(500).json({ error: '下载失败' });
    }
});

// 预览企业文档（管理员）- 直接在浏览器中显示
router.get('/documents/:id/preview', authenticate, requireAdmin, async (req, res) => {
    try {
        const document = await Document.findByPk(req.params.id);
        
        if (!document) {
            return res.status(404).json({ error: '文档不存在' });
        }

        // 如果是外部链接，返回链接信息让前端重定向
        if (document.dataroom_link && !document.file_content) {
            return res.json({ 
                redirect: true, 
                url: document.dataroom_link,
                filename: document.filename 
            });
        }

        if (!document.file_content) {
            return res.status(404).json({ error: '文件内容不存在' });
        }

        // 将 Base64 内容转换回 Buffer
        const fileBuffer = Buffer.from(document.file_content, 'base64');

        // 设置响应头 - inline 显示而不是下载
        res.setHeader('Content-Type', document.mimetype || 'application/octet-stream');
        res.setHeader('Content-Disposition', 'inline');
        res.setHeader('Content-Length', fileBuffer.length);

        res.send(fileBuffer);
    } catch (error) {
        console.error('[Admin] 预览文档错误:', error);
        res.status(500).json({ error: '预览失败' });
    }
});

// ============ 企业反馈/评论功能 ============

// 获取企业的所有反馈评论（包括内部评论）
router.get('/companies/:id/comments', authenticate, requireAdmin, async (req, res) => {
    try {
        const company = await Company.findByPk(req.params.id);
        if (!company) {
            return res.status(404).json({ error: '企业不存在' });
        }

        // 获取所有评论（管理员可以看到所有，包括内部评论）
        const comments = await CompanyComment.findAll({
            where: { company_id: req.params.id },
            include: [
                { model: User, as: 'user', attributes: ['id', 'email', 'name', 'role'] }
            ],
            order: [['created_at', 'ASC']]
        });

        // 分离内部评论和外部评论
        const externalComments = comments.filter(c => !c.is_internal);
        const internalComments = comments.filter(c => c.is_internal);

        // 标记管理员已读（仅外部评论）
        await CompanyComment.update(
            { is_read_by_admin: true, admin_read_at: new Date() },
            { where: { company_id: req.params.id, user_role: 'company', is_read_by_admin: false } }
        );

        res.json({ 
            comments: externalComments,  // 外部反馈（企业可见）
            internalComments             // 内部评论（仅admin/staff可见）
        });
    } catch (error) {
        console.error('[Admin] 获取企业评论错误:', error);
        res.status(500).json({ error: '获取评论失败' });
    }
});

// 添加评论/反馈（支持内部评论）
router.post('/companies/:id/comments', authenticate, requireAdmin, async (req, res) => {
    try {
        const { content, is_internal = false } = req.body;

        if (!content || !content.trim()) {
            return res.status(400).json({ error: '请输入评论内容' });
        }

        const company = await Company.findByPk(req.params.id, {
            include: [{ model: User, as: 'user', attributes: ['id', 'email', 'name'] }]
        });
        if (!company) {
            return res.status(404).json({ error: '企业不存在' });
        }

        const isInternalComment = is_internal === true || is_internal === 'true';

        const comment = await CompanyComment.create({
            company_id: req.params.id,
            user_id: req.user.id,
            content: content.trim(),
            user_role: req.user.role,
            is_internal: isInternalComment,
            is_read_by_admin: true, // 管理员/staff自己发的，自己已读
            is_read_by_company: isInternalComment ? true : false // 内部评论不需要企业读取
        });

        // 获取完整的评论信息
        const fullComment = await CompanyComment.findByPk(comment.id, {
            include: [
                { model: User, as: 'user', attributes: ['id', 'email', 'name', 'role'] }
            ]
        });

        const commentType = isInternalComment ? 'Internal Note' : 'Feedback';
        const companyName = company.name_en || company.name_cn;
        console.log(`[Admin] Admin ${req.user.email} added ${commentType} for company ${companyName}`);

        // 发送邮件通知
        try {
            if (emailService.isConfigured()) {
                const recipients = [];
                
                if (isInternalComment) {
                    // 内部评论：通知所有管理员和有权限的 staff（排除自己）
                    const admins = await User.findAll({
                        where: { role: 'admin', status: 'active', id: { [Op.ne]: req.user.id } },
                        attributes: ['email']
                    });
                    recipients.push(...admins.map(a => a.email));

                    // 获取有权限的 staff
                    const permissions = await CompanyPermission.findAll({
                        where: { company_id: req.params.id, is_active: true },
                        include: [{ 
                            model: User, 
                            as: 'permittedUser', 
                            where: { role: 'staff', status: 'active', id: { [Op.ne]: req.user.id } },
                            attributes: ['email']
                        }]
                    });
                    permissions.forEach(p => {
                        if (p.permittedUser?.email) recipients.push(p.permittedUser.email);
                    });

                    if (recipients.length > 0) {
                        await emailService.sendInternalNoteNotification({
                            to: [...new Set(recipients)], // 去重
                            companyName,
                            senderName: req.user.name || req.user.email,
                            senderRole: req.user.role,
                            content: content.trim()
                        });
                    }
                } else {
                    // 外部反馈：通知公司、所有管理员和有权限的 staff（排除自己）
                    // 通知公司
                    if (company.user?.email) {
                        recipients.push(company.user.email);
                    }

                    // 通知所有管理员
                    const admins = await User.findAll({
                        where: { role: 'admin', status: 'active', id: { [Op.ne]: req.user.id } },
                        attributes: ['email']
                    });
                    recipients.push(...admins.map(a => a.email));

                    // 获取有权限的 staff
                    const permissions = await CompanyPermission.findAll({
                        where: { company_id: req.params.id, is_active: true },
                        include: [{ 
                            model: User, 
                            as: 'permittedUser', 
                            where: { role: 'staff', status: 'active', id: { [Op.ne]: req.user.id } },
                            attributes: ['email']
                        }]
                    });
                    permissions.forEach(p => {
                        if (p.permittedUser?.email) recipients.push(p.permittedUser.email);
                    });

                    if (recipients.length > 0) {
                        await emailService.sendFeedbackNotification({
                            to: [...new Set(recipients)], // 去重
                            companyName,
                            senderName: req.user.name || req.user.email,
                            senderRole: req.user.role,
                            content: content.trim()
                        });
                    }
                }
                console.log(`[Admin] 已发送${commentType}通知邮件给 ${recipients.length} 人`);
            }
        } catch (emailError) {
            console.error('[Admin] 发送评论通知邮件失败:', emailError);
            // 不影响主流程
        }

        res.status(201).json({ 
            message: isInternalComment ? '内部评论已添加' : '反馈已添加',
            comment: fullComment
        });
    } catch (error) {
        console.error('[Admin] 添加评论错误:', error);
        res.status(500).json({ error: '添加评论失败' });
    }
});

// 删除评论
router.delete('/companies/:companyId/comments/:commentId', authenticate, requireAdmin, async (req, res) => {
    try {
        const comment = await CompanyComment.findOne({
            where: { 
                id: req.params.commentId,
                company_id: req.params.companyId
            }
        });

        if (!comment) {
            return res.status(404).json({ error: '评论不存在' });
        }

        await comment.destroy();
        console.log(`[Admin] 管理员 ${req.user.email} 删除了评论 ${req.params.commentId}`);

        res.json({ message: '评论已删除' });
    } catch (error) {
        console.error('[Admin] 删除评论错误:', error);
        res.status(500).json({ error: '删除评论失败' });
    }
});

// 获取企业未读反馈数量（管理员视角 - 查看企业发送的未读）
router.get('/companies/:id/comments/unread-count', authenticate, requireAdmin, async (req, res) => {
    try {
        const count = await CompanyComment.count({
            where: { 
                company_id: req.params.id,
                user_role: 'company',
                is_read_by_admin: false
            }
        });

        res.json({ unread_count: count });
    } catch (error) {
        console.error('[Admin] 获取未读评论数量错误:', error);
        res.status(500).json({ error: '获取未读数量失败' });
    }
});

// 获取所有企业的未读反馈汇总
router.get('/comments/unread-summary', authenticate, requireAdmin, async (req, res) => {
    try {
        const { QueryTypes } = require('sequelize');
        const { sequelize } = require('../config/database');

        // 查询每个企业的未读评论数
        const results = await sequelize.query(`
            SELECT 
                c.id as company_id,
                c.name_cn,
                c.name_en,
                COUNT(cc.id) as unread_count
            FROM companies c
            LEFT JOIN company_comments cc ON c.id = cc.company_id 
                AND cc.user_role = 'company' 
                AND cc.is_read_by_admin = false
            GROUP BY c.id, c.name_cn, c.name_en
            HAVING COUNT(cc.id) > 0
            ORDER BY unread_count DESC
        `, { type: QueryTypes.SELECT });

        res.json({ summary: results });
    } catch (error) {
        console.error('[Admin] 获取未读汇总错误:', error);
        res.status(500).json({ error: '获取未读汇总失败' });
    }
});

// ============ 企业权限管理功能 ============

// 获取企业的权限列表
router.get('/companies/:id/permissions', authenticate, requireAdmin, async (req, res) => {
    try {
        const company = await Company.findByPk(req.params.id);
        if (!company) {
            return res.status(404).json({ error: '企业不存在' });
        }

        const permissions = await CompanyPermission.findAll({
            where: { company_id: req.params.id },
            include: [
                { model: User, as: 'permittedUser', attributes: ['id', 'email', 'name', 'role'] },
                { model: User, as: 'grantedByUser', attributes: ['id', 'email', 'name'] }
            ],
            order: [['created_at', 'DESC']]
        });

        res.json({ permissions });
    } catch (error) {
        console.error('[Admin] 获取企业权限列表错误:', error);
        res.status(500).json({ error: '获取权限列表失败' });
    }
});

// 添加/更新企业权限
router.post('/companies/:id/permissions', authenticate, requireAdmin, async (req, res) => {
    try {
        const { user_id, permission_type, expires_at, notes } = req.body;

        if (!user_id) {
            return res.status(400).json({ error: '请选择要授权的用户' });
        }

        const company = await Company.findByPk(req.params.id);
        if (!company) {
            return res.status(404).json({ error: '企业不存在' });
        }

        // 验证用户存在且是 staff、investor 或 company
        const targetUser = await User.findByPk(user_id);
        if (!targetUser) {
            return res.status(404).json({ error: '用户不存在' });
        }
        if (!['staff', 'investor', 'company'].includes(targetUser.role)) {
            return res.status(400).json({ error: '只能授权给 Staff、投资人或企业用户' });
        }

        // 检查是否已存在权限，存在则更新
        let permission = await CompanyPermission.findOne({
            where: { company_id: req.params.id, user_id }
        });

        if (permission) {
            await permission.update({
                permission_type: permission_type || 'view',
                expires_at: expires_at || null,
                notes: notes || null,
                granted_by: req.user.id,
                is_active: true
            });
        } else {
            permission = await CompanyPermission.create({
                company_id: req.params.id,
                user_id,
                permission_type: permission_type || 'view',
                granted_by: req.user.id,
                expires_at: expires_at || null,
                notes: notes || null
            });
        }

        // 获取完整的权限信息
        const fullPermission = await CompanyPermission.findByPk(permission.id, {
            include: [
                { model: User, as: 'permittedUser', attributes: ['id', 'email', 'name', 'role'] },
                { model: User, as: 'grantedByUser', attributes: ['id', 'email', 'name'] }
            ]
        });

        console.log(`[Admin] Admin ${req.user.email} granted access to company ${company.name_en || company.name_cn} for user ${targetUser.email}`);

        res.status(201).json({ 
            message: '权限已设置',
            permission: fullPermission
        });
    } catch (error) {
        console.error('[Admin] 设置企业权限错误:', error);
        res.status(500).json({ error: '设置权限失败' });
    }
});

// 批量设置企业权限
router.post('/companies/:id/permissions/batch', authenticate, requireAdmin, async (req, res) => {
    try {
        const { user_ids, permission_type, expires_at, notes } = req.body;

        if (!user_ids || !Array.isArray(user_ids) || user_ids.length === 0) {
            return res.status(400).json({ error: '请选择要授权的用户' });
        }

        const company = await Company.findByPk(req.params.id);
        if (!company) {
            return res.status(404).json({ error: '企业不存在' });
        }

        const results = [];
        for (const user_id of user_ids) {
            const targetUser = await User.findByPk(user_id);
            if (!targetUser || !['staff', 'investor'].includes(targetUser.role)) {
                results.push({ user_id, success: false, error: '用户不存在或角色不符' });
                continue;
            }

            try {
                let permission = await CompanyPermission.findOne({
                    where: { company_id: req.params.id, user_id }
                });

                if (permission) {
                    await permission.update({
                        permission_type: permission_type || 'view',
                        expires_at: expires_at || null,
                        notes: notes || null,
                        granted_by: req.user.id,
                        is_active: true
                    });
                } else {
                    permission = await CompanyPermission.create({
                        company_id: req.params.id,
                        user_id,
                        permission_type: permission_type || 'view',
                        granted_by: req.user.id,
                        expires_at: expires_at || null,
                        notes: notes || null
                    });
                }
                results.push({ user_id, success: true });
            } catch (e) {
                results.push({ user_id, success: false, error: e.message });
            }
        }

        console.log(`[Admin] Admin ${req.user.email} bulk granted access to company ${company.name_en || company.name_cn} for ${user_ids.length} users`);

        res.json({ 
            message: '批量授权完成',
            results
        });
    } catch (error) {
        console.error('[Admin] 批量设置权限错误:', error);
        res.status(500).json({ error: '批量设置失败' });
    }
});

// 删除企业权限
router.delete('/companies/:companyId/permissions/:permissionId', authenticate, requireAdmin, async (req, res) => {
    try {
        const permission = await CompanyPermission.findOne({
            where: { 
                id: req.params.permissionId,
                company_id: req.params.companyId
            },
            include: [
                { model: User, as: 'permittedUser', attributes: ['email'] }
            ]
        });

        if (!permission) {
            return res.status(404).json({ error: '权限记录不存在' });
        }

        const userEmail = permission.permittedUser?.email;
        await permission.destroy();

        console.log(`[Admin] 管理员 ${req.user.email} 移除了用户 ${userEmail} 对企业的访问权限`);

        res.json({ message: '权限已移除' });
    } catch (error) {
        console.error('[Admin] 删除权限错误:', error);
        res.status(500).json({ error: '删除权限失败' });
    }
});

// 更改公司联系人
router.put('/companies/:id/contact-person', authenticate, requireAdmin, async (req, res) => {
    try {
        const { contact_person_id } = req.body;

        const company = await Company.findByPk(req.params.id);
        if (!company) {
            return res.status(404).json({ error: '企业不存在' });
        }

        // 如果提供了contact_person_id，验证用户存在
        if (contact_person_id) {
            const contactUser = await User.findByPk(contact_person_id);
            if (!contactUser) {
                return res.status(404).json({ error: '联系人用户不存在' });
            }
            if (contactUser.status !== 'active') {
                return res.status(400).json({ error: '联系人用户未激活' });
            }
        }

        const oldContactPersonId = company.contact_person_id;
        await company.update({ contact_person_id: contact_person_id || null });

        // 获取更新后的联系人信息
        const updatedCompany = await Company.findByPk(req.params.id, {
            include: [
                { 
                    model: User, 
                    as: 'contactPerson', 
                    required: false,
                    attributes: ['id', 'email', 'name', 'role']
                }
            ]
        });

        const companyName = company.name_en || company.name_cn || 'Company';
        const contactInfo = updatedCompany.contactPerson 
            ? `${updatedCompany.contactPerson.name || updatedCompany.contactPerson.email} (${updatedCompany.contactPerson.role})`
            : 'None';

        console.log(`[Admin] Admin ${req.user.email} changed contact person for company ${companyName} to ${contactInfo}`);

        res.json({ 
            message: '联系人已更新',
            company: updatedCompany
        });
    } catch (error) {
        console.error('[Admin] 更改联系人错误:', error);
        res.status(500).json({ error: '更改联系人失败' });
    }
});

// 获取可授权的用户列表（Staff 和已审核的投资人）
router.get('/permissible-users', authenticate, requireAdmin, async (req, res) => {
    try {
        const { role, search } = req.query;
        
        // 默认返回所有角色（staff, investor, company）
        const where = {
            role: ['staff', 'investor', 'company'],
            status: 'active'
        };

        if (role && ['staff', 'investor', 'company'].includes(role)) {
            where.role = role;
        }

        // 支持搜索（按邮箱或姓名）
        if (search && search.trim()) {
            const { Op } = require('sequelize');
            where[Op.or] = [
                { email: { [Op.iLike]: `%${search.trim()}%` } },
                { name: { [Op.iLike]: `%${search.trim()}%` } }
            ];
        }

        const users = await User.findAll({
            where,
            attributes: ['id', 'email', 'name', 'role'],
            include: [{
                model: InvestorProfile,
                as: 'investorProfile',
                required: false,
                attributes: ['name', 'organization', 'investor_type']
            }],
            order: [['role', 'ASC'], ['email', 'ASC']]
        });

        res.json({ users });
    } catch (error) {
        console.error('[Admin] 获取可授权用户列表错误:', error);
        res.status(500).json({ error: '获取用户列表失败' });
    }
});

// ==================== 投资人兴趣表达管理 ====================

// 获取企业的所有兴趣表达
router.get('/companies/:id/interests', authenticate, requireAdmin, async (req, res) => {
    try {
        const interests = await InterestExpression.findAll({
            where: { company_id: req.params.id },
            include: [{
                model: User,
                as: 'investor',
                attributes: ['id', 'email', 'name'],
                include: [{
                    model: InvestorProfile,
                    as: 'investorProfile',
                    attributes: ['name', 'organization', 'investor_type', 'title']
                }]
            }],
            order: [['created_at', 'DESC']]
        });

        res.json({ interests });
    } catch (error) {
        console.error('[Admin] 获取兴趣表达列表错误:', error);
        res.status(500).json({ error: '获取列表失败' });
    }
});

// 获取所有兴趣表达（汇总）
router.get('/interests', authenticate, requireAdmin, async (req, res) => {
    try {
        const { status = 'active', page = 1, limit = 50 } = req.query;

        const where = {};
        if (status) where.status = status;

        const { count, rows: interests } = await InterestExpression.findAndCountAll({
            where,
            include: [
                {
                    model: Company,
                    as: 'company',
                    attributes: ['id', 'name_cn', 'name_en', 'stage', 'deal_status']
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
            interests,
            pagination: {
                total: count,
                page: parseInt(page),
                limit: parseInt(limit),
                pages: Math.ceil(count / parseInt(limit))
            }
        });
    } catch (error) {
        console.error('[Admin] 获取所有兴趣表达错误:', error);
        res.status(500).json({ error: '获取列表失败' });
    }
});

// 跟进兴趣表达
router.put('/interests/:id/follow-up', authenticate, requireAdmin, async (req, res) => {
    try {
        const { follow_up_notes, status } = req.body;

        const interest = await InterestExpression.findByPk(req.params.id);
        if (!interest) {
            return res.status(404).json({ error: '记录不存在' });
        }

        await interest.update({
            follow_up_notes,
            follow_up_by: req.user.id,
            follow_up_at: new Date(),
            ...(status && { status })
        });

        res.json({ message: '跟进记录已更新', interest });
    } catch (error) {
        console.error('[Admin] 更新兴趣表达跟进错误:', error);
        res.status(500).json({ error: '更新失败' });
    }
});

// ==================== 资料库管理 ====================

// 获取企业资料库统计
router.get('/companies/:id/dataroom-stats', authenticate, requireAdmin, async (req, res) => {
    try {
        const company = await Company.findByPk(req.params.id);
        if (!company) {
            return res.status(404).json({ error: '企业不存在' });
        }

        const [folderCount, fileCount, accessCount] = await Promise.all([
            DataRoomFolder.count({ where: { company_id: req.params.id } }),
            DataRoomFile.count({ where: { company_id: req.params.id } }),
            DataRoomAccess.count({ where: { company_id: req.params.id, status: 'active' } })
        ]);

        res.json({
            dataRoomEnabled: company.data_room_enabled,
            folderCount,
            fileCount,
            accessCount
        });
    } catch (error) {
        console.error('[Admin] 获取资料库统计错误:', error);
        res.status(500).json({ error: '获取统计失败' });
    }
});

module.exports = router;
