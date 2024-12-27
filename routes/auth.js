const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto'); 
const { User } = require('../models');  
const { processReferral } = require('./referral');
const authenticate = require('../middleware/auth');

// 注册
router.post('/api/auth/register', async (req, res) => {
    try {
        console.log('Registration request received:', {
            body: req.body,
            headers: req.headers
        });

        const { email, password, referralCode } = req.body;
        
        // 检查必需字段
        if (!email || !password) {
            console.log('Missing required fields');
            return res.status(400).json({ error: 'Email and password are required' });
        }
        
        // 检查邮箱是否已存在
        console.log('Checking if email exists:', email);
        const existingUser = await User.findOne({ where: { email } });
        
        if (existingUser) {
            console.log('Email already exists:', email);
            return res.status(400).json({ error: 'Email already exists' });
        }
        
        // 生成唯一的推荐码
        const generatedReferralCode = crypto.randomBytes(4).toString('hex');
        console.log('Generated referral code:', generatedReferralCode);
        
        // 创建新用户
        console.log('Creating new user:', {
            email,
            hasPassword: !!password,
            referralCode: referralCode || generatedReferralCode
        });

        const userData = {
            email,
            password,
            referralCode: referralCode || generatedReferralCode
        };

        // 如果提供了推荐码，验证它
        if (referralCode && referralCode.trim() !== '') {
            console.log('Checking referral code:', referralCode);
            const referrer = await User.findOne({ where: { referralCode } });
            if (referrer) {
                userData.referredBy = referrer.id;
            } else {
                console.log('Invalid referral code:', referralCode);
                return res.status(400).json({ error: 'Invalid referral code' });
            }
        }

        const newUser = await User.create(userData);
        
        console.log('User created successfully:', {
            id: newUser.id,
            email: newUser.email,
            referralCode: newUser.referralCode,
            referredBy: newUser.referredBy
        });
        
        // 生成JWT token
        const token = jwt.sign(
            { 
                id: newUser.id, 
                email: newUser.email,
                isAdmin: newUser.isAdmin
            },
            process.env.JWT_SECRET || 'your-secret-key',
            { expiresIn: '24h' }
        );
        
        // 返回用户信息（不包含密码）
        const userResponse = newUser.toJSON();
        
        console.log('Registration completed successfully');
        
        res.status(201).json({
            message: 'User registered successfully',
            token,
            user: userResponse
        });
    } catch (error) {
        console.error('Error in registration:', {
            error: error.message,
            stack: error.stack,
            name: error.name,
            code: error.code
        });
        
        // 根据错误类型返回适当的错误消息
        if (error.name === 'SequelizeUniqueConstraintError') {
            return res.status(400).json({ 
                error: 'Email or referral code already exists',
                details: error.errors.map(e => e.message)
            });
        }
        
        if (error.name === 'SequelizeValidationError') {
            return res.status(400).json({ 
                error: 'Validation error',
                details: error.errors.map(e => e.message)
            });
        }
        
        if (error.name === 'SequelizeConnectionError') {
            return res.status(500).json({ 
                error: 'Database connection error',
                message: 'Unable to connect to the database'
            });
        }
        
        res.status(500).json({ 
            error: 'Registration failed',
            message: process.env.NODE_ENV === 'development' ? error.message : 'An error occurred during registration'
        });
    }
});

// 登录
router.post('/api/auth/login', async (req, res) => {
    try {
        console.log('Login request received:', {
            body: req.body,
            headers: req.headers
        });

        const { email, password } = req.body;
        
        if (!email || !password) {
            console.log('Missing credentials');
            return res.status(400).json({ error: 'Email and password are required' });
        }
        
        // 查找用户
        console.log('Finding user with email:', email);
        const user = await User.findOne({ 
            where: { email }
        });
        
        if (!user) {
            console.log('User not found:', email);
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        
        console.log('User found:', {
            id: user.id,
            email: user.email,
            hasPassword: !!user.password
        });
        
        // 验证密码
        console.log('Verifying password for user:', email);
        try {
            const validPassword = await user.comparePassword(password);
            console.log('Password validation result:', validPassword);
            
            if (!validPassword) {
                console.log('Invalid password for user:', email);
                return res.status(401).json({ error: 'Invalid credentials' });
            }
        } catch (passwordError) {
            console.error('Error comparing passwords:', passwordError);
            throw passwordError;
        }
        
        console.log('Login successful for user:', email);
        
        // 生成JWT token
        const token = jwt.sign(
            { 
                id: user.id, 
                email: user.email,
                isAdmin: user.isAdmin
            },
            process.env.JWT_SECRET || 'your-secret-key',
            { expiresIn: '24h' }
        );
        
        // 返回用户信息（不包含密码）
        const userResponse = user.toJSON();
        
        res.json({
            token,
            user: userResponse
        });
    } catch (error) {
        console.error('Error in login:', {
            error: error.message,
            stack: error.stack,
            name: error.name,
            code: error.code
        });
        
        // 根据错误类型返回适当的错误消息
        if (error.name === 'SequelizeConnectionError') {
            return res.status(500).json({ 
                error: 'Database connection error',
                message: 'Unable to connect to the database'
            });
        }
        
        if (error.name === 'SequelizeValidationError') {
            return res.status(400).json({ 
                error: 'Validation error',
                details: error.errors.map(e => e.message)
            });
        }
        
        res.status(500).json({ 
            error: 'Login failed',
            message: process.env.NODE_ENV === 'development' ? error.message : 'An error occurred during login'
        });
    }
});

// 验证Token
router.get('/api/auth/verify-token', authenticate, (req, res) => {
    res.json({ valid: true, user: req.user });
});

module.exports = router;
