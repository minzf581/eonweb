#!/bin/bash

# 设置环境变量
export NODE_ENV=development
export PORT=3000

# 创建本地环境配置
cat > .env.local << EOL
# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=eon_protocol
DB_USER=postgres
DB_PASSWORD=postgres
DB_SSL=disabled

# Server Configuration
PORT=3000
JWT_SECRET=local_development_secret
FRONTEND_URL=http://localhost:3000
EOL

# 检查 PostgreSQL 是否正在运行
if ! pg_isready -h localhost -p 5432 > /dev/null 2>&1; then
    echo "Starting PostgreSQL..."
    brew services start postgresql@14
    sleep 5  # 等待 PostgreSQL 启动
fi

# 创建数据库（如果不存在）
psql -h localhost -U postgres -tc "SELECT 1 FROM pg_database WHERE datname = 'eon_protocol'" | grep -q 1 || psql -h localhost -U postgres -c "CREATE DATABASE eon_protocol"

# 运行数据库迁移
echo "Running database migrations..."
npx sequelize-cli db:migrate

# 运行数据库种子数据
echo "Running database seeds..."
npx sequelize-cli db:seed:all

# 启动开发服务器
echo "Starting development server..."
NODE_ENV=development node server-local.js
