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
rm -rf .gcloud .npm .config .build .deploy
npm cache clean --force

# 删除所有未跟踪的文件和目录
echo "Cleaning all untracked files..."
git clean -fdx

# 从 GitHub 强制同步最新代码
echo "Force pulling latest changes from GitHub..."
git fetch origin main
git reset --hard origin/main

# 创建临时构建目录
echo "Creating build directory..."
BUILD_DIR=".deploy"
rm -rf $BUILD_DIR
mkdir -p $BUILD_DIR

# 复制所需文件到构建目录
echo "Copying files to build directory..."
cp -r . $BUILD_DIR/
rm -rf $BUILD_DIR/.git $BUILD_DIR/.github $BUILD_DIR/node_modules

# 检查构建目录中的关键文件
echo "Verifying key files in build directory..."
for file in server.js app.js routes/proxy.js; do
    if [ -f "$BUILD_DIR/$file" ]; then
        echo "$file exists and has $(wc -l < $BUILD_DIR/$file) lines"
    else
        echo "Error: $file is missing in build directory!"
        exit 1
    fi
done

# 检查构建目录中的 server.js 内容
echo "=== Verifying build server.js content ==="
echo "File exists: $(ls -l $BUILD_DIR/server.js)"
echo "File size: $(wc -c < $BUILD_DIR/server.js) bytes"
echo "Line count: $(wc -l < $BUILD_DIR/server.js)"
echo "MD5 hash: $(md5 $BUILD_DIR/server.js)"
echo "Content preview:"
head -n 10 $BUILD_DIR/server.js

# 在构建目录中安装依赖
echo "Installing dependencies in build directory..."
cd $BUILD_DIR
npm install --production
cd ..

# 清理 GCP 缓存和构建文件
echo "Cleaning up GCP cache..."
rm -rf .gcloud .build
gcloud config set disable_file_logging true
gcloud config set pass_credentials_to_gsutil false

# 获取当前版本时间戳
TIMESTAMP=$(date +%Y%m%dt%H%M%S)
echo "Current serving version: $TIMESTAMP"

# 从构建目录部署
echo "Deploying from build directory..."
cd $BUILD_DIR
gcloud config set app/cloud_build_timeout 1800
gcloud app deploy app.yaml --quiet --version=$TIMESTAMP --promote --no-cache
cd ..

# 确保新版本接管所有流量并完全迁移
echo "Setting traffic to new version..."
gcloud app services set-traffic default --splits=$TIMESTAMP=1 --migrate

# 删除所有旧版本
echo "Cleaning up old versions..."
OLD_VERSIONS=$(gcloud app versions list --sort-by=~version.id --filter="NOT version.id=$TIMESTAMP" --format="value(version.id)")
if [ ! -z "$OLD_VERSIONS" ]; then
    echo "Deleting old versions: $OLD_VERSIONS"
    gcloud app versions delete $OLD_VERSIONS --quiet
fi

# 清理构建目录
echo "Cleaning up build directory..."
rm -rf $BUILD_DIR

# 验证构建目录中的文件
echo "Verifying files in build directory..."
ls -la $BUILD_DIR
echo "Content of server.js in build directory:"
cat $BUILD_DIR/server.js | wc -l

echo "Deployment completed successfully"
