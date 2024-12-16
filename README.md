# EON Project

## Description
[项目描述]

## Installation

# EON Protocol Frontend

EON Protocol 的前端应用程序，使用 Express.js 托管静态文件。

## 部署说明

### Railway 部署
1. 在 Railway.app 创建新项目
2. 连接 GitHub 仓库
3. 设置环境变量：
   - `PORT`: Railway 会自动设置
   - `NODE_ENV`: production

### Namecheap 域名配置
1. 在 Railway 项目设置中找到域名信息
2. 在 Namecheap 的 Advanced DNS 设置中添加：
   - Type: CNAME
   - Host: @
   - Value: [Railway提供的域名]
   - TTL: Automatic

## 本地开发
```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 生产环境启动
npm start
```

## 项目结构
```
/
├── public/          # 静态文件
│   ├── js/         # JavaScript 文件
│   ├── css/        # 样式文件
│   └── auth/       # 认证相关页面
├── server.js       # Express 服务器
└── package.json    # 项目配置
