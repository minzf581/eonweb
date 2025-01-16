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

# 清理所有运行中的版本
echo "Cleaning up all running versions..."
running_versions=$(gcloud app versions list --service=default --format="value(version.id)")
if [ ! -z "$running_versions" ]; then
    echo "Found running versions: $running_versions"
    echo "Stopping all versions..."
    for version in $running_versions; do
        echo "Stopping version $version..."
        gcloud app versions stop $version --service=default --quiet || true
    done
    echo "Deleting all versions..."
    gcloud app versions delete $running_versions --service=default --quiet || true
fi

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
        
        # 特别检查 points.js 的路由定义
        if [[ "$file" == "routes/points.js" ]]; then
            echo "Checking route definitions in points.js..."
            echo "=== Route Definitions ==="
            grep -A 2 "router\." ".deploy/$file" || true
            echo "=== Function Definitions ==="
            grep -A 2 "const.*= *async.*=>" ".deploy/$file" || true
            
            # 验证路由处理函数
            echo "=== Verifying route handler exports ==="
            if ! grep -q "module.exports = router;" ".deploy/$file"; then
                echo "ERROR: Missing router export in points.js"
                exit 1
            fi
            if ! grep -q "const updatePoints = async" ".deploy/$file"; then
                echo "ERROR: Missing updatePoints handler in points.js"
                exit 1
            fi
            if ! grep -q "const getBalance = async" ".deploy/$file"; then
                echo "ERROR: Missing getBalance handler in points.js"
                exit 1
            fi
        fi
        
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

# 验证依赖安装
echo "Verifying dependencies..."
if [ ! -d "node_modules/express" ] || [ ! -d "node_modules/sequelize" ]; then
    echo "ERROR: Critical dependencies are missing!"
    exit 1
fi

# 清理 GCP 缓存
echo "Cleaning up GCP cache..."
gcloud config set core/disable_file_logging true
gcloud config set core/pass_credentials_to_gsutil true

# 从构建目录部署
echo "Deploying from build directory..."
gcloud config set app/cloud_build_timeout 1800
gcloud app deploy --no-cache

# 验证新版本
echo "Verifying new version..."
new_version=$(gcloud app versions list --service=default --sort-by=~version.id --limit=1 --format="value(version.id)")
echo "New version: $new_version"

# 等待新版本启动
echo "Waiting for new version to start..."
sleep 30

# 检查新版本状态
echo "Checking new version status..."
status=$(gcloud app versions describe $new_version --service=default --format="value(servingStatus)")
echo "New version status: $status"

if [ "$status" != "SERVING" ]; then
    echo "ERROR: New version is not serving!"
    echo "Checking logs for potential issues..."
    gcloud app logs tail --service=default --version=$new_version --limit=50
    exit 1
fi

# 验证新版本可访问性
echo "Verifying new version accessibility..."
app_url="https://${new_version}-dot-eonhome-445809.et.r.appspot.com"
echo "Testing URL: $app_url"
curl -s -o /dev/null -w "Response Code: %{http_code}\n" "$app_url"

# 确保只有新版本在运行
echo "Ensuring only new version is running..."
running_versions=$(gcloud app versions list --service=default --format="value(version.id)")
for version in $running_versions; do
    if [ "$version" != "$new_version" ]; then
        echo "Stopping and deleting old version: $version"
        gcloud app versions stop $version --service=default --quiet || true
        gcloud app versions delete $version --service=default --quiet || true
    fi
done

cd ..
rm -rf .deploy

echo "Deployment completed successfully"
echo "New version $new_version is now serving"
echo "You can view logs using: gcloud app logs tail -s default"
