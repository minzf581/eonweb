const request = require('supertest');
const app = require('../app');
const { User, PointHistory } = require('../models');
const { expect } = require('chai');

describe('Points API', () => {
    let testUser;
    const testEmail = 'test@example.com';
    const apiKey = process.env.API_KEY;

    before(async () => {
        // Create test user
        testUser = await User.create({
            email: testEmail,
            password: 'password123',
            points: 0
        });
    });

    after(async () => {
        // Cleanup
        await PointHistory.destroy({ where: { userId: testUser.id } });
        await User.destroy({ where: { id: testUser.id } });
    });

    describe('POST /api/points/update', () => {
        it('should update points with IPv4', async () => {
            const response = await request(app)
                .post('/api/points/update')
                .set('X-API-Key', apiKey)
                .send({
                    email: testEmail,
                    points: 100,
                    ipv4: '192.168.1.1'
                });

            expect(response.status).to.equal(200);
            expect(response.body.success).to.be.true;
            expect(response.body.data.totalPoints).to.equal(100);
            expect(response.body.data.ipv4).to.equal('192.168.1.1');
        });

        it('should update points with IPv6', async () => {
            const response = await request(app)
                .post('/api/points/update')
                .set('X-API-Key', apiKey)
                .send({
                    email: testEmail,
                    points: 50,
                    ipv6: '2001:0db8:85a3:0000:0000:8a2e:0370:7334'
                });

            expect(response.status).to.equal(200);
            expect(response.body.success).to.be.true;
            expect(response.body.data.totalPoints).to.equal(150);
            expect(response.body.data.ipv6).to.equal('2001:0db8:85a3:0000:0000:8a2e:0370:7334');
        });

        it('should update points with both IPv4 and IPv6', async () => {
            const response = await request(app)
                .post('/api/points/update')
                .set('X-API-Key', apiKey)
                .send({
                    email: testEmail,
                    points: 75,
                    ipv4: '192.168.1.1',
                    ipv6: '2001:0db8:85a3:0000:0000:8a2e:0370:7334'
                });

            expect(response.status).to.equal(200);
            expect(response.body.success).to.be.true;
            expect(response.body.data.totalPoints).to.equal(225);
            expect(response.body.data.ipv4).to.equal('192.168.1.1');
            expect(response.body.data.ipv6).to.equal('2001:0db8:85a3:0000:0000:8a2e:0370:7334');
        });

        it('should reject invalid IPv4', async () => {
            const response = await request(app)
                .post('/api/points/update')
                .set('X-API-Key', apiKey)
                .send({
                    email: testEmail,
                    points: 100,
                    ipv4: '256.256.256.256'
                });

            expect(response.status).to.equal(400);
            expect(response.body.success).to.be.false;
            expect(response.body.errors).to.include('Invalid IPv4 address');
        });

        it('should reject invalid IPv6', async () => {
            const response = await request(app)
                .post('/api/points/update')
                .set('X-API-Key', apiKey)
                .send({
                    email: testEmail,
                    points: 100,
                    ipv6: 'invalid-ipv6'
                });

            expect(response.status).to.equal(400);
            expect(response.body.success).to.be.false;
            expect(response.body.errors).to.include('Invalid IPv6 address');
        });

        it('should reject request without IP addresses', async () => {
            const response = await request(app)
                .post('/api/points/update')
                .set('X-API-Key', apiKey)
                .send({
                    email: testEmail,
                    points: 100
                });

            expect(response.status).to.equal(400);
            expect(response.body.success).to.be.false;
            expect(response.body.errors).to.include('At least one IP address (IPv4 or IPv6) is required');
        });

        it('should reject request without API key', async () => {
            const response = await request(app)
                .post('/api/points/update')
                .send({
                    email: testEmail,
                    points: 100,
                    ipv4: '192.168.1.1'
                });

            expect(response.status).to.equal(401);
            expect(response.body.success).to.be.false;
        });
    });

    describe('GET /api/points/balance/:email', () => {
        it('should get points balance', async () => {
            const response = await request(app)
                .get(`/api/points/balance/${testEmail}`)
                .set('X-API-Key', apiKey);

            expect(response.status).to.equal(200);
            expect(response.body.success).to.be.true;
            expect(response.body.data.points).to.be.a('number');
        });

        it('should handle non-existent user', async () => {
            const response = await request(app)
                .get('/api/points/balance/nonexistent@example.com')
                .set('X-API-Key', apiKey);

            expect(response.status).to.equal(404);
            expect(response.body.success).to.be.false;
        });

        it('should reject request without API key', async () => {
            const response = await request(app)
                .get(`/api/points/balance/${testEmail}`);

            expect(response.status).to.equal(401);
            expect(response.body.success).to.be.false;
        });
    });
});
