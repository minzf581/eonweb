# IP代理后台 API 文档

## 概述

本文档描述了IP代理后台与积分系统之间的接口规范。通过这些接口，代理后台可以上报节点状态变更、查询统计信息，系统会自动计算和发放用户积分。

## 用户注册

用户注册需要使用系统提供的注册接口：

```http
POST /api/auth/register
Content-Type: application/json

{
    "username": "user123",
    "password": "password123",
    "email": "user@example.com",
    "referralCode": "REF123"  // 可选
}
```

## 状态上报

### 认证

所有接口都需要通过API密钥进行认证。

#### 认证方式
- 在HTTP请求头中添加 `X-API-Key` 字段
- 示例：`X-API-Key: your_api_key_here`

### 1. 上报节点状态

在以下情况下需要上报节点状态：
1. 节点状态发生变化时（上线或下线）
2. 节点持续在线超过24小时时（每日上报一次）

每次上报需要包含自上次上报以来的统计数据。

#### 请求
```http
POST /api/proxy/report/batch
Content-Type: application/json
X-API-Key: your_api_key_here
```

#### 请求体
```json
{
    "nodes": [
        {
            "deviceId": "unique_device_id",
            "username": "user123",        // 用户注册时使用的用户名
            "status": "online",           // online 或 offline
            "ipAddress": "1.2.3.4",
            "duration": 86400,            // 自上次上报以来的在线时长（秒）
            "traffic": {
                "upload": 1073741824,     // 自上次上报以来的上传流量（bytes）
                "download": 2147483648    // 自上次上报以来的下载流量（bytes）
            },
            "reportType": "daily"         // status_change: 状态变更, daily: 每日上报
        }
    ]
}
```

#### 响应
```json
{
    "code": 200,
    "message": "success",
    "data": {
        "syncTime": "2025-01-04T07:44:54.000Z",
        "processedNodes": 1,       // 成功处理的节点数
        "activeNodes": 1,          // 当前在线节点数
        "skippedNodes": 0          // 跳过的节点数（用户不存在）
    }
}
```

#### 字段说明
- deviceId: 设备唯一标识
- username: 用户注册时使用的用户名（必须）
- status: 节点状态，可选值：online/offline
- ipAddress: 节点IP地址
- duration: 自上次上报以来的在线时长（秒）
- traffic: 自上次上报以来的流量统计
  - upload: 上传流量（bytes）
  - download: 下载流量（bytes）
- reportType: 上报类型
  - status_change: 状态变更上报
  - daily: 每日定时上报

### 2. 获取节点统计信息

#### 请求
```http
GET /api/proxy/stats
X-API-Key: your_api_key_here
```

#### 响应
```json
{
    "code": 200,
    "message": "success",
    "data": [
        {
            "status": "online",
            "count": 100,
            "totalUploadBytes": 1024000000,    // 总上传流量，单位：bytes
            "totalDownloadBytes": 2048000000,  // 总下载流量，单位：bytes
            "totalOnlineTime": 3600            // 总在线时长，单位：秒
        },
        {
            "status": "offline",
            "count": 50,
            "totalUploadBytes": 512000000,
            "totalDownloadBytes": 1024000000,
            "totalOnlineTime": 1800
        }
    ]
}
```

## 积分计算规则

系统会根据以下规则自动计算和发放积分：

1. 在线时长积分
   - 每小时在线可获得1积分
   - 按秒计算，不足1小时按比例计算

2. 流量积分
   - 每GB上传流量可获得10积分
   - 每GB下载流量可获得5积分
   - 按实际流量计算，不足1GB按比例计算

## 错误码

| 错误码 | 描述 |
|--------|------|
| 200    | 成功 |
| 400    | 请求参数错误 |
| 401    | 认证失败 |
| 500    | 服务器内部错误 |

## 注意事项

1. 用户必须先通过系统注册接口注册
2. 状态上报时必须提供正确的用户名
3. 以下情况需要上报：
   - 节点状态变更（上线/下线）时
   - 节点持续在线超过24小时时（每日上报）
4. 每次上报都需要包含完整的统计数据（在线时长和流量）
5. API密钥不要泄露给第三方
6. 流量和时长数据应准确记录，避免重复计算
