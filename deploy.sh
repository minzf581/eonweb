#!/bin/bash
set -e

# 从 .env.production 加载环境变量
if [ -f .env.production ]; then
    export $(cat .env.production | grep -v '^#' | xargs)
fi

# 打印当前工作目录和环境变量
echo "Current working directory: $(pwd)"
echo "Deploying with API_KEY: ${API_KEY}"

# 检查必要文件是否存在
echo "Verifying required files..."
required_files=(
    "app.yaml"
    "server.js"
    "package.json"
    "routes/proxy.js"
)

for file in "${required_files[@]}"; do
    if [ ! -f "$file" ]; then
        echo "Error: Required file $file not found!"
        exit 1
    fi
done

# 完全清理并重建
echo "Performing complete cleanup..."
rm -rf node_modules package-lock.json
rm -rf .gcloud .npm .config .build
npm cache clean --force

# 清理 Git 未跟踪的文件，但保留必要文件
echo "Cleaning untracked files..."
git clean -fdx -e cloud_sql_proxy -e .env.production

# 从 GitHub 强制同步最新代码
echo "Force pulling latest changes from GitHub..."
git fetch origin main
git reset --hard origin/main

if [ $? -ne 0 ]; then
    echo "Failed to pull from GitHub. Please resolve any conflicts and try again."
    exit 1
fi

# 检查 Git 状态
echo "Checking Git status..."
git status

# 安装依赖
echo "Installing dependencies..."
npm install
npm install --save-dev sequelize-cli

# 确保 .gcloudignore 正确配置
echo "Configuring .gcloudignore..."
cat > .gcloudignore << EOF
# Ignore development and version control files
.git
.gitignore
.env
.env.local
*.test.js
__tests__/
coverage/
.vscode/
.DS_Store

# Do NOT ignore these files
!routes/
!models/
!middleware/
!config/
!migrations/
!scripts/
!app.yaml
!package.json
!server.js
EOF

# 清理 GCP 缓存和构建文件
echo "Cleaning up GCP cache..."
rm -rf .gcloud
rm -rf .build
gcloud config set disable_file_logging true
gcloud config set pass_credentials_to_gsutil false

# 清理已存在的 Cloud SQL Proxy 进程
echo "Cleaning up existing Cloud SQL Proxy processes..."
pkill -f cloud_sql_proxy || true
sleep 2

# 下载并设置 Cloud SQL Proxy
echo "Setting up Cloud SQL Proxy..."
if [ ! -f cloud_sql_proxy ]; then
    curl -o cloud_sql_proxy https://storage.googleapis.com/cloud-sql-connectors/cloud-sql-proxy/v2.8.1/cloud-sql-proxy.linux.amd64
    chmod +x cloud_sql_proxy
fi

# 启动 Cloud SQL Proxy 并记录日志
echo "Starting Cloud SQL Proxy..."
./cloud_sql_proxy eonhome-445809:asia-southeast2:eon-db --port 5432 > proxy.log 2>&1 &
PROXY_PID=$!

# 等待代理启动
sleep 5

# 检查代理是否正在运行
if ! kill -0 $PROXY_PID 2>/dev/null; then
    echo "Failed to start Cloud SQL Proxy"
    cat proxy.log
    exit 1
fi

echo "Cloud SQL Proxy started successfully"

# 运行数据库迁移
echo "Running database migrations..."
NODE_ENV=production npx sequelize-cli db:migrate

# 停止 Cloud SQL Proxy
echo "Stopping Cloud SQL Proxy..."
pkill -f cloud_sql_proxy || true
sleep 2

# 获取当前版本时间戳
TIMESTAMP=$(date +%Y%m%dt%H%M%S)
echo "Current serving version: $TIMESTAMP"

# 列出将要部署的文件
echo "Files to be deployed:"
find . -type f -not -path "*/\.*" -not -path "*/node_modules/*" -not -name "*.md" -not -name "*.log"

# 强制重新部署，不使用缓存
echo "Deploying new version..."
gcloud app deploy --quiet --version=$TIMESTAMP --promote --no-cache --no-keep-archived-files

# 确保新版本接管所有流量
echo "Setting traffic to new version..."
gcloud app services set-traffic default --splits=$TIMESTAMP=1

# 验证部署
echo "Verifying deployment..."
gcloud app browse --no-launch-browser

# 清理旧版本
echo "Cleaning up old versions..."
OLD_VERSIONS=$(gcloud app versions list --sort-by=~version.id --filter="NOT version.id=$TIMESTAMP" --format="value(version.id)")
if [ ! -z "$OLD_VERSIONS" ]; then
    echo "Deleting old versions: $OLD_VERSIONS"
    gcloud app versions delete $OLD_VERSIONS --quiet
fi

echo "Deployment completed successfully"
