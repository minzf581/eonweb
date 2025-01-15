const axios = require('axios');
const { expect } = require('chai');
require('dotenv').config({ path: '.env.production' });

const API_BASE_URL = 'https://eonhome-445809.as.r.appspot.com';  // GCP App Engine URL
const API_KEY = process.env.API_KEY;

describe('Points API (Production)', () => {
    const testEmail = 'test@example.com';

    describe('POST /api/points/update', () => {
        it('should update points with IPv4', async () => {
            const response = await axios.post(`${API_BASE_URL}/api/points/update`, {
                email: testEmail,
                points: 100,
                ipv4: '192.168.1.1'
            }, {
                headers: {
                    'X-API-Key': API_KEY,
                    'Content-Type': 'application/json'
                }
            });

            expect(response.status).to.equal(200);
            expect(response.data.success).to.be.true;
            expect(response.data.data.totalPoints).to.be.a('number');
            expect(response.data.data.ipv4).to.equal('192.168.1.1');
        });

        it('should update points with IPv6', async () => {
            const response = await axios.post(`${API_BASE_URL}/api/points/update`, {
                email: testEmail,
                points: 50,
                ipv6: '2001:0db8:85a3:0000:0000:8a2e:0370:7334'
            }, {
                headers: {
                    'X-API-Key': API_KEY,
                    'Content-Type': 'application/json'
                }
            });

            expect(response.status).to.equal(200);
            expect(response.data.success).to.be.true;
            expect(response.data.data.totalPoints).to.be.a('number');
            expect(response.data.data.ipv6).to.equal('2001:0db8:85a3:0000:0000:8a2e:0370:7334');
        });

        it('should update points with both IPv4 and IPv6', async () => {
            const response = await axios.post(`${API_BASE_URL}/api/points/update`, {
                email: testEmail,
                points: 75,
                ipv4: '192.168.1.1',
                ipv6: '2001:0db8:85a3:0000:0000:8a2e:0370:7334'
            }, {
                headers: {
                    'X-API-Key': API_KEY,
                    'Content-Type': 'application/json'
                }
            });

            expect(response.status).to.equal(200);
            expect(response.data.success).to.be.true;
            expect(response.data.data.totalPoints).to.be.a('number');
            expect(response.data.data.ipv4).to.equal('192.168.1.1');
            expect(response.data.data.ipv6).to.equal('2001:0db8:85a3:0000:0000:8a2e:0370:7334');
        });

        it('should reject invalid IPv4', async () => {
            try {
                await axios.post(`${API_BASE_URL}/api/points/update`, {
                    email: testEmail,
                    points: 100,
                    ipv4: '256.256.256.256'
                }, {
                    headers: {
                        'X-API-Key': API_KEY,
                        'Content-Type': 'application/json'
                    }
                });
                throw new Error('Should have failed');
            } catch (error) {
                expect(error.response.status).to.equal(400);
                expect(error.response.data.success).to.be.false;
                expect(error.response.data.errors).to.include('Invalid IPv4 address');
            }
        });

        it('should reject invalid IPv6', async () => {
            try {
                await axios.post(`${API_BASE_URL}/api/points/update`, {
                    email: testEmail,
                    points: 100,
                    ipv6: 'invalid-ipv6'
                }, {
                    headers: {
                        'X-API-Key': API_KEY,
                        'Content-Type': 'application/json'
                    }
                });
                throw new Error('Should have failed');
            } catch (error) {
                expect(error.response.status).to.equal(400);
                expect(error.response.data.success).to.be.false;
                expect(error.response.data.errors).to.include('Invalid IPv6 address');
            }
        });

        it('should reject request without IP addresses', async () => {
            try {
                await axios.post(`${API_BASE_URL}/api/points/update`, {
                    email: testEmail,
                    points: 100
                }, {
                    headers: {
                        'X-API-Key': API_KEY,
                        'Content-Type': 'application/json'
                    }
                });
                throw new Error('Should have failed');
            } catch (error) {
                expect(error.response.status).to.equal(400);
                expect(error.response.data.success).to.be.false;
                expect(error.response.data.errors).to.include('At least one IP address (IPv4 or IPv6) is required');
            }
        });

        it('should reject request without API key', async () => {
            try {
                await axios.post(`${API_BASE_URL}/api/points/update`, {
                    email: testEmail,
                    points: 100,
                    ipv4: '192.168.1.1'
                });
                throw new Error('Should have failed');
            } catch (error) {
                expect(error.response.status).to.equal(401);
                expect(error.response.data.success).to.be.false;
            }
        });
    });

    describe('GET /api/points/balance/:email', () => {
        it('should get points balance', async () => {
            const response = await axios.get(`${API_BASE_URL}/api/points/balance/${testEmail}`, {
                headers: {
                    'X-API-Key': API_KEY
                }
            });

            expect(response.status).to.equal(200);
            expect(response.data.success).to.be.true;
            expect(response.data.data.points).to.be.a('number');
        });

        it('should handle non-existent user', async () => {
            try {
                await axios.get(`${API_BASE_URL}/api/points/balance/nonexistent@example.com`, {
                    headers: {
                        'X-API-Key': API_KEY
                    }
                });
                throw new Error('Should have failed');
            } catch (error) {
                expect(error.response.status).to.equal(404);
                expect(error.response.data.success).to.be.false;
            }
        });

        it('should reject request without API key', async () => {
            try {
                await axios.get(`${API_BASE_URL}/api/points/balance/${testEmail}`);
                throw new Error('Should have failed');
            } catch (error) {
                expect(error.response.status).to.equal(401);
                expect(error.response.data.success).to.be.false;
            }
        });
    });
});
