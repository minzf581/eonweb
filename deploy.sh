#!/bin/bash
set -e

# 从 .env.production 加载环境变量
if [ -f .env.production ]; then
    export $(cat .env.production | grep -v '^#' | xargs)
fi

# 打印当前工作目录和环境变量
echo "Current working directory: $(pwd)"
echo "Deploying with API_KEY: ${API_KEY}"

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

# 验证文件复制
echo "Verifying file copy..."
diff -r --exclude='.git' --exclude='.deploy' --exclude='node_modules' . .deploy/ || true

# 验证关键文件
echo "Verifying key files in build directory..."
for file in server.js app.js routes/proxy.js routes/points.js models/index.js routes/users.js; do
    if [ -f ".deploy/$file" ]; then
        echo "=== Verifying $file ==="
        echo "File size: $(wc -c < ".deploy/$file") bytes"
        echo "Line count: $(wc -l < ".deploy/$file")"
        echo "MD5 hash: $(md5sum ".deploy/$file" 2>/dev/null || md5 ".deploy/$file")"
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

# 清理 GCP 缓存
echo "Cleaning up GCP cache..."
gcloud config set core/disable_file_logging true
gcloud config set core/pass_credentials_to_gsutil true

# 获取当前版本
current_version=$(gcloud app versions list --sort-by=~version.id --limit=1 --format="value(version.id)")
echo "Current serving version: $current_version"

# 从构建目录部署
echo "Deploying from build directory..."
gcloud config set app/cloud_build_timeout 1800
gcloud app deploy --no-cache --no-promote

# 验证新版本
echo "Verifying new version..."
new_version=$(gcloud app versions list --sort-by=~version.id --limit=1 --format="value(version.id)")
echo "New version: $new_version"

# 等待新版本启动
echo "Waiting for new version to start..."
sleep 30

# 检查新版本状态
echo "Checking new version status..."
gcloud app versions describe $new_version --format="value(servingStatus)"

# 如果检查通过，迁移流量
echo "Migrating traffic to new version..."
gcloud app services set-traffic default --splits=$new_version=1 --migrate

# 清理旧版本
if [ ! -z "$current_version" ] && [ "$current_version" != "$new_version" ]; then
    echo "Cleaning up old version: $current_version"
    gcloud app versions delete $current_version --quiet
fi

cd ..
rm -rf .deploy

echo "Deployment completed successfully"
