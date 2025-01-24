const express = require('express');
const router = express.Router();
const { User } = require('../models');
const { authenticateToken } = require('../middleware/auth');
const crypto = require('crypto');
const { Op } = require('sequelize');
const bcrypt = require('bcryptjs');

// Middleware to check if user is admin
const isAdmin = (req, res, next) => {
    if (!req.user || !req.user.is_admin) {
        return res.status(403).json({
            success: false,
            message: 'Access denied. Admin privileges required.'
        });
    }
    next();
};

// Get system stats
router.get('/stats', authenticateToken, isAdmin, async (req, res) => {
    try {
        console.log('[Admin] Getting system stats. Requested by:', {
            id: req.user.id,
            email: req.user.email,
            is_admin: req.user.is_admin
        });

        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

        // Get total users count
        const total_users = await User.count();

        // Get new users today
        const new_users_today = await User.count({
            where: {
                created_at: {
                    [Op.gte]: today
                }
            }
        });

        console.log('[Admin] Stats retrieved:', {
            total_users,
            new_users_today
        });

        res.json({
            success: true,
            stats: {
                total_users,
                new_users_today
            }
        });
    } catch (error) {
        console.error('[Admin] Error getting stats:', error);
        res.status(500).json({
            success: false,
            message: 'Error getting system stats',
            error: error.message
        });
    }
});

// Get all users
router.get('/users', authenticateToken, isAdmin, async (req, res) => {
    try {
        console.log('[Admin] Getting all users. Requested by:', {
            id: req.user.id,
            email: req.user.email,
            is_admin: req.user.is_admin
        });

        const users = await User.findAll({
            attributes: ['id', 'email', 'points', 'referral_code', 'is_admin', 'created_at'],
            order: [['created_at', 'DESC']]
        });

        const formatted_users = users.map(user => ({
            id: user.id,
            email: user.email,
            points: user.points,
            referral_code: user.referral_code,
            is_admin: user.is_admin,
            created_at: user.created_at
        }));

        console.log(`[Admin] Retrieved ${users.length} users`);

        res.json({
            success: true,
            users: formatted_users
        });
    } catch (error) {
        console.error('[Admin] Error getting users:', error);
        res.status(500).json({
            success: false,
            message: 'Error getting users',
            error: error.message
        });
    }
});

// Create new user
router.post('/users', authenticateToken, isAdmin, async (req, res) => {
    try {
        console.log('[Admin] Creating new user. Requested by:', {
            id: req.user.id,
            email: req.user.email,
            is_admin: req.user.is_admin
        });

        const { email, password, is_admin } = req.body;

        // Validate required fields
        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Email and password are required'
            });
        }

        // Check if email already exists
        const existing_user = await User.findOne({ where: { email } });
        if (existing_user) {
            return res.status(400).json({
                success: false,
                message: 'Email already registered'
            });
        }

        // Generate referral code
        const referral_code = crypto.randomBytes(4).toString('hex');

        // Create user
        const user = await User.create({
            email,
            password,
            referral_code,
            is_admin: !!is_admin,
            points: 0
        });

        console.log('[Admin] User created successfully:', {
            id: user.id,
            email: user.email,
            is_admin: user.is_admin
        });

        res.status(201).json({
            success: true,
            message: 'User created successfully',
            user: {
                id: user.id,
                email: user.email,
                is_admin: user.is_admin,
                points: user.points,
                referral_code: user.referral_code,
                created_at: user.created_at
            }
        });
    } catch (error) {
        console.error('[Admin] Error creating user:', error);
        res.status(500).json({
            success: false,
            message: 'Error creating user',
            error: error.message
        });
    }
});

// Update user
router.put('/users/:id', authenticateToken, isAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;

        const user = await User.findByPk(id);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Update user fields
        const allowed_updates = ['email', 'points', 'is_admin'];
        Object.keys(updates).forEach(key => {
            if (allowed_updates.includes(key)) {
                user[key] = updates[key];
            }
        });

        await user.save();

        res.json({
            success: true,
            message: 'User updated successfully',
            user: {
                id: user.id,
                email: user.email,
                points: user.points,
                is_admin: user.is_admin,
                referral_code: user.referral_code,
                created_at: user.created_at
            }
        });
    } catch (error) {
        console.error('[Admin] Error updating user:', error);
        res.status(500).json({
            success: false,
            message: 'Error updating user',
            error: error.message
        });
    }
});

// 创建新的管理员账户
router.post('/create-admin', async (req, res) => {
    try {
        console.log('[Admin Create] Request received:', {
            headers: req.headers,
            body: req.body
        });

        const apiKey = req.headers['x-api-key'];
        if (apiKey !== process.env.API_KEY) {
            console.log('[Admin Create] Invalid API key');
            return res.status(401).json({
                success: false,
                message: 'Invalid API key'
            });
        }

        const { email = 'lewis@eon-protocol.com', password = 'admin123' } = req.body;
        
        // 生成推荐码
        const referralCode = crypto.randomBytes(4).toString('hex');

        // 哈希密码
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // 创建新管理员用户
        const admin = await User.create({
            email,
            username: email.split('@')[0],
            password: hashedPassword,
            is_admin: true,
            points: 0,
            credits: 0,
            referral_code: referralCode
        });

        console.log('[Admin Create] New admin user created successfully');
        res.json({ 
            success: true, 
            message: 'New admin user created successfully',
            admin: {
                email: admin.email,
                username: admin.username,
                is_admin: admin.is_admin
            }
        });
    } catch (error) {
        console.error('[Admin Create] Error creating admin user:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;
