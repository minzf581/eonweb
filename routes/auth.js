const express = require('express');
const router = express.Router();
const { User, Company, InvestorProfile } = require('../models');
const { generateToken, authenticate } = require('../middleware/auth');
const emailService = require('../services/EmailService');

// Register
router.post('/register', async (req, res) => {
    try {
        const { email, password, role, name, referral_code } = req.body;

        // Validate required fields
        if (!email || !password || !role) {
            return res.status(400).json({ error: 'Please fill in all required fields' });
        }

        // Validate role
        if (!['company', 'investor'].includes(role)) {
            return res.status(400).json({ error: 'Invalid role type' });
        }

        // Check if email exists
        const existingUser = await User.findOne({ where: { email } });
        if (existingUser) {
            return res.status(400).json({ error: 'This email is already registered' });
        }

        // Process referral code
        let referrer = null;
        let isPriority = false;
        if (referral_code) {
            referrer = await User.findOne({ where: { referral_code: referral_code.toUpperCase() } });
            if (!referrer) {
                return res.status(400).json({ error: 'Invalid referral code' });
            }
            isPriority = true;
            console.log(`[Auth] User ${email} registered via referral from ${referrer.email}`);
        }

        // Generate referral code for new user
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

        // Create user
        const user = await User.create({
            email,
            password,
            role,
            name,
            referral_code: newReferralCode,
            referred_by: referrer?.id,
            is_priority: isPriority,
            status: role === 'investor' ? 'pending' : 'active'
        });

        // Update referrer's referral count
        if (referrer) {
            await referrer.increment('referral_count');
        }

        // Create investor profile if investor
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
            message: 'Registration successful',
            user: user.toSafeObject(),
            token,
            referrer: referrer ? { email: referrer.email, name: referrer.name } : null
        });
    } catch (error) {
        console.error('[Auth] Registration error:', error);
        res.status(500).json({ error: 'Registration failed, please try again later' });
    }
});

// Login
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Please enter email and password' });
        }

        const user = await User.findOne({ where: { email } });
        if (!user) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        const isValid = await user.validatePassword(password);
        if (!isValid) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        if (user.status === 'suspended') {
            return res.status(403).json({ error: 'Account has been suspended, please contact admin' });
        }

        // Check if temp password is expired
        if (user.temp_password && user.temp_password_expires) {
            if (new Date() > new Date(user.temp_password_expires)) {
                return res.status(401).json({ 
                    error: 'Temporary password has expired, please request a new password reset',
                    code: 'TEMP_PASSWORD_EXPIRED'
                });
            }
        }

        const token = generateToken(user);

        // Get additional info
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
            message: 'Login successful',
            user: {
                ...user.toSafeObject(),
                ...additionalInfo,
                requirePasswordChange: user.temp_password
            },
            token,
            requirePasswordChange: user.temp_password
        });
    } catch (error) {
        console.error('[Auth] Login error:', error);
        res.status(500).json({ error: 'Login failed, please try again later' });
    }
});

// Get current user info
router.get('/me', authenticate, async (req, res) => {
    try {
        const user = req.user;
        let additionalInfo = {};

        if (user.role === 'company') {
            // 查找用户作为主要联系人的公司
            const ownCompany = await Company.findOne({ 
                where: { user_id: user.id },
                attributes: ['id', 'name_cn', 'name_en', 'status']
            });
            
            // 查找用户有权限访问的公司
            const { Op } = require('sequelize');
            const CompanyPermission = require('../models/CompanyPermission');
            const permittedCompanyIds = await CompanyPermission.findAll({
                where: {
                    user_id: user.id,
                    is_active: true,
                    [Op.or]: [
                        { expires_at: null },
                        { expires_at: { [Op.gt]: new Date() } }
                    ]
                },
                attributes: ['company_id']
            }).then(perms => perms.map(p => p.company_id));
            
            let permittedCompanies = [];
            if (permittedCompanyIds.length > 0) {
                permittedCompanies = await Company.findAll({
                    where: { id: { [Op.in]: permittedCompanyIds } },
                    attributes: ['id', 'name_cn', 'name_en', 'status']
                });
            }
            
            additionalInfo.company = ownCompany;
            additionalInfo.permittedCompanies = permittedCompanies;
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
        console.error('[Auth] Get user info error:', error);
        res.status(500).json({ error: 'Failed to get user info' });
    }
});

// Change password
router.post('/change-password', authenticate, async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;

        if (!currentPassword || !newPassword) {
            return res.status(400).json({ error: 'Please fill in current password and new password' });
        }

        if (newPassword.length < 6) {
            return res.status(400).json({ error: 'New password must be at least 6 characters' });
        }

        const isValid = await req.user.validatePassword(currentPassword);
        if (!isValid) {
            return res.status(401).json({ error: 'Current password is incorrect' });
        }

        req.user.password = newPassword;
        req.user.temp_password = false;
        req.user.temp_password_expires = null;
        await req.user.save();

        res.json({ message: 'Password changed successfully' });
    } catch (error) {
        console.error('[Auth] Change password error:', error);
        res.status(500).json({ error: 'Failed to change password' });
    }
});

