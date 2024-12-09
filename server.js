const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
require('dotenv').config();
const jwt = require('jsonwebtoken');
const UserService = require('./services/UserService');

const app = express();

// 中间件
app.use(cors({
    origin: 'https://w3router.github.io',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Origin'],
    exposedHeaders: ['Access-Control-Allow-Origin'],
    preflightContinue: false,
    optionsSuccessStatus: 204
}));

// 添加额外的 CORS 头
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', 'https://w3router.github.io');
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Allow-Methods', 'GET,HEAD,PUT,PATCH,POST,DELETE');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    next();
});