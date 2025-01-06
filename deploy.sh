#!/bin/bash

# 从 GitHub 同步最新代码
echo "Pulling latest changes from GitHub..."
git pull origin main

if [ $? -ne 0 ]; then
    echo "Failed to pull from GitHub. Please resolve any conflicts and try again."
    exit 1
fi

# 下载并设置 Cloud SQL Proxy
echo "Setting up Cloud SQL Proxy..."
wget https://dl.google.com/cloudsql/cloud_sql_proxy.linux.amd64 -O cloud_sql_proxy
chmod +x cloud_sql_proxy

# 启动 Cloud SQL Proxy
echo "Starting Cloud SQL Proxy..."
./cloud_sql_proxy -instances=eonhome-445809:asia-southeast2:eon-db=tcp:5432 &
PROXY_PID=$!

# 等待代理启动
sleep 5

# 设置环境变量
export DB_HOST=localhost
export DB_PORT=5432

# 运行数据库迁移
echo "Running database migrations..."
NODE_ENV=development npx sequelize-cli db:migrate

MIGRATION_STATUS=$?

# 停止 Cloud SQL Proxy
echo "Stopping Cloud SQL Proxy..."
kill $PROXY_PID

if [ $MIGRATION_STATUS -ne 0 ]; then
    echo "Database migration failed. Please check the error message above."
    exit 1
fi

# 获取当前正在服务的版本
SERVING_VERSION=$(gcloud app versions list --sort-by=~version.id --filter="TRAFFIC_SPLIT>0" --format="value(version.id)" | head -n 1)
echo "Current serving version: $SERVING_VERSION"

# 删除所有非服务版本
echo "Cleaning up old versions..."
OLD_VERSIONS=$(gcloud app versions list --sort-by=~version.id --filter="TRAFFIC_SPLIT=0" --format="value(version.id)")
if [ ! -z "$OLD_VERSIONS" ]; then
    echo "Deleting versions: $OLD_VERSIONS"
    gcloud app versions delete $OLD_VERSIONS --quiet
fi

# 部署新版本
echo "Deploying new version..."
gcloud app deploy --quiet

# 如果部署成功
if [ $? -eq 0 ]; then
    echo "Deployment successful."
    
    # 如果之前的服务版本存在，删除它
    if [ ! -z "$SERVING_VERSION" ]; then
        echo "Cleaning up previous serving version: $SERVING_VERSION"
        gcloud app versions delete $SERVING_VERSION --quiet
    fi
    
    echo "Deployment and cleanup completed."
    
    # 等待5秒让应用完全启动
    echo "Waiting for application to start..."
    sleep 5
    
    # 获取新版本的URL
    NEW_VERSION_URL=$(gcloud app browse --no-launch-browser)
    echo "New version is available at: $NEW_VERSION_URL"
else
    echo "Deployment failed."
    exit 1
fi
