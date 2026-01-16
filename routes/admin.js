const express = require('express');
const router = express.Router();
const { Op } = require('sequelize');
const { User, Company, FundraisingInfo, Document, InvestorProfile, AccessRequest } = require('../models');
const { authenticate, requireAdmin } = require('../middleware/auth');

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

module.exports = router;
