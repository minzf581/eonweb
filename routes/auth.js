const express = require('express');
const router = express.Router();
const { User, Company, InvestorProfile } = require('../models');
const { generateToken, authenticate } = require('../middleware/auth');
const emailService = require('../services/EmailService');

// 注册
router.post('/register', async (req, res) => {
    try {
        const { email, password, role, name, referral_code } = req.body;

        // 验证必填字段
        if (!email || !password || !role) {
            return res.status(400).json({ error: '请填写所有必填字段' });
        }

        // 验证角色
        if (!['company', 'investor'].includes(role)) {
            return res.status(400).json({ error: '无效的角色类型' });
        }

        // 检查邮箱是否已存在
        const existingUser = await User.findOne({ where: { email } });
        if (existingUser) {
            return res.status(400).json({ error: '该邮箱已被注册' });
        }

        // 处理推荐码
        let referrer = null;
        let isPriority = false;
        if (referral_code) {
            referrer = await User.findOne({ where: { referral_code: referral_code.toUpperCase() } });
            if (!referrer) {
                return res.status(400).json({ error: '无效的推荐码' });
            }
            isPriority = true; // 有推荐码的用户优先处理
            console.log(`[Auth] 用户 ${email} 由 ${referrer.email} 推荐注册`);
        }

        // 为新用户生成推荐码
        let newReferralCode;
        let attempts = 0;
        while (!newReferralCode && attempts < 10) {
            const code = User.generateReferralCode();
            const existing = await User.findOne({ where: { referral_code: code } });
            if (!existing) {
                newReferralCode = code;
            }
            attempts++;
        }

        // 创建用户
        const user = await User.create({
            email,
            password,
            role,
            name,
            referral_code: newReferralCode,
            referred_by: referrer?.id,
            is_priority: isPriority,
            status: role === 'investor' ? 'pending' : 'active' // 投资人需要审核
        });

        // 更新推荐人的推荐计数
        if (referrer) {
            await referrer.increment('referral_count');
        }

        // 如果是投资人，创建投资人资料
        if (role === 'investor') {
            await InvestorProfile.create({
                user_id: user.id,
                name: name || email.split('@')[0],
                investor_type: 'individual',
                status: 'pending'
            });
        }

        const token = generateToken(user);

        res.status(201).json({
            message: '注册成功',
            user: user.toSafeObject(),
            token,
            referrer: referrer ? { email: referrer.email, name: referrer.name } : null
        });
    } catch (error) {
        console.error('[Auth] 注册错误:', error);
        res.status(500).json({ error: '注册失败，请稍后重试' });
    }
});

// 登录
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: '请输入邮箱和密码' });
        }

        const user = await User.findOne({ where: { email } });
        if (!user) {
            return res.status(401).json({ error: '邮箱或密码错误' });
        }

        const isValid = await user.validatePassword(password);
        if (!isValid) {
            return res.status(401).json({ error: '邮箱或密码错误' });
        }

        if (user.status === 'suspended') {
            return res.status(403).json({ error: '账户已被暂停，请联系管理员' });
        }

        // 检查临时密码是否过期
        if (user.temp_password && user.temp_password_expires) {
            if (new Date() > new Date(user.temp_password_expires)) {
                return res.status(401).json({ 
                    error: '临时密码已过期，请重新申请密码重置',
                    code: 'TEMP_PASSWORD_EXPIRED'
                });
            }
        }

        const token = generateToken(user);

        // 获取额外信息
        let additionalInfo = {};
        if (user.role === 'company') {
            const company = await Company.findOne({ where: { user_id: user.id } });
            additionalInfo.hasCompanyProfile = !!company;
            additionalInfo.companyStatus = company?.status;
        } else if (user.role === 'investor') {
            const profile = await InvestorProfile.findOne({ where: { user_id: user.id } });
            additionalInfo.investorStatus = profile?.status;
        }

        res.json({
            message: '登录成功',
            user: {
                ...user.toSafeObject(),
                ...additionalInfo,
                requirePasswordChange: user.temp_password // 如果使用临时密码，需要修改
            },
            token,
            requirePasswordChange: user.temp_password // 顶级字段方便前端判断
        });
    } catch (error) {
        console.error('[Auth] 登录错误:', error);
        res.status(500).json({ error: '登录失败，请稍后重试' });
    }
});

