const express = require('express');
const path = require('path');
const UserService = require('./services/UserService');
const mongoose = require('mongoose');

const app = express();

// 中间件
app.use(express.json());
app.use(express.static('public'));

// 页面路由
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/auth', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'auth', 'login.html'));
});

app.get('/auth/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'auth', 'login.html'));
});

app.get('/auth/register', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'auth', 'register.html'));
});

// API 路由
app.post('/auth/api/register', async (req, res) => {
    try {
        const { username, email, password } = req.body;
        const userId = await UserService.createUser(username, email, password);
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

app.post('/auth/api/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        // 验证用户
        const user = await UserService.verifyUser(email, password);
        
        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'Invalid email or password'
            });
        }

        // 登录成功
        res.json({
            success: true,
            message: 'Login successful',
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                points: user.points
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// 数据库连接
mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log('MongoDB connected'))
    .catch(err => console.error('MongoDB connection error:', err));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
