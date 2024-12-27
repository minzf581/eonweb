const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto'); // 导入 crypto 模块
const { User } = require('../models');  
const { processReferral } = require('./referral');
const authenticate = require('../middleware/auth');

// 注册
router.post('/register', async (req, res) => {
    const { email, password, referralCode } = req.body;
    
    try {
        console.log('Registration attempt:', {
            email,
            hasPassword: !!password,
            referralCode
        });
        
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
        console.log('Creating new user with email:', email);
        const newUser = await User.create({
            email,
            password,
            referralCode: referralCode || generatedReferralCode
        });
        
        console.log('User created successfully:', {
            id: newUser.id,
            email: newUser.email,
            referralCode: newUser.referralCode
        });
        
        // 如果有推荐码，处理推荐关系
        if (referralCode) {
            try {
                await processReferral(newUser, referralCode);
                console.log('Referral processed successfully');
            } catch (referralError) {
                console.error('Error processing referral:', referralError);
                // 继续执行，不影响用户注册
            }
        }
        
        // 生成JWT token
        const token = jwt.sign(
            { id: newUser.id, email: newUser.email },
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
        console.error('Error in registration:', error);
        console.error('Full error details:', {
            message: error.message,
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
        
        res.status(500).json({ 
            error: 'Registration failed',
            message: error.message,
            details: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
});

// 登录
router.post('/login', async (req, res) => {
    const { email, password } = req.body;
    
    try {
        console.log('Login attempt for:', email);
        console.log('Request body:', JSON.stringify(req.body));
        
        if (!email || !password) {
            console.log('Missing credentials');
            return res.status(400).json({ error: 'Email and password are required' });
        }
        
        // 查找用户
        console.log('Finding user with email:', email);
        const user = await User.findOne({ 
            where: { email },
            attributes: ['id', 'email', 'password', 'isAdmin'] // 只选择需要的字段
        });
        
        if (!user) {
            console.log('User not found:', email);
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        
        console.log('User found:', user.email);
        
        // 验证密码
        console.log('Verifying password for user:', email);
        const validPassword = await user.comparePassword(password);
        console.log('Password validation result:', validPassword);
        
        if (!validPassword) {
            console.log('Invalid password for user:', email);
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        
        console.log('Login successful for user:', email);
        
        // 生成JWT token
        const token = jwt.sign(
            { id: user.id, email: user.email },
            process.env.JWT_SECRET || 'your-secret-key',
            { expiresIn: '24h' }
        );
        
        // 返回用户信息（不包含密码）
        const userResponse = user.toJSON();
        delete userResponse.password;
        
        res.json({
            token,
            user: userResponse
        });
    } catch (error) {
        console.error('Error in login:', error);
        console.error('Stack trace:', error.stack);
        res.status(500).json({ 
            error: 'Login failed',
            message: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
});

// 验证Token
router.get('/verify-token', authenticate, (req, res) => {
    res.json({ valid: true, user: req.user });
});

module.exports = router;
