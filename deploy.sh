#!/bin/bash

# 从 .env.production 加载环境变量
if [ -f .env.production ]; then
    export $(cat .env.production | grep -v '^#' | xargs)
fi

# 打印环境变量进行确认
echo "Deploying with API_KEY: ${API_KEY}"

# 确保已设置项目ID和区域
if [ -z "$PROJECT_ID" ] || [ -z "$REGION" ]; then
    echo "请设置 PROJECT_ID 和 REGION 环境变量"
    exit 1
fi

# 构建和部署应用
echo "正在部署到 Google App Engine..."
gcloud app deploy app.yaml \
    --project=$PROJECT_ID \
    --quiet \
    --version=v1 \
    --env-vars="NODE_ENV=production,\
API_KEY=${API_KEY},\
JWT_SECRET=${JWT_SECRET}"

echo "部署完成！"

# 删除 deploy-gcp.sh
rm -f deploy-gcp.sh

# 显示部署后的 URL
echo "应用已部署到："
gcloud app browse --project=$PROJECT_ID
