const express = require('express');
const path = require('path');
const pool = require('./config/database');
const UserService = require('./services/userService');

const app = express();

// 中间件
app.use(express.json());
app.use(express.static('public'));

// 测试数据库连接
async function testConnection() {
    try {
        const connection = await pool.getConnection();
        console.log('Database connected successfully!');
        connection.release();
    } catch (error) {
        console.error('Database connection failed:', error);
    }
}

testConnection();

// 测试注册路由
app.get('/test-register', async (req, res) => {
    try {
        const userId = await UserService.createUser(
            'testuser', 
            'test@example.com', 
            'password123'
        );
        res.json({
            success: true,
            message: `User registered with ID: ${userId}`
        });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
