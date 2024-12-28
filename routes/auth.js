const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { User } = require('../models');  
const { router: referralRouter, processReferral } = require('./referral');
const { authenticateToken } = require('../middleware/auth');

// 注册
router.post('/register', async (req, res) => {
    try {
        console.log('Registration request received:', {
            body: req.body,
            headers: req.headers
        });

        const { email, password, referralCode } = req.body;
        
        // 检查必需字段
        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Email and password are required'
            });
        }

        // 检查邮箱格式
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid email format'
            });
        }

        // 检查密码长度
        if (password.length < 6) {
            return res.status(400).json({
                success: false,
                message: 'Password must be at least 6 characters long'
            });
        }

        // 检查邮箱是否已存在
        const existingUser = await User.findOne({ where: { email } });
        if (existingUser) {
            return res.status(400).json({
                success: false,
                message: 'Email already registered'
            });
        }

        // 创建新用户
        const hashedPassword = await bcrypt.hash(password, 10);
        const user = await User.create({
            email,
            password: hashedPassword,
            referredBy: referralCode // Store the referral code used during registration
        });

        // 处理推荐码关系
        if (referralCode) {
            await processReferral(user.id, referralCode);
        }

        // 生成 JWT
        const token = jwt.sign(
            { id: user.id, email: user.email },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.status(201).json({
            success: true,
            message: 'Registration successful',
            token,
            user: {
                id: user.id,
                email: user.email,
                isAdmin: user.isAdmin,
                points: user.points,
                referralCode: user.referralCode
            }
        });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({
            success: false,
            message: 'Registration failed',
            error: error.message
        });
    }
});

// 登录
router.post('/login', async (req, res) => {
    console.log('Login request received:', {
        body: req.body,
        headers: req.headers
    });

    try {
        const { email, password } = req.body;

        // 验证必需字段
        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Email and password are required'
            });
        }

        // 查找用户
        const user = await User.findOne({ where: { email } });
        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'Invalid email or password'
            });
        }

        // 验证密码
        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
            return res.status(401).json({
                success: false,
                message: 'Invalid email or password'
            });
        }

        // 生成 JWT，包含 isAdmin 状态
        const token = jwt.sign(
            { 
                id: user.id, 
                email: user.email,
                isAdmin: user.isAdmin 
            },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );

        // 返回用户信息和 token
        res.json({
            success: true,
            message: 'Login successful',
            token,
            user: {
                id: user.id,
                email: user.email,
                isAdmin: user.isAdmin,
                points: user.points,
                referralCode: user.referralCode
            }
        });
    } catch (error) {
        console.error('Login error:', error);
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
        // 从请求头获取 token
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];

        if (!token) {
            return res.status(401).json({
                success: false,
                message: 'No token provided'
            });
        }

        // 验证 token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        // 获取用户信息
        const user = await User.findOne({
            where: { id: decoded.id },
            attributes: ['id', 'email', 'isAdmin', 'points', 'referralCode']
        });

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        res.json({
            success: true,
            user
        });
    } catch (error) {
        console.error('Error getting user info:', error);
        res.status(401).json({
            success: false,
            message: 'Invalid token'
        });
    }
});

// 验证令牌
router.get('/verify-token', authenticateToken, async (req, res) => {
    try {
        // 验证 token
        const token = req.headers['authorization'].split(' ')[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        console.log('Token decoded:', {
            id: decoded.id,
            exp: new Date(decoded.exp * 1000).toISOString()
        });
        
        // 获取用户信息
        const user = await User.findOne({
            where: { id: decoded.id },
            attributes: ['id', 'email', 'isAdmin', 'points', 'referralCode']
        });

        if (!user) {
            console.log('User not found for token:', decoded.id);
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Debug: 打印用户验证数据
        console.log('Token verification successful for user:', {
            id: user.id,
            email: user.email,
            isAdmin: user.isAdmin,
            points: user.points
        });

        return res.json({
            success: true,
            user: {
                id: user.id,
                email: user.email,
                isAdmin: user.isAdmin,
                points: user.points,
                referralCode: user.referralCode
            }
        });
    } catch (error) {
        console.error('Token verification failed:', error);
        return res.status(401).json({
            success: false,
            message: 'Invalid token'
        });
    }
});

module.exports = router;
