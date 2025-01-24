#!/bin/bash

# 颜色定义
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# API 配置
API_URL="https://eonhome-445809.et.r.appspot.com/api"
API_KEY="eon-api-key-2024"

# 开启调试模式
set -x

# 测试结果统计
TOTAL_TESTS=0
PASSED_TESTS=0

# 辅助函数：打印测试结果
print_test_result() {
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    if [ $1 -eq 0 ]; then
        PASSED_TESTS=$((PASSED_TESTS + 1))
        echo -e "${GREEN}✓ $2 测试通过${NC}"
    else
        echo -e "${RED}✗ $2 测试失败${NC}"
    fi
}

# 1. 测试未带 API Key 的请求
echo "=== 测试未带 API Key ==="
echo "发送请求到: ${API_URL}/proxy/nodes/report"
RESPONSE=$(curl -v -X POST "${API_URL}/proxy/nodes/report" \
    -H "Content-Type: application/json" \
    -d '{"test": "data"}' 2>&1)
echo "完整响应: $RESPONSE"
if echo "$RESPONSE" | grep -q "API key not provided"; then
    print_test_result 0 "未带 API Key 测试"
else
    print_test_result 1 "未带 API Key 测试"
fi

# 2. 测试错误的 API Key
echo -e "\n=== 测试错误的 API Key ==="
RESPONSE=$(curl -v -X POST "${API_URL}/proxy/nodes/report" \
    -H "Content-Type: application/json" \
    -H "X-API-Key: wrong-api-key" \
    -d '{"test": "data"}' 2>&1)
echo "完整响应: $RESPONSE"
if echo "$RESPONSE" | grep -q "Invalid API key"; then
    print_test_result 0 "错误 API Key 测试"
else
    print_test_result 1 "错误 API Key 测试"
fi

# 3. 测试正确的 API Key
echo -e "\n=== 测试正确的 API Key ==="
RESPONSE=$(curl -v -X POST "${API_URL}/proxy/nodes/report" \
    -H "Content-Type: application/json" \
    -H "X-API-Key: ${API_KEY}" \
    -d '{
        "deviceId": "test_device_1",
        "username": "test_user",
        "status": "online",
        "ipAddress": "1.2.3.4",
        "duration": 0,
        "traffic": {
            "upload": 0,
            "download": 0
        },
        "reportType": "status_change"
    }' 2>&1)
echo "完整响应: $RESPONSE"
if echo "$RESPONSE" | grep -q "success.*true"; then
    print_test_result 0 "正确 API Key 测试"
else
    print_test_result 1 "正确 API Key 测试"
fi

# 4. 测试带 API Key 的 GET 请求
echo -e "\n=== 测试带 API Key 的 GET 请求 ==="
RESPONSE=$(curl -v -X GET "${API_URL}/proxy/nodes/test_device_1/stats" \
    -H "X-API-Key: ${API_KEY}" 2>&1)
echo "完整响应: $RESPONSE"
if [ ! -z "$RESPONSE" ]; then
    print_test_result 0 "GET 请求测试"
else
    print_test_result 1 "GET 请求测试"
fi

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