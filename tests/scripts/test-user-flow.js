import fetch from 'node-fetch';

const API_URL = 'http://localhost:3000';
let userToken = null;
let referralCode = null;

async function testUserFlow() {
    try {
        console.log('\n=== Starting User Flow Test ===\n');

        // 1. 注册第一个用户
        console.log('1. Registering first user...');
        const user1 = await registerUser('test1@example.com', 'password123');
        console.log('User 1 registered:', {
            email: user1.user.email,
            referralCode: user1.user.referralCode
        });
        referralCode = user1.user.referralCode;

        // 2. 使用第一个用户的推荐码注册第二个用户
        console.log('\n2. Registering second user with referral code...');
        const user2 = await registerUser('test2@example.com', 'password123', referralCode);
        console.log('User 2 registered:', {
            email: user2.user.email,
            referralCode: user2.user.referralCode
        });

        // 3. 登录第一个用户
        console.log('\n3. Logging in first user...');
        const loginResult = await login('test1@example.com', 'password123');
        userToken = loginResult.token;
        console.log('Login successful, token received');

        // 4. 获取用户信息
        console.log('\n4. Getting user info...');
        const userInfo = await getUserInfo();
        console.log('User info:', userInfo);

        // 5. 获取推荐信息
        console.log('\n5. Getting referral info...');
        const referralInfo = await getReferralInfo();
        console.log('Referral info:', referralInfo);

        // 6. 获取用户统计信息
        console.log('\n6. Getting user stats...');
        const userStats = await getUserStats();
        console.log('User stats:', userStats);

        // 7. 获取用户任务
        console.log('\n7. Getting user tasks...');
        const userTasks = await getUserTasks();
        console.log('User tasks:', userTasks);

        console.log('\n=== Test Completed Successfully ===\n');
    } catch (error) {
        console.error('\nTest failed:', error.message);
        if (error.response) {
            const errorBody = await error.response.text();
            console.error('Response body:', errorBody);
        }
    }
}

async function registerUser(email, password, referralCode = null) {
    const response = await fetch(`${API_URL}/auth/register`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email, password, referralCode })
    });

    if (!response.ok) {
        throw new Error(`Registration failed: ${response.status}`);
    }

    return await response.json();
}

async function login(email, password) {
    const response = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email, password })
    });

    if (!response.ok) {
        throw new Error(`Login failed: ${response.status}`);
    }

    return await response.json();
}

async function getUserInfo() {
    const response = await fetch(`${API_URL}/user`, {
        headers: {
            'Authorization': `Bearer ${userToken}`
        }
    });

    if (!response.ok) {
        throw new Error(`Failed to get user info: ${response.status}`);
    }

    return await response.json();
}

async function getReferralInfo() {
    const response = await fetch(`${API_URL}/api/users/referral-info`, {
        headers: {
            'Authorization': `Bearer ${userToken}`
        }
    });

    if (!response.ok) {
        throw new Error(`Failed to get referral info: ${response.status}`);
    }

    return await response.json();
}

async function getUserStats() {
    const response = await fetch(`${API_URL}/api/users/stats`, {
        headers: {
            'Authorization': `Bearer ${userToken}`
        }
    });

    if (!response.ok) {
        throw new Error(`Failed to get user stats: ${response.status}`);
    }

    return await response.json();
}

async function getUserTasks() {
    const response = await fetch(`${API_URL}/api/tasks/user`, {
        headers: {
            'Authorization': `Bearer ${userToken}`
        }
    });

    if (!response.ok) {
        throw new Error(`Failed to get user tasks: ${response.status}`);
    }

    return await response.json();
}

// 运行测试
testUserFlow();
