const chai = require('chai');
const chaiHttp = require('chai-http');
const expect = chai.expect;
const UserService = require('../services/UserService');
const { User, UserTask } = require('../models');
const bcrypt = require('bcryptjs');

chai.use(chaiHttp);

describe('UserService Tests', () => {
    let testUser;
    let testAdmin;

    before(async () => {
        // Clear test data
        await User.deleteMany({ email: /^test/ });
        
        // Create test admin
        const hashedPassword = await bcrypt.hash('admin123', 10);
        testAdmin = await User.create({
            email: 'testadmin@example.com',
            password: hashedPassword,
            isAdmin: true,
            referralCode: 'ADMIN123'
        });
    });

    describe('User Creation and Authentication', () => {
        it('should create a new user successfully', async () => {
            const userId = await UserService.createUser(
                'testuser@example.com',
                'password123'
            );
            expect(userId).to.exist;
            testUser = await User.findById(userId);
            expect(testUser.email).to.equal('testuser@example.com');
        });

        it('should not create user with existing email', async () => {
            try {
                await UserService.createUser(
                    'testuser@example.com',
                    'password123'
                );
                throw new Error('Should not reach here');
            } catch (error) {
                expect(error.message).to.equal('Email already exists');
            }
        });

        it('should verify user with correct credentials', async () => {
            const result = await UserService.verifyUser(
                'testuser@example.com',
                'password123'
            );
            expect(result).to.exist;
            expect(result.email).to.equal('testuser@example.com');
        });

        it('should not verify user with incorrect password', async () => {
            const result = await UserService.verifyUser(
                'testuser@example.com',
                'wrongpassword'
            );
            expect(result).to.be.null;
        });
    });

    describe('User Management', () => {
        it('should get all users', async () => {
            const users = await UserService.getAllUsers();
            expect(users).to.be.an('array');
            expect(users.length).to.be.at.least(2); // testUser and testAdmin
        });

        it('should get user by ID', async () => {
            const user = await UserService.getUserById(testUser._id);
            expect(user.email).to.equal('testuser@example.com');
        });

        it('should handle referral points correctly', async () => {
            const newUser = await UserService.createUser(
                'testreferral@example.com',
                'password123',
                testUser.referralCode
            );
            expect(newUser).to.exist;

            const referrer = await User.findById(testUser._id);
            expect(referrer.points).to.be.above(0);
        });
    });

    describe('User Tasks', () => {
        it('should create user task', async () => {
            const userTask = await UserTask.create({
                userId: testUser._id,
                taskId: 1,
                status: 'started'
            });
            expect(userTask).to.exist;
            expect(userTask.status).to.equal('started');
        });

        it('should update user task status', async () => {
            const userTask = await UserTask.findOne({ userId: testUser._id });
            userTask.status = 'completed';
            userTask.completedAt = new Date();
            await userTask.save();

            const updatedTask = await UserTask.findOne({ userId: testUser._id });
            expect(updatedTask.status).to.equal('completed');
            expect(updatedTask.completedAt).to.exist;
        });
    });

    after(async () => {
        // Cleanup
        await User.deleteMany({ email: /^test/ });
        await UserTask.deleteMany({ userId: { $in: [testUser._id, testAdmin._id] } });
    });
});
