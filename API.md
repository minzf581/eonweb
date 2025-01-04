# IP代理后台 API 文档

## 概述

本文档描述了IP代理后台与积分系统之间的接口规范。通过这些接口，代理后台可以上报节点状态、查询统计信息，系统会自动计算和发放用户积分。

## 认证

所有接口都需要通过API密钥进行认证。

### 认证方式
- 在HTTP请求头中添加 `X-API-Key` 字段
- 示例：`X-API-Key: your_api_key_here`

## 接口列表

### 1. 批量上报节点状态

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
            "status": "active",
            "bandwidth": {
                "upload": 10.5,    // 上传带宽，单位：MB/s
                "download": 20.3   // 下载带宽，单位：MB/s
            },
            "ipAddress": "1.2.3.4",
            "location": {          // 可选
                "country": "CN",
                "city": "Beijing"
            }
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
        "processedNodes": 1,
        "activeNodes": 1
    }
}
```

#### 字段说明
- deviceId: 设备唯一标识
- status: 节点状态，可选值：active/inactive
- bandwidth.upload: 上传带宽，单位：MB/s
- bandwidth.download: 下载带宽，单位：MB/s
- ipAddress: 节点IP地址
- location: 节点地理位置信息（可选）

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
            "status": "active",
            "count": 100,
            "totalUploadBytes": 1024000000,    // 总上传流量，单位：bytes
            "totalDownloadBytes": 2048000000,  // 总下载流量，单位：bytes
            "totalOnlineTime": 3600            // 总在线时长，单位：分钟
        },
        {
            "status": "inactive",
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
   - 按分钟计算，不足1小时按比例计算

2. 流量积分
   - 每GB上传流量可获得10积分
   - 每GB下载流量可获得5积分
   - 按实际流量计算，不足1GB按比例计算

## 用户关联规则

系统通过以下方式将节点与用户关联：

1. 根据节点IP地址匹配最近的带宽共享记录
2. 如果找到匹配记录，则将节点关联到对应用户
3. 只有成功关联到用户的节点才会获得积分

## 错误码

| 错误码 | 描述 |
|--------|------|
| 200    | 成功 |
| 400    | 请求参数错误 |
| 401    | 认证失败 |
| 500    | 服务器内部错误 |

## 注意事项

1. 建议每5分钟上报一次节点状态
2. 单次请求最多可包含1000个节点
3. 节点状态变更（active/inactive）应及时上报
4. API密钥不要泄露给第三方
5. 流量和带宽数据应准确记录，避免重复计算