// ==================== Password Reset ====================

// Request password reset (send temp password to email)
router.post('/reset-password', async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({ error: 'Please enter your email address' });
        }

        const user = await User.findOne({ where: { email } });
        if (!user) {
            // For security, don't reveal if user exists
            return res.json({ 
                message: 'If this email is registered, you will receive a temporary password shortly' 
            });
        }

        // Generate temp password
        const tempPassword = User.generateTempPassword();
        
        // Set temp password (valid for 24 hours)
        const bcrypt = require('bcryptjs');
        const hashedPassword = await bcrypt.hash(tempPassword, 10);
        
        await user.update({
            password: hashedPassword,
            temp_password: true,
            temp_password_expires: new Date(Date.now() + 24 * 60 * 60 * 1000)
        }, {
            hooks: false
        });

        console.log(`[Auth] Generated temp password for user ${email}`);

        // Send email
        try {
            if (emailService.isConfigured()) {
                const html = emailService.generateTemplate({
                    title: 'Password Reset',
                    content: `
                        <p>Hello,</p>
                        <p>You requested a password reset. Here is your temporary password:</p>
                        <div style="background: #F3F4F6; padding: 20px; border-radius: 8px; text-align: center; margin: 20px 0;">
                            <code style="font-size: 24px; font-weight: bold; letter-spacing: 2px; color: #1E40AF;">${tempPassword}</code>
                        </div>
                        <p><strong>Important:</strong></p>
                        <ul style="color: #4B5563;">
                            <li>This temporary password is valid for <strong>24 hours</strong></li>
                            <li>After logging in, you will be prompted to set a new password</li>
                            <li>If you did not request this password reset, please ignore this email</li>
                        </ul>
                    `,
                    actionUrl: `${process.env.SITE_URL || 'https://eonprotocol.ai'}/auth/login.html`,
                    actionText: 'Go to Login'
                });

                await emailService.sendEmail({
                    to: email,
                    subject: '[EON Protocol] Password Reset - Your Temporary Password',
                    html
                });

                console.log(`[Auth] Temp password email sent to ${email}`);
            } else {
                console.log(`[Auth] Email service not configured, temp password: ${tempPassword}`);
            }
        } catch (emailError) {
            console.error('[Auth] Failed to send password reset email:', emailError);
        }

        res.json({ 
            message: 'If this email is registered, you will receive a temporary password shortly',
            ...(process.env.NODE_ENV !== 'production' && { debug_temp_password: tempPassword })
        });
    } catch (error) {
        console.error('[Auth] Password reset error:', error);
        res.status(500).json({ error: 'Password reset failed, please try again later' });
    }
});

// Force change password (after temp password login)
router.post('/force-change-password', authenticate, async (req, res) => {
    try {
        const { newPassword } = req.body;

        if (!newPassword) {
            return res.status(400).json({ error: 'Please enter a new password' });
        }

        if (newPassword.length < 6) {
            return res.status(400).json({ error: 'Password must be at least 6 characters' });
        }

        // Check if password change is needed
        if (!req.user.temp_password) {
            return res.status(400).json({ error: 'Password change is not required' });
        }

        req.user.password = newPassword;
        req.user.temp_password = false;
        req.user.temp_password_expires = null;
        await req.user.save();

        console.log(`[Auth] User ${req.user.email} has set a new password`);

        res.json({ message: 'Password updated successfully, please login with your new password' });
    } catch (error) {
        console.error('[Auth] Force change password error:', error);
        res.status(500).json({ error: 'Failed to change password' });
    }
});

// ==================== Referral Code ====================

// Get my referral code and link
router.get('/referral', authenticate, async (req, res) => {
    try {
        const user = req.user;
        
        // Generate referral code if user doesn't have one
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

        // Get referred users list
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
        console.error('[Auth] Get referral code error:', error);
        res.status(500).json({ error: 'Failed to get referral code' });
    }
});

// Validate referral code
router.get('/referral/validate/:code', async (req, res) => {
    try {
        const { code } = req.params;
        
        const referrer = await User.findOne({ 
            where: { referral_code: code.toUpperCase() },
            attributes: ['id', 'name', 'email', 'role']
        });

        if (!referrer) {
            return res.status(404).json({ valid: false, error: 'Invalid referral code' });
        }

        res.json({
            valid: true,
            referrer: {
                name: referrer.name || referrer.email.split('@')[0],
                role: referrer.role
            }
        });
    } catch (error) {
        console.error('[Auth] Validate referral code error:', error);
        res.status(500).json({ error: 'Failed to validate referral code' });
    }
});

// Get my referrer info
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
        console.error('[Auth] Get referrer error:', error);
        res.status(500).json({ error: 'Failed to get referrer info' });
    }
});

module.exports = router;
