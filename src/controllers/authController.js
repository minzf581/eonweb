const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

exports.register = async (req, res) => {
    try {
        const { email, password, referralCode } = req.body;

        // 检查用户是否已存在
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ message: '该邮箱已被注册' });
        }

        // 创建新用户
        const hashedPassword = await bcrypt.hash(password, 10);
        const user = new User({
            email,
            password: hashedPassword,
            referralCode,
            role: 'user' // 默认为普通用户
        });

        await user.save();
        res.status(201).json({ message: '注册成功' });
    } catch (error) {
        res.status(500).json({ message: '服务器错误' });
    }
};

exports.login = async (req, res) => {
    try {
        const { email, password } = req.body;

        // 查找用户
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(400).json({ message: '用户不存在' });
        }

        // 验证密码
        const isValid = await bcrypt.compare(password, user.password);
        if (!isValid) {
            return res.status(400).json({ message: '密码错误' });
        }

        // 生成 JWT token
        const token = jwt.sign(
            { userId: user._id, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.json({
            token,
            role: user.role,
            redirectUrl: user.role === 'admin' ? '/admin' : '/dashboard'
        });
    } catch (error) {
        res.status(500).json({ message: '服务器错误' });
    }
}; 