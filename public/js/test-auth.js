// 测试认证服务
async function testAuthService() {
    const authService = new AuthService();
    console.log('=== Starting Auth Service Tests ===');
    
    try {
        // 1. 测试登录
        console.log('\n1. Testing Login...');
        const loginResult = await authService.login('test@example.com', 'password123');
        console.log('Login successful:', loginResult);
        
        // 2. 验证 token 存储
        console.log('\n2. Checking Token Storage...');
        const token = authService.getToken();
        console.log('Token stored:', !!token);
        
        // 3. 获取用户信息
        console.log('\n3. Getting User Info...');
        const userInfo = await authService.getUserInfo();
        console.log('User info retrieved:', userInfo);
        
        // 4. 验证认证状态
        console.log('\n4. Checking Authentication Status...');
        const isAuthenticated = authService.isAuthenticated();
        console.log('Is authenticated:', isAuthenticated);
        
        // 5. 测试登出
        console.log('\n5. Testing Logout...');
        authService.logout();
        console.log('Logged out, checking auth status:', authService.isAuthenticated());
        
    } catch (error) {
        console.error('Test failed:', error.message);
        console.error('Full error:', error);
    }
}

// 创建测试页面内容
document.body.innerHTML = `
    <div style="padding: 20px; font-family: Arial, sans-serif;">
        <h1>Auth Service Test</h1>
        <div id="status" style="margin: 20px 0; padding: 10px; border: 1px solid #ccc;"></div>
        <button onclick="testAuthService()" style="padding: 10px 20px;">Run Tests</button>
        <div id="results" style="margin-top: 20px; white-space: pre-wrap;"></div>
    </div>
`;

// 重定向控制台输出到页面
const originalConsole = {
    log: console.log,
    error: console.error
};

function updateResults(message, isError = false) {
    const resultsDiv = document.getElementById('results');
    const line = document.createElement('div');
    line.style.color = isError ? 'red' : 'black';
    line.textContent = message;
    resultsDiv.appendChild(line);
}

console.log = (...args) => {
    originalConsole.log(...args);
    updateResults(args.map(arg => 
        typeof arg === 'object' ? JSON.stringify(arg, null, 2) : arg
    ).join(' '));
};

console.error = (...args) => {
    originalConsole.error(...args);
    updateResults(args.map(arg => 
        typeof arg === 'object' ? JSON.stringify(arg, null, 2) : arg
    ).join(' '), true);
};