// 获取当前用户信息
router.get('/me', authenticate, async (req, res) => {
    try {
        const user = req.user;
        let additionalInfo = {};

        if (user.role === 'company') {
            const company = await Company.findOne({ 
                where: { user_id: user.id },
                attributes: ['id', 'name_cn', 'status']
            });
            additionalInfo.company = company;
        } else if (user.role === 'investor') {
            const profile = await InvestorProfile.findOne({ 
                where: { user_id: user.id },
                attributes: ['id', 'name', 'status']
            });
            additionalInfo.investorProfile = profile;
        }

        res.json({
            user: {
                ...user.toSafeObject(),
                ...additionalInfo
            }
        });
    } catch (error) {
        console.error('[Auth] 获取用户信息错误:', error);
        res.status(500).json({ error: '获取用户信息失败' });
    }
});

// 修改密码
router.post('/change-password', authenticate, async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;

        if (!currentPassword || !newPassword) {
            return res.status(400).json({ error: '请填写当前密码和新密码' });
        }

        if (newPassword.length < 6) {
            return res.status(400).json({ error: '新密码长度至少为6位' });
        }

        const isValid = await req.user.validatePassword(currentPassword);
        if (!isValid) {
            return res.status(401).json({ error: '当前密码错误' });
        }

        req.user.password = newPassword;
        req.user.temp_password = false; // 重置临时密码标记
        req.user.temp_password_expires = null;
        await req.user.save();

        res.json({ message: '密码修改成功' });
    } catch (error) {
        console.error('[Auth] 修改密码错误:', error);
        res.status(500).json({ error: '修改密码失败' });
    }
});

// ==================== 密码重置功能 ====================

// 请求密码重置（发送临时密码到邮箱）
router.post('/reset-password', async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({ error: '请输入邮箱地址' });
        }

        const user = await User.findOne({ where: { email } });
        if (!user) {
            // 为安全起见，不透露用户是否存在
            return res.json({ 
                message: '如果该邮箱已注册，您将收到一封包含临时密码的邮件' 
            });
        }

        // 生成临时密码
        const tempPassword = User.generateTempPassword();
        
        // 设置临时密码（有效期24小时）
        const bcrypt = require('bcryptjs');
        const hashedPassword = await bcrypt.hash(tempPassword, 10);
        
        await user.update({
            password: hashedPassword,
            temp_password: true,
            temp_password_expires: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24小时后过期
        }, {
            hooks: false // 跳过 beforeUpdate hook，因为我们已经手动哈希了
        });

        console.log(`[Auth] 为用户 ${email} 生成临时密码`);

        // 发送邮件
        try {
            if (emailService.isConfigured()) {
                const html = emailService.generateTemplate({
                    title: '密码重置',
                    content: `
                        <p>您好，</p>
                        <p>您请求了密码重置。以下是您的临时密码：</p>
                        <div style="background: #F3F4F6; padding: 20px; border-radius: 8px; text-align: center; margin: 20px 0;">
                            <code style="font-size: 24px; font-weight: bold; letter-spacing: 2px; color: #1E40AF;">${tempPassword}</code>
                        </div>
                        <p><strong>重要提示：</strong></p>
                        <ul style="color: #4B5563;">
                            <li>此临时密码有效期为 <strong>24 小时</strong></li>
                            <li>登录后系统会提示您设置新密码</li>
                            <li>如果您没有请求密码重置，请忽略此邮件</li>
                        </ul>
                    `,
                    actionUrl: `${process.env.SITE_URL || 'https://eonprotocol.ai'}/auth/login.html`,
                    actionText: '前往登录'
                });

                await emailService.sendEmail({
                    to: email,
                    subject: '[EON Protocol] 密码重置 - 您的临时密码',
                    html
                });

                console.log(`[Auth] 临时密码邮件已发送至 ${email}`);
            } else {
                console.log(`[Auth] 邮件服务未配置，临时密码: ${tempPassword}`);
            }
        } catch (emailError) {
            console.error('[Auth] 发送密码重置邮件失败:', emailError);
            // 即使邮件发送失败，也返回成功消息（安全考虑）
        }

        res.json({ 
            message: '如果该邮箱已注册，您将收到一封包含临时密码的邮件',
            // 开发环境下返回临时密码（生产环境应删除）
            ...(process.env.NODE_ENV !== 'production' && { debug_temp_password: tempPassword })
        });
    } catch (error) {
        console.error('[Auth] 密码重置错误:', error);
        res.status(500).json({ error: '密码重置失败，请稍后重试' });
    }
});

