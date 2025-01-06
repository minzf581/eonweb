const express = require('express');
const router = express.Router();
const { User, Task, Settings } = require('../models');
const { Op } = require('sequelize');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { authenticateToken, isAdmin } = require('../middleware/auth');

// Apply authentication and admin check to all routes
router.use(authenticateToken);
router.use(isAdmin);

// Get admin statistics
router.get('/stats', async (req, res) => {
    try {
        console.log('[Admin API] Getting stats, user:', {
            id: req.user.id,
            email: req.user.email,
            isadmin: req.user.isadmin
        });

        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);

        const [totalusers, activeusers, totaltasks, currenttasks] = await Promise.all([
            User.count(),
            User.count({
                where: {
                    updatedat: {
                        [Op.gte]: yesterday
                    }
                }
            }),
            Task.count({
                where: {
                    status: {
                        [Op.in]: ['active', 'completed']
                    }
                }
            }),
            Task.count({
                where: {
                    status: 'active',
                    isactive: true
                }
            })
        ]);

        const stats = {
            totalusers,
            activeusers,
            totaltasks,
            currenttasks,
            currenttaskpercentage: totaltasks > 0 ? (currenttasks / totaltasks * 100).toFixed(1) : 0,
            userparticipationrate: totalusers > 0 ? (activeusers / totalusers * 100).toFixed(1) : 0
        };

        console.log('[Admin API] Stats:', stats);
        res.json(stats);
    } catch (error) {
        console.error('[Admin API] Error getting stats:', error);
        res.status(500).json({ 
            success: false,
            error: 'Failed to load stats',
            details: error.message 
        });
    }
});

// Get all users
router.get('/users', async (req, res) => {
    try {
        console.log('[Admin API] Getting all users, requested by:', {
            id: req.user.id,
            email: req.user.email,
            isadmin: req.user.isadmin
        });

        const users = await User.findAll({
            attributes: ['id', 'email', 'points', 'referralcode', 'isadmin', 'createdat'],
            order: [['createdat', 'DESC']]
        });

        res.json({
            success: true,
            users: users.map(user => ({
                id: user.id,
                email: user.email,
                points: user.points,
                referralcode: user.referralcode,
                isadmin: user.isadmin,
                createdat: user.createdat
            }))
        });
    } catch (error) {
        console.error('[Admin API] Error getting users:', error);
        res.status(500).json({
            success: false,
            message: 'Error getting users',
            error: error.message
        });
    }
});

// Add new user
router.post('/users', async (req, res) => {
    try {
        console.log('[Admin API] Creating user, requested by:', {
            id: req.user.id,
            email: req.user.email,
            isadmin: req.user.isadmin
        });

        const { email, password, isadmin } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Email and password are required'
            });
        }

        const existingUser = await User.findOne({
            where: { email }
        });

        if (existingUser) {
            return res.status(400).json({
                success: false,
                message: 'Email already registered'
            });
        }

        const referralcode = crypto.randomBytes(4).toString('hex');

        const user = await User.create({
            email,
            password,
            referralcode,
            isadmin: !!isadmin,
            points: 0
        });

        console.log('[Admin API] User created:', {
            id: user.id,
            email: user.email,
            isadmin: user.isadmin
        });

        res.status(201).json({
            success: true,
            message: 'User created successfully',
            user: {
                id: user.id,
                email: user.email,
                isadmin: user.isadmin,
                points: user.points,
                referralcode: user.referralcode,
                createdat: user.createdat
            }
        });
    } catch (error) {
        console.error('[Admin API] Error creating user:', error);
        res.status(500).json({
            success: false,
            message: 'Error creating user',
            error: error.message
        });
    }
});

// Get all tasks
router.get('/tasks', async (req, res) => {
    try {
        console.log('[Admin API] Getting tasks');
        const tasks = await Task.findAll({
            attributes: ['id', 'title', 'description', 'points', 'type', 'status', 'startdate', 'isactive'],
            order: [['createdat', 'DESC']]
        });
        
        console.log('[Admin API] Found tasks:', tasks.length);
        res.json(tasks);
    } catch (error) {
        console.error('[Admin API] Error getting tasks:', error);
        res.status(500).json({ 
            success: false,
            error: 'Failed to load task list',
            details: error.message 
        });
    }
});

