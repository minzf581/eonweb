#!/bin/bash

# 从 GitHub 同步最新代码
echo "Pulling latest changes from GitHub..."
git pull origin main

if [ $? -ne 0 ]; then
    echo "Failed to pull from GitHub. Please resolve any conflicts and try again."
    exit 1
fi

# 部署新版本
echo "Deploying new version..."
gcloud app deploy --quiet

# 如果部署成功
if [ $? -eq 0 ]; then
    echo "Deployment successful. Cleaning up old versions..."
    
    # 获取当前服务的版本列表（按时间倒序排序，跳过正在服务的版本）
    VERSIONS=$(gcloud app versions list --sort-by=~version.id --filter="TRAFFIC_SPLIT=0" --format="value(version.id)")
    
    # 保留最新的3个版本，删除其他版本
    COUNT=0
    for VERSION in $VERSIONS; do
        COUNT=$((COUNT+1))
        if [ $COUNT -gt 3 ]; then
            echo "Deleting version $VERSION..."
            gcloud app versions delete $VERSION --quiet
        fi
    done
    
    echo "Cleanup completed."
else
    echo "Deployment failed. No cleanup needed."
fi
