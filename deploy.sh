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

# 更新 app.yaml 中的环境变量
cat > app.yaml << EOF
runtime: nodejs18
env: standard
instance_class: F1

env_variables:
  NODE_ENV: "production"
  API_KEY: "${API_KEY}"
  JWT_SECRET: "${JWT_SECRET}"
  PROJECT_ID: "${PROJECT_ID}"
  REGION: "${REGION}"

automatic_scaling:
  target_cpu_utilization: 0.65
  min_instances: 1
  max_instances: 10

handlers:
  - url: /.*
    script: auto
    secure: always
EOF

# 构建和部署应用
echo "正在部署到 Google App Engine..."
gcloud app deploy app.yaml \
    --project=$PROJECT_ID \
    --quiet \
    --version=v1

echo "部署完成！"

# 显示部署后的 URL
echo "应用已部署到："
gcloud app browse --project=$PROJECT_ID
