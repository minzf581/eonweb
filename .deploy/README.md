# EON Project

## 项目描述
EON Project 是 EON Protocol 的官方展示平台，提供项目详情展示、社区用户管理和积分系统等功能。作为 EON Protocol 生态系统的重要组成部分，本平台致力于为用户提供直观的项目信息和完善的社区管理体验。

## 技术栈
- 前端：HTML5, CSS3, JavaScript
- 后端服务：Express.js
- 认证系统：JWT
- 数据库：Google Cloud SQL (MySQL)
- 云服务：Google Cloud Platform (GCP)

## 主要功能
- EON Protocol 项目展示
  - 项目介绍与特性
  - 解决方案展示
  - 技术架构说明
- 社区管理系统
  - 用户注册与认证
  - 用户信息管理
  - 社区角色权限控制
- 积分系统
  - 用户积分管理
  - 积分规则配置
  - 积分历史记录
- 管理后台
  - 用户数据统计
  - 系统配置管理
  - 运营数据分析

## 部署说明

### GCP 部署
1. 在 Google Cloud Console 创建新项目
2. 配置 Cloud SQL：
   - 创建 MySQL 实例
   - 设置数据库用户和密码
   - 配置网络访问权限
3. 配置 Cloud Run 服务：
   - 设置容器镜像
   - 配置自动扩缩容
   - 设置环境变量
4. 设置域名映射：
   - 配置 SSL 证书
   - 设置自定义域名

### 环境变量配置
```bash
NODE_ENV=production
DB_HOST=your_cloud_sql_host
DB_USER=your_db_user
DB_PASSWORD=your_db_password
DB_NAME=your_db_name
JWT_SECRET=your_jwt_secret
API_VERSION=v1
POINTS_SYSTEM_CONFIG=default
```

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
│   ├── images/     # 图片资源
│   └── auth/       # 认证相关页面
├── server/         # 后端服务
│   ├── routes/     # API 路由
│   ├── models/     # 数据模型
│   └── middleware/ # 中间件
├── server.js       # Express 服务器入口
└── package.json    # 项目配置
```

## API 文档
详细的 API 文档请参考 [API.md](./API.md)

## 贡献指南
1. Fork 项目
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 提交 Pull Request

## 许可证
MIT License
