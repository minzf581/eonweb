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
        // 检查邮箱是否已存在
        const existingUser = await User.findOne({ where: { email } });
        
        if (existingUser) {
            return res.status(400).json({ error: 'Email already exists' });
        }
        
        // 创建新用户
        const newUser = await User.create({
            email,
            password,
            referralCode: crypto.randomBytes(4).toString('hex')  // 为新用户生成唯一推荐码
        });
        
        // 如果提供了推荐码，处理推荐关系
        if (referralCode) {
            // 查找推荐人
            const referrer = await User.findOne({ where: { referralCode } });
            if (referrer) {
                // 更新被推荐用户的推荐人ID
                await newUser.update({ referredBy: referrer.id });
                
                // 给推荐人增加积分
                await referrer.increment('points', { by: 100 });  // 推荐人获得100积分
                
                // 给新用户增加积分
                await newUser.increment('points', { by: 50 });   // 新用户获得50积分
                
                console.log(`User ${referrer.email} successfully referred ${newUser.email}`);
            } else {
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
router.post('/login', async (req, res) => {
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
router.get('/verify-token', authenticate, (req, res) => {
    res.json({ valid: true, user: req.user });
});

module.exports = router;
