const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
require('dotenv').config();
const jwt = require('jsonwebtoken');
const UserService = require('./services/UserService');

const app = express();

// 中间件
app.use(express.json());
app.use(cors({
    origin: 'https://w3router.github.io',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Origin']
}));

// 数据库连接
mongoose.connect(process.env.MONGODB_URI)
    .then(() => {
        console.log('MongoDB connected');
        
        // 只有在数据库连接成功后才启动服务器
        const PORT = process.env.PORT || 3000;
        app.listen(PORT, '0.0.0.0', () => {
            console.log(`Server is running on port ${PORT}`);
        });
    })
    .catch(err => {
        console.error('MongoDB connection error:', err);
        process.exit(1);  // 如果数据库连接失败，退出进程
    });

// API 路由
app.post('/auth/api/register', async (req, res) => {
    try {
        const { email, password } = req.body;
        const userId = await UserService.createUser(email, password);
        res.json({
            success: true,
            message: 'Registration successful',
            userId
        });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});