#!/bin/bash

# API测试脚本
BASE_URL="https://eonhome-445809.et.r.appspot.com"
API_URL="${BASE_URL}/api"  # 添加 /api 前缀
TOKEN=""  # 登录后需要设置这个值
API_KEY="your_api_key_here"  # 设置你的API密钥

# 颜色定义
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# 测试结果统计
TOTAL_TESTS=0
PASSED_TESTS=0

# 辅助函数
print_test_result() {
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    if [ $1 -eq 0 ]; then
        PASSED_TESTS=$((PASSED_TESTS + 1))
        echo -e "${GREEN}✓ $2 测试通过${NC}"
    else
        echo -e "${RED}✗ $2 测试失败${NC}"
    fi
}

# 生成唯一的测试用户名
TIMESTAMP=$(date +%s)
TEST_USERNAME="test_${TIMESTAMP}"
TEST_EMAIL="test_${TIMESTAMP}@example.com"
echo "使用测试用户名: ${TEST_USERNAME}"

# 1. 认证相关测试
echo "=== 认证测试 ==="

# 1.1 注册测试
echo "测试注册..."
REGISTER_RESPONSE=$(curl -s -X POST "${API_URL}/auth/register" \
    -H "Content-Type: application/json" \
    -d '{
        "username": "'${TEST_USERNAME}'",
        "email": "'${TEST_EMAIL}'",
        "password": "password123",
        "referralCode": ""
    }')
echo "Register Response: $REGISTER_RESPONSE"
print_test_result $? "用户注册"

# 等待一秒确保注册完成
sleep 1

# 1.2 登录测试
echo "测试登录..."
LOGIN_RESPONSE=$(curl -s -X POST "${API_URL}/auth/login" \
    -H "Content-Type: application/json" \
    -d '{
        "email": "'${TEST_EMAIL}'",
        "password": "password123"
    }')
echo "Login Response: $LOGIN_RESPONSE"
print_test_result $? "用户登录"

# 从登录响应中提取token
TOKEN=$(echo "$LOGIN_RESPONSE" | python3 -c "import sys, json; print(json.loads(sys.stdin.read()).get('token', ''))")
echo "Token: $TOKEN"

# 如果没有获取到token，退出测试
if [ -z "$TOKEN" ]; then
    echo "未能获取到token，退出测试"
    exit 1
fi

# 2. 代理节点状态上报测试
echo -e "\n=== 代理节点状态上报测试 ==="

# 2.1 节点上线
echo "测试节点上线上报..."
DEVICE_ID="test_device_${TIMESTAMP}"
curl -s -X POST "${API_URL}/proxy/report/batch" \
    -H "Content-Type: application/json" \
    -H "X-API-Key: ${API_KEY}" \
    -d '{
        "nodes": [{
            "deviceId": "'${DEVICE_ID}'",
            "username": "'${TEST_USERNAME}'",
            "status": "online",
            "ipAddress": "1.2.3.4",
            "duration": 0,
            "traffic": {
                "upload": 0,
                "download": 0
            },
            "reportType": "status_change"
        }]
    }'
print_test_result $? "节点上线上报"

# 等待2秒模拟在线时间
sleep 2

# 2.2 节点每日上报
echo "测试节点每日上报..."
curl -s -X POST "${API_URL}/proxy/report/batch" \
    -H "Content-Type: application/json" \
    -H "X-API-Key: ${API_KEY}" \
    -d '{
        "nodes": [{
            "deviceId": "'${DEVICE_ID}'",
            "username": "'${TEST_USERNAME}'",
            "status": "online",
            "ipAddress": "1.2.3.4",
            "duration": 86400,
            "traffic": {
                "upload": 1073741824,
                "download": 2147483648
            },
            "reportType": "daily"
        }]
    }'
print_test_result $? "节点每日上报"

