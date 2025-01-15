const request = require('supertest');
const app = require('../app');

const API_KEY = 'init-api-key-2025-01-06';

describe('Proxy API Tests', () => {
    // 测试未授权访问
    test('should reject requests without API key', async () => {
        const response = await request(app)
            .get('/proxy/stats');
        
        expect(response.status).toBe(401);
        expect(response.body.message).toBe('API密钥缺失');
    });

    // 测试节点状态批量上报
    test('should accept batch node status report', async () => {
        const testData = {
            nodes: [
                {
                    deviceId: 'test-device-001',
                    status: 'online',
                    traffic: {
                        upload: 1024 * 1024 * 100, // 100MB
                        download: 1024 * 1024 * 200 // 200MB
                    },
                    duration: 3600, // 1小时
                    timestamp: new Date().toISOString()
                }
            ]
        };

        const response = await request(app)
            .post('/proxy/report/batch')
            .set('X-API-Key', API_KEY)
            .send(testData);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
    });

    // 测试获取节点统计信息
    test('should get node statistics', async () => {
        const response = await request(app)
            .get('/proxy/stats')
            .set('X-API-Key', API_KEY);

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('totalNodes');
        expect(response.body).toHaveProperty('onlineNodes');
        expect(response.body).toHaveProperty('totalTraffic');
    });

    // 测试无效的API密钥
    test('should reject invalid API key', async () => {
        const response = await request(app)
            .get('/proxy/stats')
            .set('X-API-Key', 'invalid-key');

        expect(response.status).toBe(401);
        expect(response.body.message).toBe('API密钥无效');
    });

    // 测试批量上报数据验证
    test('should validate batch report data', async () => {
        const invalidData = {
            nodes: [
                {
                    // Missing required deviceId
                    status: 'online',
                    traffic: {
                        upload: 1024,
                        download: 1024
                    }
                }
            ]
        };

        const response = await request(app)
            .post('/proxy/report/batch')
            .set('X-API-Key', API_KEY)
            .send(invalidData);

        expect(response.status).toBe(400);
    });
});
