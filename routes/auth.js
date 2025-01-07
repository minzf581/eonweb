const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { Op } = require('sequelize');
const { User } = require('../models');  
const { router: referralRouter, processReferral } = require('./referral');
const { authenticateToken } = require('../middleware/auth');

// 注册
router.post('/register', async (req, res) => {
    try {
        console.log('[Auth] Registration request received:', {
            email: req.body.email,
            hasPassword: !!req.body.password,
            hasReferralCode: !!req.body.referralCode
        });

        const { email, password, referralCode } = req.body;
        
        // 检查必需字段
        if (!email || !password) {
            console.log('[Auth] Missing required fields:', { email: !!email, password: !!password });
            return res.status(400).json({
                success: false,
                message: 'Email and password are required'
            });
        }

        // 检查邮箱格式
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            console.log('[Auth] Invalid email format:', email);
            return res.status(400).json({
                success: false,
                message: 'Invalid email format'
            });
        }

        // 检查密码长度
        if (password.length < 6) {
            console.log('[Auth] Password too short');
            return res.status(400).json({
                success: false,
                message: 'Password must be at least 6 characters long'
            });
        }

        // Check if user already exists
        const existingUser = await User.findOne({ 
            where: { 
                [Op.or]: [
                    { email },
                    { username: email.split('@')[0] }
                ]
            } 
        });

        if (existingUser) {
            const field = existingUser.email === email ? 'email' : 'username';
            console.log('[Auth] User already exists:', { field });
            return res.status(400).json({ 
                success: false,
                message: `User with this ${field} already exists` 
            });
        }

        // Hash password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Generate referral code
        const newReferralCode = crypto.randomBytes(4).toString('hex');

        // 创建新用户
        const user = await User.create({
            email,
            username: email.split('@')[0],
            password: hashedPassword,
            referral_code: newReferralCode,
            points: 0,
            is_admin: false
        });

        // 处理推荐码关系
        if (referralCode) {
            try {
                await processReferral(user.id, referralCode);
            } catch (error) {
                console.error('[Auth] Failed to process referral:', error);
                // Don't fail registration if referral processing fails
            }
        }

        // 生成 JWT
        const token = jwt.sign(
            { 
                id: user.id, 
                email: user.email,
                is_admin: user.is_admin 
            },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );

        console.log('[Auth] Registration successful:', {
            id: user.id,
            email: user.email,
            is_admin: user.is_admin,
            referral_code: user.referral_code
        });

        res.status(201).json({
            success: true,
            message: 'Registration successful',
            token,
            user: {
                id: user.id,
                email: user.email,
                is_admin: user.is_admin,
                referral_code: user.referral_code
            }
        });
    } catch (error) {
        console.error('[Auth] Registration error:', error);
        res.status(500).json({ 
            success: false,
            message: 'Registration failed',
            error: error.message
        });
    }
});

// 登录
router.post('/login', async (req, res) => {
    try {
        console.log('[Auth] Login request received:', {
            email: req.body.email
        });

        const { email, password } = req.body;

        // 验证必需字段
        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Email and password are required'
            });
        }

        // 查找用户
        const user = await User.findOne({ 
            where: { email },
            attributes: ['id', 'email', 'password', 'is_admin', 'points', 'referral_code', 'username', 'credits']
        });

        if (!user) {
            console.log('[Auth] Login failed: User not found:', { email });
            return res.status(401).json({
                success: false,
                message: 'Invalid email or password'
            });
        }

        // 验证密码
        try {
            const validPassword = await user.comparePassword(password);
            if (!validPassword) {
                console.log('[Auth] Login failed: Invalid password:', { email });
                return res.status(401).json({
                    success: false,
                    message: 'Invalid email or password'
                });
            }
        } catch (error) {
            console.error('[Auth] Password verification error:', error);
            return res.status(500).json({
                success: false,
                message: 'Login failed',
                error: error.message
            });
        }

        // 生成 JWT
        const token = jwt.sign({
            id: user.id,
            email: user.email,
            is_admin: user.is_admin
        }, process.env.JWT_SECRET, {
            expiresIn: '24h'
        });

        console.log('[Auth] Generated token payload:', {
            id: user.id,
            email: user.email,
            is_admin: user.is_admin
        });

        console.log('[Auth] Login successful:', {
            id: user.id,
            email: user.email,
            is_admin: user.is_admin
        });

        // Return success response
        return res.status(200).json({
            success: true,
            message: 'Login successful',
            token,
            user: {
                id: user.id,
                email: user.email,
                is_admin: user.is_admin,
                points: user.points,
                referral_code: user.referral_code,
                credits: user.credits,
                username: user.username
            }
        });
    } catch (error) {
        console.error('[Auth] Login error:', error);
        res.status(500).json({
            success: false,
            message: 'Login failed',
            error: error.message
        });
    }
});

// 获取当前用户信息
router.get('/me', async (req, res) => {
    try {
        console.log('[Auth] Getting current user info');
        
        // 从请求头获取 token
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];

        if (!token) {
            console.log('[Auth] No token provided');
            return res.status(401).json({
                success: false,
                message: 'No token provided'
            });
        }

        // 验证 token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        console.log('[Auth] Token decoded:', {
            id: decoded.id,
            email: decoded.email,
            is_admin: decoded.is_admin
        });
        
        // 获取用户信息
        const user = await User.findOne({
            where: { id: decoded.id },
            attributes: ['id', 'email', 'is_admin', 'points', 'referral_code', 'username']
        });

        if (!user) {
            console.log('[Auth] User not found:', { id: decoded.id });
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        console.log('[Auth] User info retrieved:', {
            id: user.id,
            email: user.email,
            is_admin: user.is_admin
        });

        res.json({
            success: true,
            user
        });
    } catch (error) {
        console.error('[Auth] Error getting user info:', error);
        res.status(401).json({
            success: false,
            message: 'Invalid token'
        });
    }
});

// 验证令牌
router.get('/verify-token', authenticateToken, async (req, res) => {
    try {
        console.log('[Auth] Verifying token');
        
        // 验证 token
        const token = req.headers['authorization'].split(' ')[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        console.log('[Auth] Token decoded:', {
            id: decoded.id,
            email: decoded.email,
            is_admin: decoded.is_admin,
            exp: new Date(decoded.exp * 1000).toISOString()
        });
        
        // 获取用户信息
        const user = await User.findOne({
            where: { id: decoded.id },
            attributes: ['id', 'email', 'is_admin', 'points', 'referral_code', 'username']
        });

        if (!user) {
            console.log('[Auth] User not found:', { id: decoded.id });
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        console.log('[Auth] Token verification successful:', {
            id: user.id,
            email: user.email,
            is_admin: user.is_admin
        });

        return res.json({
            success: true,
            user: {
                id: user.id,
                email: user.email,
                is_admin: user.is_admin,
                points: user.points,
                referral_code: user.referral_code,
                username: user.username
            }
        });
    } catch (error) {
        console.error('[Auth] Token verification failed:', error);
        return res.status(401).json({
            success: false,
            message: 'Invalid token'
        });
    }
});

module.exports = router;