# 2.3 节点下线
echo "测试节点下线上报..."
curl -s -X POST "${API_URL}/proxy/report/batch" \
    -H "Content-Type: application/json" \
    -H "X-API-Key: ${API_KEY}" \
    -d '{
        "nodes": [{
            "deviceId": "'${DEVICE_ID}'",
            "username": "'${TEST_USERNAME}'",
            "status": "offline",
            "ipAddress": "1.2.3.4",
            "duration": 3600,
            "traffic": {
                "upload": 536870912,
                "download": 1073741824
            },
            "reportType": "status_change"
        }]
    }'
print_test_result $? "节点下线上报"

# 2.4 获取节点统计
echo "测试获取节点统计..."
curl -s -X GET "${API_URL}/proxy/stats" \
    -H "X-API-Key: ${API_KEY}"
print_test_result $? "获取节点统计"

# 3. 任务相关测试
echo -e "\n=== 任务测试 ==="

# 3.1 获取可用任务列表
echo "获取任务列表..."
curl -s -X GET "${API_URL}/tasks" \
    -H "Authorization: Bearer ${TOKEN}"
print_test_result $? "获取任务列表"

# 3.2 开始任务
echo "开始任务..."
curl -s -X POST "${API_URL}/tasks/1/start" \
    -H "Authorization: Bearer ${TOKEN}"
print_test_result $? "开始任务"

# 4. 积分相关测试
echo -e "\n=== 积分测试 ==="

# 4.1 获取积分统计
echo "获取积分统计..."
curl -s -X GET "${API_URL}/stats" \
    -H "Authorization: Bearer ${TOKEN}"
print_test_result $? "获取积分统计"

# 5. 推荐相关测试
echo -e "\n=== 推荐测试 ==="

# 5.1 获取推荐信息
echo "获取推荐信息..."
curl -s -X GET "${API_URL}/referral" \
    -H "Authorization: Bearer ${TOKEN}"
print_test_result $? "获取推荐信息"

# 6. 带宽共享任务测试
echo -e "\n=== 带宽共享任务测试 ==="

# 6.1 创建带宽共享任务
echo "创建带宽共享任务..."
BANDWIDTH_TASK_RESPONSE=$(curl -s -X POST "${API_URL}/bandwidth" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer ${TOKEN}" \
    -d '{
        "uploadSpeed": 100,
        "downloadSpeed": 200,
        "ipAddress": "2001:0db8:85a3:0000:0000:8a2e:0370:7334",
        "duration": 60
    }')
print_test_result $? "创建带宽共享任务"

# 获取任务ID
TASK_ID=$(echo $BANDWIDTH_TASK_RESPONSE | grep -o '"id":[0-9]*' | cut -d':' -f2)

# 6.2 获取带宽任务列表
echo "获取带宽任务列表..."
curl -s -X GET "${API_URL}/bandwidth" \
    -H "Authorization: Bearer ${TOKEN}"
print_test_result $? "获取带宽任务列表"

# 6.3 获取特定带宽任务详情
echo "获取带宽任务详情..."
curl -s -X GET "${API_URL}/bandwidth/${TASK_ID}" \
    -H "Authorization: Bearer ${TOKEN}"
print_test_result $? "获取带宽任务详情"

# 6.4 启动带宽共享任务
echo "启动带宽共享任务..."
curl -s -X POST "${API_URL}/bandwidth/${TASK_ID}/start" \
    -H "Authorization: Bearer ${TOKEN}"
print_test_result $? "启动带宽共享任务"

# 等待几秒钟
sleep 3

# 6.5 停止带宽共享任务
echo "停止带宽共享任务..."
curl -s -X POST "${API_URL}/bandwidth/${TASK_ID}/stop" \
    -H "Authorization: Bearer ${TOKEN}"
print_test_result $? "停止带宽共享任务"

# 输出测试结果统计
echo -e "\n=== 测试结果统计 ==="
echo "总测试数: ${TOTAL_TESTS}"
echo "通过测试数: ${PASSED_TESTS}"
echo "失败测试数: $((TOTAL_TESTS - PASSED_TESTS))"

if [ ${TOTAL_TESTS} -eq ${PASSED_TESTS} ]; then
    echo -e "${GREEN}所有测试通过!${NC}"
    exit 0
else
    echo -e "${RED}有测试失败!${NC}"
    exit 1
fi
