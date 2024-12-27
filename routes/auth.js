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
    const { email, password } = req.body;
    
    try {
        console.log('Registration attempt for:', email);
        
        // 检查邮箱是否已存在
        const existingUser = await User.findOne({ where: { email } });
        
        if (existingUser) {
            console.log('Email already exists:', email);
            return res.status(400).json({ error: 'Email already exists' });
        }
        
        // 创建新用户
        const newUser = await User.create({
            email,
            password,
            referralCode: crypto.randomBytes(4).toString('hex')
        });
        
        console.log('User created successfully:', email);
        
        // 生成JWT token
        const token = jwt.sign(
            { id: newUser.id, email: newUser.email },
            process.env.JWT_SECRET || 'your-secret-key',
            { expiresIn: '24h' }
        );
        
        // 返回用户信息（不包含密码）
        const userResponse = newUser.toJSON();
        
        res.status(201).json({
            message: 'User registered successfully',
            token,
            user: userResponse
        });
    } catch (error) {
        console.error('Error in registration:', error);
        console.error('Stack trace:', error.stack);
        res.status(500).json({ error: 'Registration failed: ' + error.message });
    }
});

// 登录
router.post('/login', async (req, res) => {
    const { email, password } = req.body;
    
    try {
        console.log('Login attempt for:', email);
        
        if (!email || !password) {
            console.log('Missing credentials');
            return res.status(400).json({ error: 'Email and password are required' });
        }
        
        // 查找用户
        const user = await User.findOne({ 
            where: { email },
            attributes: ['id', 'email', 'password', 'isAdmin'] // 只选择需要的字段
        });
        
        if (!user) {
            console.log('User not found:', email);
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        
        // 验证密码
        console.log('Verifying password for user:', email);
        const validPassword = await user.comparePassword(password);
        
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
            message: error.message
        });
    }
});

// 验证Token
router.get('/verify-token', authenticate, (req, res) => {
    res.json({ valid: true, user: req.user });
});

module.exports = router;