// 强制修改密码（临时密码登录后）
router.post('/force-change-password', authenticate, async (req, res) => {
    try {
        const { newPassword } = req.body;

        if (!newPassword) {
            return res.status(400).json({ error: '请输入新密码' });
        }

        if (newPassword.length < 6) {
            return res.status(400).json({ error: '密码长度至少为6位' });
        }

        // 检查是否需要修改密码
        if (!req.user.temp_password) {
            return res.status(400).json({ error: '当前不需要修改密码' });
        }

        req.user.password = newPassword;
        req.user.temp_password = false;
        req.user.temp_password_expires = null;
        await req.user.save();

        console.log(`[Auth] 用户 ${req.user.email} 已设置新密码`);

        res.json({ message: '密码已更新，请使用新密码登录' });
    } catch (error) {
        console.error('[Auth] 强制修改密码错误:', error);
        res.status(500).json({ error: '修改密码失败' });
    }
});

// ==================== 推荐码功能 ====================

// 获取我的推荐码和推荐链接
router.get('/referral', authenticate, async (req, res) => {
    try {
        const user = req.user;
        
        // 如果用户还没有推荐码，生成一个
        if (!user.referral_code) {
            let newReferralCode;
            let attempts = 0;
            while (!newReferralCode && attempts < 10) {
                const code = User.generateReferralCode();
                const existing = await User.findOne({ where: { referral_code: code } });
                if (!existing) {
                    newReferralCode = code;
                }
                attempts++;
            }
            
            if (newReferralCode) {
                user.referral_code = newReferralCode;
                await user.save();
            }
        }

        // 获取被推荐的用户列表
        const referrals = await User.findAll({
            where: { referred_by: user.id },
            attributes: ['id', 'email', 'name', 'role', 'status', 'created_at'],
            order: [['created_at', 'DESC']]
        });

        res.json({
            referral_code: user.referral_code,
            referral_link: `/auth/register.html?ref=${user.referral_code}`,
            referral_count: user.referral_count || referrals.length,
            referrals: referrals.map(r => ({
                id: r.id,
                email: r.email,
                name: r.name,
                role: r.role,
                status: r.status,
                created_at: r.created_at
            }))
        });
    } catch (error) {
        console.error('[Auth] 获取推荐码错误:', error);
        res.status(500).json({ error: '获取推荐码失败' });
    }
});

// 验证推荐码是否有效
router.get('/referral/validate/:code', async (req, res) => {
    try {
        const { code } = req.params;
        
        const referrer = await User.findOne({ 
            where: { referral_code: code.toUpperCase() },
            attributes: ['id', 'name', 'email', 'role']
        });

        if (!referrer) {
            return res.status(404).json({ valid: false, error: '推荐码无效' });
        }

        res.json({
            valid: true,
            referrer: {
                name: referrer.name || referrer.email.split('@')[0],
                role: referrer.role
            }
        });
    } catch (error) {
        console.error('[Auth] 验证推荐码错误:', error);
        res.status(500).json({ error: '验证推荐码失败' });
    }
});

// 获取我的推荐人信息
router.get('/referrer', authenticate, async (req, res) => {
    try {
        const user = req.user;
        
        if (!user.referred_by) {
            return res.json({ referrer: null });
        }

        const referrer = await User.findByPk(user.referred_by, {
            attributes: ['id', 'email', 'name', 'role']
        });

        res.json({
            referrer: referrer ? {
                name: referrer.name || referrer.email.split('@')[0],
                email: referrer.email,
                role: referrer.role
            } : null
        });
    } catch (error) {
        console.error('[Auth] 获取推荐人错误:', error);
        res.status(500).json({ error: '获取推荐人信息失败' });
    }
});

module.exports = router;
