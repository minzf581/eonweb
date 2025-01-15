#!/bin/bash

# API测试脚本 - 认证测试专用
BASE_URL="https://eonhome-445809.et.r.appspot.com"
API_URL="${BASE_URL}/api"

# 颜色定义
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# 生成唯一的测试邮箱
TIMESTAMP=$(date +%s)
TEST_EMAIL="test_${TIMESTAMP}@example.com"
TEST_PASSWORD="Test123!@#"

echo "=== 认证测试开始 ==="
echo "测试邮箱: ${TEST_EMAIL}"
echo "测试密码: ${TEST_PASSWORD}"

# 1. 注册测试
echo -e "\n1. 执行注册测试..."
REGISTER_RESPONSE=$(curl -s -X POST "${API_URL}/auth/register" \
    -H "Content-Type: application/json" \
    -d '{
        "username": "testuser_'${TIMESTAMP}'",
        "email": "'${TEST_EMAIL}'",
        "password": "'${TEST_PASSWORD}'",
        "referralCode": ""
    }')
echo "注册响应:"
echo "$REGISTER_RESPONSE" | python3 -m json.tool

# 等待1秒确保注册完成
sleep 1

# 2. 登录测试
echo -e "\n2. 执行登录测试..."
LOGIN_RESPONSE=$(curl -s -X POST "${API_URL}/auth/login" \
    -H "Content-Type: application/json" \
    -d '{
        "email": "'${TEST_EMAIL}'",
        "password": "'${TEST_PASSWORD}'"
    }')
echo "登录响应:"
echo "$LOGIN_RESPONSE" | python3 -m json.tool

# 从登录响应中提取token
TOKEN=$(echo "$LOGIN_RESPONSE" | python3 -c "import sys, json; print(json.loads(sys.stdin.read()).get('token', ''))")
echo -e "\nToken: ${TOKEN}"

# 3. 验证用户信息（使用stats接口）
if [ ! -z "$TOKEN" ]; then
    echo -e "\n3. 获取用户统计信息..."
    STATS_RESPONSE=$(curl -s -X GET "${API_URL}/stats" \
        -H "Authorization: Bearer ${TOKEN}")
    echo "用户统计信息响应:"
    echo "$STATS_RESPONSE" | python3 -m json.tool

    # 4. 获取可用任务列表
    echo -e "\n4. 获取任务列表..."
    TASKS_RESPONSE=$(curl -s -X GET "${API_URL}/tasks" \
        -H "Authorization: Bearer ${TOKEN}")
    echo "任务列表响应:"
    echo "$TASKS_RESPONSE" | python3 -m json.tool

    # 5. 获取推荐信息
    echo -e "\n5. 获取推荐信息..."
    REFERRAL_RESPONSE=$(curl -s -X GET "${API_URL}/referral" \
        -H "Authorization: Bearer ${TOKEN}")
    echo "推荐信息响应:"
    echo "$REFERRAL_RESPONSE" | python3 -m json.tool
else
    echo -e "\n${RED}未能获取到token，跳过后续测试${NC}"
fi

echo -e "\n=== 认证测试完成 ==="
