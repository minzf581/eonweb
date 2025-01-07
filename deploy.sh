#!/bin/bash
set -e

# 从 GitHub 同步最新代码
echo "Pulling latest changes from GitHub..."
git pull origin main

if [ $? -ne 0 ]; then
    echo "Failed to pull from GitHub. Please resolve any conflicts and try again."
    exit 1
fi

# 清理已存在的 Cloud SQL Proxy 进程
echo "Cleaning up existing Cloud SQL Proxy processes..."
pkill -f cloud_sql_proxy || true
sleep 2

# 下载并设置 Cloud SQL Proxy
echo "Setting up Cloud SQL Proxy..."
# Download and setup Cloud SQL Proxy if not exists
if [ ! -f cloud_sql_proxy ]; then
    curl -o cloud_sql_proxy https://storage.googleapis.com/cloud-sql-connectors/cloud-sql-proxy/v2.8.1/cloud-sql-proxy.linux.amd64
    chmod +x cloud_sql_proxy
fi

# 启动 Cloud SQL Proxy
echo "Starting Cloud SQL Proxy..."
./cloud_sql_proxy -instances=eonhome-445809:asia-southeast2:eon-db=tcp:5432 &
sleep 5  # Give proxy time to establish connection

# 设置环境变量
export NODE_ENV=production
export DB_HOST=localhost
export DB_PORT=5432
export DB_NAME=eon_protocol
export DB_USER=eonuser
export DB_PASSWORD=eonprotocol

# 运行数据库迁移
echo "Running database migrations..."
NODE_ENV=production npx sequelize-cli db:migrate

# 运行原生 SQL 迁移脚本
echo "Running SQL migrations..."
for sql_file in migrations/sql/*.sql; do
    if [ -f "$sql_file" ]; then
        PGPASSWORD=$DB_PASSWORD psql -h localhost -U $DB_USER -d $DB_NAME -f "$sql_file"
    fi
done

# 停止 Cloud SQL Proxy
echo "Stopping Cloud SQL Proxy..."
pkill -f cloud_sql_proxy || true
sleep 2

# 获取当前版本时间戳
TIMESTAMP=$(date +%Y%m%dt%H%M%S)
echo "Current serving version: $TIMESTAMP"

# 部署新版本
echo "Deploying new version..."
gcloud app deploy --quiet --version=$TIMESTAMP --promote

# 如果部署成功
if [ $? -eq 0 ]; then
    echo "Deployment successful."
    
    # 等待新版本完全启动并接管流量
    echo "Waiting for new version to stabilize..."
    sleep 30
    
    # 获取旧的服务版本（排除当前版本）
    OLD_SERVING_VERSIONS=$(gcloud app versions list --sort-by=~version.id --filter="TRAFFIC_SPLIT>0 AND NOT version.id=$TIMESTAMP" --format="value(version.id)")
    if [ ! -z "$OLD_SERVING_VERSIONS" ]; then
        echo "Cleaning up old serving versions: $OLD_SERVING_VERSIONS"
        gcloud app versions delete $OLD_SERVING_VERSIONS --quiet
    else
        echo "No old serving versions to clean up."
    fi
    
    # 获取旧版本
    OLD_VERSIONS=$(gcloud app versions list --sort-by=~version.id --filter="TRAFFIC_SPLIT=0" --format="value(version.id)")
    if [ ! -z "$OLD_VERSIONS" ]; then
        echo "Deleting versions: $OLD_VERSIONS"
        gcloud app versions delete $OLD_VERSIONS --quiet
    fi
    
    echo "Deployment and cleanup completed."
    
    # 获取新版本的URL
    NEW_VERSION_URL=$(gcloud app browse --no-launch-browser)
    echo "New version is available at: $NEW_VERSION_URL"
else
    echo "Deployment failed."
    exit 1
fi
