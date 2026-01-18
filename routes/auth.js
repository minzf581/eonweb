const express = require('express');
const router = express.Router();
const { User, Company, InvestorProfile } = require('../models');
const { generateToken, authenticate } = require('../middleware/auth');

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
                ...additionalInfo
            },
            token
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

        const isValid = await req.user.validatePassword(currentPassword);
        if (!isValid) {
            return res.status(401).json({ error: '当前密码错误' });
        }

        req.user.password = newPassword;
        await req.user.save();

        res.json({ message: '密码修改成功' });
    } catch (error) {
        console.error('[Auth] 修改密码错误:', error);
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
