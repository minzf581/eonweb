const jwt = require('jsonwebtoken');
const { User } = require('../models');

const JWT_SECRET = process.env.JWT_SECRET || 'eon-protocol-secret-key-2024';

// 生成 JWT token
const generateToken = (user) => {
    return jwt.sign(
        { 
            id: user.id, 
            email: user.email, 
            role: user.role 
        },
        JWT_SECRET,
        { expiresIn: '7d' }
    );
};

// 验证 token 中间件
const authenticate = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: '未提供认证令牌' });
        }

        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, JWT_SECRET);

        const user = await User.findByPk(decoded.id);
        if (!user) {
            return res.status(401).json({ error: '用户不存在' });
        }

        if (user.status === 'suspended') {
            return res.status(403).json({ error: '账户已被暂停' });
        }

        req.user = user;
        next();
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ error: '令牌已过期' });
        }
        return res.status(401).json({ error: '无效的认证令牌' });
    }
};

// 角色检查中间件
const requireRole = (...roles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ error: '未认证' });
        }
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({ error: '无权限访问' });
        }
        next();
    };
};

// 检查是否是超级管理员
const requireAdmin = requireRole('admin');

// 检查是否是管理员（包括普通管理员）
const requireStaffOrAdmin = requireRole('staff', 'admin');

// 检查是否是企业用户（普通管理员也可以管理企业）
const requireCompany = requireRole('company', 'staff', 'admin');

// 检查是否是投资人
const requireInvestor = requireRole('investor', 'admin');

// 检查是否是普通管理员
const requireStaff = requireRole('staff');

// 可选认证（不强制）
const optionalAuth = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.split(' ')[1];
            const decoded = jwt.verify(token, JWT_SECRET);
            const user = await User.findByPk(decoded.id);
            if (user && user.status !== 'suspended') {
                req.user = user;
            }
        }
    } catch (error) {
        // 忽略错误，继续处理请求
    }
    next();
};

module.exports = {
    generateToken,
    authenticate,
    requireRole,
    requireAdmin,
    requireStaffOrAdmin,
    requireStaff,
    requireCompany,
    requireInvestor,
    optionalAuth,
    JWT_SECRET
};
