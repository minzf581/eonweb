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
    "routes/users.js"
)

for file in "${required_files[@]}"; do
    if [ ! -f "$file" ]; then
        echo "Error: Required file $file not found!"
        exit 1
    fi
done

# 完全清理
echo "Performing complete cleanup..."
rm -rf node_modules
rm -rf .deploy
rm -f package-lock.json

# 清理所有未跟踪的文件
echo "Cleaning all untracked files..."
git clean -fdx

# 强制拉取最新更改
echo "Force pulling latest changes from GitHub..."
git fetch origin
git reset --hard origin/main

# 创建构建目录
echo "Creating build directory..."
mkdir -p .deploy

# 复制文件到构建目录
echo "Copying files to build directory..."
tar --exclude='.git' --exclude='.deploy' --exclude='node_modules' -cf - . | (cd .deploy && tar -xf -)

# 验证关键文件
echo "Verifying key files in build directory..."
for file in server.js app.js routes/proxy.js routes/points.js models/index.js routes/users.js; do
    if [ -f ".deploy/$file" ]; then
        echo "=== Verifying $file ==="
        echo "File size: $(wc -c < ".deploy/$file") bytes"
        echo "Line count: $(wc -l < ".deploy/$file")"
        echo "MD5 hash: $(md5sum ".deploy/$file" 2>/dev/null || md5 ".deploy/$file")"
        echo "Last modified: $(stat -f "%Sm" ".deploy/$file")"
        echo "Content preview (first 10 lines):"
        head -n 10 ".deploy/$file"
        echo "Content preview (lines 25-35):"
        sed -n '25,35p' ".deploy/$file"
        echo "----------------------------------------"
    else
        echo "ERROR: $file is missing!"
        exit 1
    fi
done

# 在构建目录中安装依赖
echo "Installing dependencies in build directory..."
cd .deploy
npm install --production --force

# 清理GCP缓存
echo "Cleaning up GCP cache..."
gcloud config set core/disable_file_logging true
gcloud config set core/pass_credentials_to_gsutil true

# 获取当前版本
current_version=$(gcloud app versions list --sort-by=~version.id --limit=1 --format="value(version.id)")
echo "Current serving version: $current_version"

# 从构建目录部署
echo "Deploying from build directory..."
gcloud config set app/cloud_build_timeout 1800
gcloud app deploy

# 设置流量到新版本
echo "Setting traffic to new version..."
new_version=$(gcloud app versions list --sort-by=~version.id --limit=1 --format="value(version.id)")
gcloud app services set-traffic default --splits=$new_version=1

# 清理旧版本
echo "Cleaning up old versions..."
if [ ! -z "$current_version" ] && [ "$current_version" != "$new_version" ]; then
    echo "Deleting old versions: $current_version"
    gcloud app versions delete $current_version
fi

# 清理构建目录
echo "Cleaning up build directory..."
cd ..
rm -rf .deploy

# 验证文件
echo "Verifying files in build directory..."
ls -la .deploy

# 验证points.js文件
echo "=== Verifying build points.js content ==="
ls -l .deploy/routes/points.js
echo "File size: $(wc -c < .deploy/routes/points.js) bytes"
echo "Line count: $(wc -l < .deploy/routes/points.js)"
echo "MD5 hash: $(md5sum .deploy/routes/points.js)"
echo "Content preview:"
head -n 10 .deploy/routes/points.js

echo "Deployment completed successfully"
