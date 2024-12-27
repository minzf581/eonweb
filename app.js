const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const { router: authRoutes } = require('./routes/auth');
const { router: referralRoutes } = require('./routes/referral');
const tasksRoutes = require('./routes/tasks');
const statsRoutes = require('./routes/stats');

const app = express();

// 启用 CORS
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Origin', 'X-Requested-With', 'Content-Type', 'Accept', 'Authorization']
}));

// 日志中间件
app.use(morgan('dev'));

// 解析 JSON 请求体
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 静态文件服务
app.use(express.static('public'));

// 路由
app.use('/', authRoutes);  // authRoutes 已经包含了 /api/auth 前缀
app.use('/', referralRoutes);  // referralRoutes 已经包含了 /api/referral 前缀
app.use('/', tasksRoutes);  // tasksRoutes 已经包含了 /api/tasks 前缀
app.use('/', statsRoutes);  // statsRoutes 已经包含了 /api/stats 前缀

// 错误处理中间件
app.use((err, req, res, next) => {
    console.error('Error:', err);
    res.status(err.status || 500).json({
        error: process.env.NODE_ENV === 'development' ? err.message : 'Internal Server Error'
    });
});

const port = process.env.PORT || 8080;
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});

module.exports = app;
