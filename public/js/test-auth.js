// 测试认证服务
async function testAuthService() {
    const resultDiv = document.getElementById('results');
    const statusDiv = document.getElementById('status');
    
    function log(message, data = null) {
        const line = document.createElement('div');
        line.style.marginBottom = '10px';
        line.style.fontFamily = 'monospace';
        
        if (typeof message === 'string') {
            if (message.startsWith('===')) {
                line.style.fontWeight = 'bold';
                line.style.color = '#0066cc';
            }
            line.textContent = message;
        } else {
            line.textContent = JSON.stringify(message, null, 2);
        }
        
        if (data) {
            const dataDiv = document.createElement('div');
            dataDiv.style.marginLeft = '20px';
            dataDiv.style.marginTop = '5px';
            dataDiv.style.whiteSpace = 'pre';
            dataDiv.textContent = JSON.stringify(data, null, 2);
            line.appendChild(dataDiv);
        }
        
        resultDiv.appendChild(line);
    }

    async function makeRequest(url, options = {}) {
        const response = await fetch(url, {
            ...options,
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            }
        });

        const responseData = await response.json();
        
        if (!response.ok) {
            throw new Error(`Request failed: ${responseData.message || response.statusText}`);
        }
        
        return responseData;
    }

    try {
        resultDiv.innerHTML = '';
        statusDiv.textContent = 'Running tests...';
        log('=== Starting Auth Service Tests ===\n');

        // 1. 测试登录
        log('\n1. Testing Login...');
        const loginData = await makeRequest('http://localhost:8080/api/auth/login', {
            method: 'POST',
            body: JSON.stringify({
                email: 'test@example.com',
                password: 'password123'
            })
        });
        log('Login response:', loginData);

        // 2. 获取用户信息
        log('\n2. Getting User Info...');
        const userData = await makeRequest('http://localhost:8080/api/user');
        log('User info:', userData);

        // 3. 测试登出
        log('\n3. Testing Logout...');
        const logoutData = await makeRequest('http://localhost:8080/api/auth/logout', {
            method: 'POST'
        });
        log('Logout response:', logoutData);

        // 测试成功
        statusDiv.textContent = '✅ All tests completed successfully!';
        statusDiv.style.backgroundColor = '#d4edda';
        statusDiv.style.color = '#155724';
        statusDiv.style.padding = '10px';
        statusDiv.style.borderRadius = '4px';
        statusDiv.style.fontWeight = 'bold';
    } catch (error) {
        // 测试失败
        log('❌ Test failed: ' + error.message);
        
        if (error.stack) {
            const stackDiv = document.createElement('div');
            stackDiv.style.marginTop = '10px';
            stackDiv.style.color = '#721c24';
            stackDiv.style.fontFamily = 'monospace';
            stackDiv.style.whiteSpace = 'pre';
            stackDiv.textContent = error.stack;
            resultDiv.appendChild(stackDiv);
        }
        
        statusDiv.textContent = '❌ Tests failed!';
        statusDiv.style.backgroundColor = '#f8d7da';
        statusDiv.style.color = '#721c24';
        statusDiv.style.padding = '10px';
        statusDiv.style.borderRadius = '4px';
        statusDiv.style.fontWeight = 'bold';
    }
}

// 创建测试页面内容
document.addEventListener('DOMContentLoaded', () => {
    const resultsDiv = document.getElementById('results');
    if (!resultsDiv) {
        const div = document.createElement('div');
        div.id = 'results';
        div.style.margin = '20px';
        div.style.padding = '10px';
        div.style.border = '1px solid #ccc';
        document.body.appendChild(div);
    }
    const statusDiv = document.getElementById('status');
    if (!statusDiv) {
        const div = document.createElement('div');
        div.id = 'status';
        div.style.margin = '20px';
        div.style.padding = '10px';
        div.style.border = '1px solid #ccc';
        document.body.appendChild(div);
    }
});

// 重定向控制台输出到页面
const originalConsole = {
    log: console.log,
    error: console.error
};

function updateResults(message, isError = false) {
    const resultsDiv = document.getElementById('results');
    if (resultsDiv) {
        const line = document.createElement('div');
        line.style.color = isError ? 'red' : 'black';
        line.style.marginBottom = '5px';
        line.textContent = typeof message === 'object' ? JSON.stringify(message, null, 2) : message;
        resultsDiv.appendChild(line);
    }
}

console.log = (...args) => {
    originalConsole.log(...args);
    updateResults(args.join(' '));
};

console.error = (...args) => {
    originalConsole.error(...args);
    updateResults(args.join(' '), true);
};
