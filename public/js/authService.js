// 只在 window.AuthService 未定义时声明类
if (typeof window.AuthService === 'undefined') {
    window.AuthService = class AuthService {
        constructor() {
            this.apiBaseUrl = 'https://eonweb-production.up.railway.app';
            this.tokenKey = 'token';
            this.userKey = 'user';
        }

        // 处理认证重定向
        handleAuthRedirect() {
            window.location.href = 'https://w3router.github.io/eonweb/public/auth/login.html';
        }

        // 获取 token
        getToken() {
            return localStorage.getItem(this.tokenKey);
        }

        // 获取用户信息
        getUser() {
            const userStr = localStorage.getItem(this.userKey);
            return userStr ? JSON.parse(userStr) : null;
        }

        // 设置认证信息
        setAuth(token, user) {
            localStorage.setItem(this.tokenKey, token);
            localStorage.setItem(this.userKey, JSON.stringify(user));
        }

        // 清除认证信息
        clearAuth() {
            localStorage.removeItem(this.tokenKey);
            localStorage.removeItem(this.userKey);
        }

        // 检查是否已登录
        isAuthenticated() {
            const token = this.getToken();
            return !!token;
        }

        // API 请求基础配置
        getRequestConfig(options = {}) {
            const token = this.getToken();
            const config = {
                ...options,
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
                    ...options.headers
                }
            };
            console.log('Request config:', config);
            return config;
        }

        async login(email, password) {
            try {
                console.log('Attempting login...');
                const response = await fetch(`${this.apiBaseUrl}/api/auth/login`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json'
                    },
                    body: JSON.stringify({ email, password })
                });

                if (!response.ok) {
                    const error = await response.json();
                    console.error('Login failed:', error);
                    throw new Error(error.message || 'Login failed');
                }

                const data = await response.json();
                console.log('Login successful:', data);
                this.setAuth(data.token, data.user);
                return data;
            } catch (error) {
                console.error('Login error:', error);
                throw error;
            }
        }

        // 通用的 API 请求函数
        async fetchWithAuth(endpoint, options = {}) {
            try {
                console.log(`Fetching ${endpoint} with auth`);
                const response = await fetch(`${this.apiBaseUrl}${endpoint}`, this.getRequestConfig(options));

                if (!response.ok) {
                    const error = await response.json();
                    console.error(`API error for ${endpoint}:`, error);
                    throw new Error(error.message || 'Request failed');
                }

                return response.json();
            } catch (error) {
                console.error(`Error in fetchWithAuth for ${endpoint}:`, error);
                throw error;
            }
        }

        // 获取用户统计信息
        async getUserStats() {
            return this.fetchWithAuth('/api/users/stats');
        }

        // 获取推荐信息
        async getReferralInfo() {
            return this.fetchWithAuth('/api/users/referral-info');
        }

        // 获取用户任务
        async getUserTasks() {
            return this.fetchWithAuth('/api/tasks/user');
        }

        // 处理登出
        logout() {
            this.clearAuth();
            window.location.href = '/auth/login.html';
        }
    }
}

// 创建全局实例 - 只在 window.authService 未定义时创建
if (!window.authService) {
    window.authService = new window.AuthService();
}
