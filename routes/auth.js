const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { User } = require('../models');  
const { processReferral } = require('./referral');

// 注册
router.post('/api/auth/register', async (req, res) => {
    const { email, password, referralCode } = req.body;
    
    try {
        // 检查邮箱是否已存在
        const existingUser = await User.findOne({ where: { email } });
        
        if (existingUser) {
            return res.status(400).json({ error: 'Email already exists' });
        }
        
        // 创建新用户
        const newUser = await User.create({
            email,
            password,  
            referralCode: referralCode || undefined
        });
        
        // 如果提供了推荐码，处理推荐关系
        if (referralCode) {
            const referralSuccess = await processReferral(newUser.id, referralCode);
            if (!referralSuccess) {
                console.warn('Invalid referral code used:', referralCode);
            }
        }
        
        // 生成JWT token
        const token = jwt.sign(
            { id: newUser.id, email: newUser.email },
            process.env.JWT_SECRET || 'your-secret-key',
            { expiresIn: '24h' }
        );
        
        res.status(201).json({
            message: 'User registered successfully',
            token,
            user: { id: newUser.id, email: newUser.email }
        });
    } catch (error) {
        console.error('Error in registration:', error);
        res.status(500).json({ error: 'Registration failed: ' + error.message });
    }
});

// 登录
router.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body;
    
    try {
        // 查找用户
        const user = await User.findOne({ where: { email } });
        
        if (!user) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        
        // 验证密码
        const validPassword = await user.comparePassword(password);
        if (!validPassword) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        
        // 生成JWT token
        const token = jwt.sign(
            { id: user.id, email: user.email },
            process.env.JWT_SECRET || 'your-secret-key',
            { expiresIn: '24h' }
        );
        
        res.json({
            token,
            user: { id: user.id, email: user.email }
        });
    } catch (error) {
        console.error('Error in login:', error);
        res.status(500).json({ error: 'Login failed: ' + error.message });
    }
});

// 验证Token
router.get('/api/auth/verify-token', authenticate, (req, res) => {
    res.json({ valid: true, user: req.user });
});

module.exports = router;