// Get system settings
router.get('/settings', async (req, res) => {
    try {
        console.log('[Admin API] Getting settings, user:', {
            id: req.user.id,
            email: req.user.email,
            isadmin: req.user.isadmin
        });

        const settings = await Settings.findAll();
        console.log('[Admin API] Found settings:', settings.length);
        res.json(settings);
    } catch (error) {
        console.error('[Admin API] Error getting settings:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Update system settings
router.post('/settings', async (req, res) => {
    try {
        console.log('[Admin API] Updating settings, user:', {
            id: req.user.id,
            email: req.user.email,
            isadmin: req.user.isadmin
        });

        const { referralpoints, taskpoints } = req.body;
        
        await Settings.upsert({
            key: 'referralpoints',
            value: referralpoints
        });
        
        await Settings.upsert({
            key: 'taskpoints',
            value: taskpoints
        });
        
        res.json({ success: true });
    } catch (error) {
        console.error('[Admin API] Error updating settings:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Delete user
router.delete('/users/:id', async (req, res) => {
    try {
        console.log('[Admin API] Deleting user, admin:', {
            id: req.user.id,
            email: req.user.email,
            isadmin: req.user.isadmin
        });

        const userid = req.params.id;

        // Prevent self-deletion
        if (userid === req.user.id.toString()) {
            return res.status(400).json({
                success: false,
                error: 'Cannot delete your own account'
            });
        }

        const user = await User.findByPk(userid);
        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'User not found'
            });
        }

        await user.destroy();
        console.log('[Admin API] User deleted:', { id: userid });

        res.json({
            success: true,
            message: 'User deleted successfully'
        });
    } catch (error) {
        console.error('[Admin API] Error deleting user:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to delete user',
            details: error.message
        });
    }
});

// Update user
router.patch('/users/:id', async (req, res) => {
    try {
        console.log('[Admin API] Updating user, admin:', {
            id: req.user.id,
            email: req.user.email,
            isadmin: req.user.isadmin
        });

        const userid = req.params.id;
        const updates = req.body;
        
        // Prevent updating sensitive fields
        delete updates.password;
        delete updates.email;
        
        const user = await User.findByPk(userid);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        await user.update(updates);
        res.json({
            success: true,
            user: {
                id: user.id,
                email: user.email,
                points: user.points,
                referralcode: user.referralcode,
                isadmin: user.isadmin,
                createdat: user.createdat,
                updatedat: user.updatedat
            }
        });
    } catch (error) {
        console.error('[Admin API] Error updating user:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get total number of users
router.get('/users/count', async (req, res) => {
    try {
        console.log('[Admin API] Getting users count');
        const count = await User.count();
        console.log('[Admin API] Users count:', count);
        res.json({ count });
    } catch (error) {
        console.error('[Admin API] Error getting users count:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to get users count',
            details: error.message 
        });
    }
});

// Get total number of tasks
router.get('/tasks/count', async (req, res) => {
    try {
        console.log('[Admin API] Getting tasks count');
        const count = await Task.count();
        console.log('[Admin API] Tasks count:', count);
        res.json({ count });
    } catch (error) {
        console.error('[Admin API] Error getting tasks count:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to get tasks count',
            details: error.message 
        });
    }
});

// Get number of completed tasks
router.get('/tasks/completed/count', async (req, res) => {
    try {
        console.log('[Admin API] Getting completed tasks count');
        const count = await Task.count({
            where: {
                status: 'completed'
            }
        });
        console.log('[Admin API] Completed tasks count:', count);
        res.json({ count });
    } catch (error) {
        console.error('[Admin API] Error getting completed tasks count:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to get completed tasks count',
            details: error.message 
        });
    }
});

module.exports = router;
