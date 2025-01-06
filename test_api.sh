#!/bin/bash

# API测试脚本
BASE_URL="https://eonhome-445809.et.r.appspot.com"
API_URL="${BASE_URL}/api"  # 添加 /api 前缀
TOKEN=""  # 登录后需要设置这个值
API_KEY="proxy_api_key_d1e8a37b5c4f9"  # 默认测试API密钥

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
echo "发送注册请求到: ${API_URL}/auth/register"
REGISTER_RESPONSE=$(curl -s -k --tlsv1.2 --http1.1 -X POST "${API_URL}/auth/register" \
    -H "Content-Type: application/json" \
    -H "Content-Length: 0" \
    -d '{
        "email": "'${TEST_EMAIL}'",
        "password": "password123",
        "referralCode": ""
    }' 2>&1)
echo "Register Response: $REGISTER_RESPONSE"

# 检查是否包含错误信息
if echo "$REGISTER_RESPONSE" | grep -q "Could not resolve host\|Connection refused\|No route to host"; then
    echo "注册请求失败: 无法连接到服务器"
    exit 1
fi

# 提取实际的响应内容（去除 curl 的调试输出）
RESPONSE_BODY=$(echo "$REGISTER_RESPONSE" | grep -v "^*\|^>\|^<\|^}\|^{" || true)
echo "Response Body: $RESPONSE_BODY"

# 尝试解析 JSON
if [ -n "$REGISTER_RESPONSE" ]; then
    REGISTER_SUCCESS=$(echo "$REGISTER_RESPONSE" | python3 -c "import sys, json; response = json.loads(sys.stdin.read()); print('true' if response.get('success') else 'false')" 2>/dev/null || echo "false")
    if [ "$REGISTER_SUCCESS" = "true" ]; then
        print_test_result 0 "用户注册"
    else
        print_test_result 1 "用户注册"
        echo "注册失败，退出测试"
        exit 1
    fi
else
    echo "注册响应为空"
    print_test_result 1 "用户注册"
    exit 1
fi

# 等待一秒确保注册完成
sleep 1

# 1.2 登录测试
echo "测试登录..."
LOGIN_RESPONSE=$(curl -s -k --tlsv1.2 --http1.1 -X POST "${API_URL}/auth/login" \
    -H "Content-Type: application/json" \
    -H "Content-Length: 0" \
    -d '{
        "email": "'${TEST_EMAIL}'",
        "password": "password123"
    }')
echo "Login Response: $LOGIN_RESPONSE"
LOGIN_SUCCESS=$(echo "$LOGIN_RESPONSE" | python3 -c "import sys, json; response = json.loads(sys.stdin.read()); print('true' if response.get('success') else 'false')")
if [ "$LOGIN_SUCCESS" = "true" ]; then
    print_test_result 0 "用户登录"
else
    print_test_result 1 "用户登录"
    echo "登录失败，退出测试"
    exit 1
fi

# 从登录响应中提取token
TOKEN=$(echo "$LOGIN_RESPONSE" | python3 -c "import sys, json; response = json.loads(sys.stdin.read()); print(response.get('token', '') if response.get('success') else '')")
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
curl -s -k --tlsv1.2 --http1.1 -X POST "${API_URL}/proxy/report/batch" \
    -H "Content-Type: application/json" \
    -H "Content-Length: 0" \
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
curl -s -k --tlsv1.2 --http1.1 -X POST "${API_URL}/proxy/report/batch" \
    -H "Content-Type: application/json" \
    -H "Content-Length: 0" \
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
curl -s -k --tlsv1.2 --http1.1 -X POST "${API_URL}/proxy/report/batch" \
    -H "Content-Type: application/json" \
    -H "Content-Length: 0" \
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
curl -s -k --tlsv1.2 --http1.1 -X GET "${API_URL}/proxy/stats" \
    -H "X-API-Key: ${API_KEY}"
print_test_result $? "获取节点统计"

# 3. 任务相关测试
echo -e "\n=== 任务测试 ==="

# 3.1 获取可用任务列表
echo "获取任务列表..."
curl -s -k --tlsv1.2 --http1.1 -X GET "${API_URL}/tasks" \
    -H "Authorization: Bearer ${TOKEN}"
print_test_result $? "获取任务列表"

# 3.2 开始任务
echo "开始任务..."
TASK_ID=1
TASK_START_RESPONSE=$(curl -s -k --tlsv1.2 --http1.1 -X POST "${API_URL}/tasks/${TASK_ID}/start" \
    -H "Authorization: Bearer ${TOKEN}" \
    -H "Content-Type: application/json" \
    -H "Content-Length: 0")
echo "$TASK_START_RESPONSE"
print_test_result $? "开始任务"

# 4. 积分相关测试
echo -e "\n=== 积分测试 ==="

# 4.1 获取积分统计
echo "获取积分统计..."
curl -s -k --tlsv1.2 --http1.1 -X GET "${API_URL}/stats" \
    -H "Authorization: Bearer ${TOKEN}"
print_test_result $? "获取积分统计"

# 5. 推荐相关测试
echo -e "\n=== 推荐测试 ==="

# 5.1 获取推荐信息
echo "获取推荐信息..."
curl -s -k --tlsv1.2 --http1.1 -X GET "${API_URL}/referral" \
    -H "Authorization: Bearer ${TOKEN}"
print_test_result $? "获取推荐信息"

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
