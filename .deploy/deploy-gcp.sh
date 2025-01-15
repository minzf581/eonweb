#!/bin/bash

# 确保已设置项目ID和区域
if [ -z "$PROJECT_ID" ] || [ -z "$REGION" ]; then
    echo "请设置 PROJECT_ID 和 REGION 环境变量"
    exit 1
fi

# 构建和推送 Docker 镜像
echo "构建 Docker 镜像..."
docker build -t gcr.io/$PROJECT_ID/eon-protocol .

echo "推送镜像到 Google Container Registry..."
docker push gcr.io/$PROJECT_ID/eon-protocol

# 部署到 Cloud Run
echo "部署到 Cloud Run..."
gcloud run deploy eon-protocol \
    --image gcr.io/$PROJECT_ID/eon-protocol \
    --platform managed \
    --region $REGION \
    --allow-unauthenticated \
    --set-env-vars="NODE_ENV=production,CLOUD_SQL_CONNECTION_NAME=$PROJECT_ID:$REGION:eon-db,API_KEY=${API_KEY}" \
    --vpc-connector projects/$PROJECT_ID/locations/$REGION/connectors/vpc-connector

echo "部署完成！"
