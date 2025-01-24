#!/bin/bash
set -e

# 记录部署开始时间
deploy_timestamp=$(date '+%Y%m%d%H%M%S')
echo "Deployment started at: $deploy_timestamp"

# 从 .env.production 加载环境变量
if [ -f .env.production ]; then
    export $(cat .env.production | grep -v '^#' | xargs)
fi

# 打印当前工作目录和环境变量
echo "Current working directory: $(pwd)"
echo "Deploying with API_KEY: ${API_KEY}"

# 执行完整清理
echo "Performing complete cleanup..."
echo "Cleaning all untracked files..."
git clean -fdx

echo "Force pulling latest changes from GitHub..."
git fetch origin
git reset --hard origin/main

# 创建构建目录
echo "Creating build directory..."
rm -rf .deploy
mkdir -p .deploy

# 复制文件到构建目录
echo "Copying files to build directory..."
# 复制必需的文件
cp app.js server.js package.json package-lock.json app.yaml .deploy/ || echo "Some files not found"

# 验证 app.yaml 是否存在
if [ ! -f ".deploy/app.yaml" ]; then
    echo "ERROR: app.yaml not found!"
    exit 1
fi

# 复制必需的目录（如果存在）
for dir in models routes middleware config scripts; do
    if [ -d "$dir" ]; then
        echo "Copying directory: $dir"
        cp -r "$dir" .deploy/
    else
        echo "Directory not found: $dir"
    fi
done

# 复制public目录
if [ -d "public" ]; then
    echo "Copying directory: public"
    mkdir -p .deploy/public
    
    # 复制所有文件和目录，除了static/js
    for item in public/*; do
        if [ "$item" != "public/static" ]; then
            cp -r "$item" .deploy/public/
        fi
    done
    
    # 单独处理static/js目录
    if [ -d "public/static/js" ]; then
        echo "Copying JS files..."
        mkdir -p .deploy/public/static/js
        # 只复制authService.js
        cp public/static/js/authService.js .deploy/public/static/js/
    fi
    
    # 复制其他static目录
    if [ -d "public/static" ]; then
        for item in public/static/*; do
            if [ "$item" != "public/static/js" ]; then
                cp -r "$item" .deploy/public/static/
            fi
        done
    fi
fi

# 验证文件复制
echo "Verifying file copy..."
cd .deploy
npm install
cd ..

# 部署到 Google Cloud
echo "Deploying to Google Cloud..."
gcloud app deploy .deploy/app.yaml --quiet

# 验证部署状态
echo "Verifying deployment status..."
# 获取最新版本
new_version=$(gcloud app versions list --service=default --sort-by=~version.id --limit=1 --format="value(version.id)")
echo "[$(date '+%Y-%m-%d %H:%M:%S')] New version deployed: $new_version"

# 等待新版本启动
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Waiting for new version to start serving..."
sleep 30

# 检查版本状态
status=$(gcloud app versions describe $new_version --service=default --format="value(servingStatus)")
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Version status: $status"

if [ "$status" != "SERVING" ]; then
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] ERROR: New version is not serving!"
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Checking logs for potential issues..."
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] 检查最近日志..."
    echo "查找时间戳之后的日志: $deploy_timestamp"
    gcloud app logs tail -s default
    exit 1
fi

# 验证应用可访问性
app_url="https://eonhome-445809.et.r.appspot.com"
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Testing application URL: $app_url"
response_code=$(curl -s -o /dev/null -w "%{http_code}" "$app_url")
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Response code: $response_code"

if [ "$response_code" != "200" ]; then
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] WARNING: Application returned non-200 status code"
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Checking recent logs..."
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] 检查最近日志..."
    echo "查找时间戳之后的日志: $deploy_timestamp"
    gcloud app logs tail -s default
fi

# 检查日志中是否包含新的时间戳
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Verifying application logs..."
echo "Checking for logs with deployment timestamp: $deploy_timestamp"
recent_logs=$(gcloud app logs read --service=default --version=$new_version --limit=50)
if echo "$recent_logs" | grep -q "$deploy_timestamp"; then
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] SUCCESS: Found logs with current deployment timestamp"
else
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] WARNING: Could not find logs with current deployment timestamp"
    echo "Recent logs:"
    echo "$recent_logs"
fi

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Deployment verification complete!"
echo "[$(date '+%Y-%m-%d %H:%M:%S')] New version $new_version is now serving"
echo "Deployment complete!"
