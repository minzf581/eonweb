const express = require('express');
const router = express.Router();
const { Op } = require('sequelize');
const multer = require('multer');
const bcrypt = require('bcryptjs');
const nodemailer = require('nodemailer');
const { User, Company, FundraisingInfo, Document, InvestorProfile, AccessRequest, Message } = require('../models');
const { authenticate, requireAdmin } = require('../middleware/auth');

// 配置文件上传 - 内存存储用于附件
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB
});

// 配置邮件发送（可选）
const createEmailTransporter = () => {
    if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
        return nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: process.env.SMTP_PORT || 587,
            secure: process.env.SMTP_SECURE === 'true',
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS
            }
        });
    }
    return null;
};

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
                { model: Document, as: 'documents', attributes: ['id', 'type', 'filename'] }
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
        const { status, visibility, admin_notes, admin_feedback, tags } = req.body;

        const company = await Company.findByPk(req.params.id);
        if (!company) {
            return res.status(404).json({ error: '企业不存在' });
        }

        const updateData = {
            reviewed_at: new Date(),
            reviewed_by: req.user.id
        };

        if (status) updateData.status = status;
        if (visibility) updateData.visibility = visibility;
        if (admin_notes !== undefined) updateData.admin_notes = admin_notes;
        if (admin_feedback !== undefined) updateData.admin_feedback = admin_feedback;
        if (tags) updateData.tags = tags;

        await company.update(updateData);

        res.json({ 
            message: '企业信息已更新',
            company 
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
        const { status, admin_notes } = req.body;

        const profile = await InvestorProfile.findByPk(req.params.id);
        if (!profile) {
            return res.status(404).json({ error: '投资人不存在' });
        }

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

        res.json({ 
            message: '投资人信息已更新',
            profile 
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

        const request = await AccessRequest.findByPk(req.params.id);
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

        res.json({ 
            message: '请求已处理',
            request 
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

        // 可选发送邮件
        let emailSent = false;
        if (send_email === 'true' || send_email === true) {
            const transporter = createEmailTransporter();
            if (transporter) {
                try {
                    const emailAttachments = attachments.map(att => ({
                        filename: att.filename,
                        content: Buffer.from(att.content, 'base64'),
                        contentType: att.mimetype
                    }));

                    await transporter.sendMail({
                        from: process.env.SMTP_FROM || process.env.SMTP_USER,
                        to: recipient.email,
                        subject: subject,
                        html: `
                            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                                <h2 style="color: #0D43F9;">EON Protocol</h2>
                                <div style="background: #f5f5f5; padding: 20px; border-radius: 8px;">
                                    ${content.replace(/\n/g, '<br>')}
                                </div>
                                ${statusChange ? `<p style="color: #666; margin-top: 20px;">您的状态已更新为: <strong>${statusChange.to}</strong></p>` : ''}
                                <hr style="margin: 20px 0; border: none; border-top: 1px solid #eee;">
                                <p style="color: #999; font-size: 12px;">此邮件由 EON Protocol 系统自动发送</p>
                            </div>
                        `,
                        attachments: emailAttachments
                    });

                    emailSent = true;
                    await message.update({ email_sent: true, email_sent_at: new Date() });
                    console.log(`[Admin] 邮件发送成功: ${recipient.email}`);
                } catch (emailError) {
                    console.error('[Admin] 邮件发送失败:', emailError);
                }
            } else {
                console.log('[Admin] 邮件服务未配置，跳过发送');
            }
        }

        console.log(`[Admin] 管理员 ${req.user.email} 发送消息给 ${recipient.email}`);

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
    const configured = !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
    res.json({ 
        configured,
        smtp_host: configured ? process.env.SMTP_HOST : null
    });
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

module.exports = router;
