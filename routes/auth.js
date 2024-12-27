const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../db');
const { processReferral } = require('./referral');

// 注册
router.post('/api/auth/register', async (req, res) => {
    const { email, password, referralCode } = req.body;
    
    try {
        // 开始事务
        await db.query('BEGIN');
        
        // 检查邮箱是否已存在
        const existingUser = await db.query(
            'SELECT id FROM users WHERE email = $1',
            [email]
        );
        
        if (existingUser.rows.length > 0) {
            await db.query('ROLLBACK');
            return res.status(400).json({ error: 'Email already exists' });
        }
        
        // 加密密码
        const hashedPassword = await bcrypt.hash(password, 10);
        
        // 创建新用户
        const newUser = await db.query(
            'INSERT INTO users (email, password) VALUES ($1, $2) RETURNING id, email',
            [email, hashedPassword]
        );
        
        // 如果提供了推荐码，处理推荐关系
        if (referralCode) {
            const referralSuccess = await processReferral(newUser.rows[0].id, referralCode);
            if (!referralSuccess) {
                console.warn('Invalid referral code used:', referralCode);
            }
        }
        
        // 生成JWT token
        const token = jwt.sign(
            { id: newUser.rows[0].id, email: newUser.rows[0].email },
            process.env.JWT_SECRET || 'your-secret-key',  
            { expiresIn: '24h' }
        );
        
        // 提交事务
        await db.query('COMMIT');
        
        res.status(201).json({
            message: 'User registered successfully',
            token,
            user: { id: newUser.rows[0].id, email: newUser.rows[0].email }
        });
    } catch (error) {
        await db.query('ROLLBACK');
        console.error('Error in registration:', error);
        res.status(500).json({ error: 'Registration failed: ' + error.message });
    }
});

// 登录
router.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body;
    
    try {
        // 查找用户
        const result = await db.query(
            'SELECT id, email, password FROM users WHERE email = $1',
            [email]
        );
        
        if (result.rows.length === 0) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        
        const user = result.rows[0];
        
        // 验证密码
        const validPassword = await bcrypt.compare(password, user.password);
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
        res.status(500).json({ error: 'Login failed' });
    }
});

// 验证Token
router.get('/api/auth/verify-token', authenticate, (req, res) => {
    res.json({ valid: true, user: req.user });
});

module.exports = router;
