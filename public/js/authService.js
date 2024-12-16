// 只在 window.AuthService 未定义时声明类
if (typeof window.AuthService === 'undefined') {
    window.AuthService = class AuthService {
        constructor() {
            // 根据当前环境选择 API URL
            this.apiUrl = window.location.hostname === 'localhost' 
                ? 'http://localhost:8080'
                : 'https://illustrious-perfection-production.up.railway.app';
                
            console.log('[AuthService] Initializing with API URL:', this.apiUrl);
            
            this.tokenKey = 'token';
            this.userKey = 'user';
            
            // 从 localStorage 获取 token
            this.token = localStorage.getItem(this.tokenKey);
            
            // Add request interceptor for debugging
            this.addRequestInterceptor();
        }
        
        addRequestInterceptor() {
            const originalFetch = window.fetch;
            window.fetch = async (url, options = {}) => {
                try {
                    const request = {
                        url,
                        method: options.method || 'GET',
                        headers: options.headers || {}
                    };
                    console.log('[AuthService] Request:', request);

                    const response = await originalFetch(url, options);
                    console.log('[AuthService] Response:', {
                        url,
                        status: response.status,
                        ok: response.ok,
                        headers: Object.fromEntries(response.headers.entries())
                    });

                    return response;
                } catch (error) {
                    console.error('[AuthService] Request failed:', {
                        url,
                        error: error.message
                    });
                    throw error;
                }
            };
        }

        // 处理认证重定向
        handleAuthRedirect() {
            window.location.href = 'https://w3router.github.io/eonweb/public/auth/login.html';
        }

        // API 请求基础配置
        getRequestConfig(options = {}) {
            const config = {
                ...options,
                credentials: 'include',
                mode: 'cors',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest',
                    ...options.headers
                }
            };

            if (this.token) {
                config.headers['Authorization'] = `Bearer ${this.token}`;
            }

            return config;
        }

        async login(email, password) {
            console.log('[AuthService] Attempting login:', { email });
            try {
                const response = await fetch(`${this.apiUrl}/api/auth/login`, this.getRequestConfig({
                    method: 'POST',
                    body: JSON.stringify({ email, password })
                }));

                if (!response.ok) {
                    throw new Error(response.statusText);
                }

                const data = await response.json();
                this.setAuth(data.token, data.user);
                return data;
            } catch (error) {
                console.error('[AuthService] Login error:', error.message);
                throw error;
            }
        }

        async getUserInfo() {
            try {
                const response = await fetch(`${this.apiUrl}/api/user`, this.getRequestConfig());
                
                if (!response.ok) {
                    throw new Error(response.statusText);
                }

                const data = await response.json();
                return data;
            } catch (error) {
                console.error('[AuthService] Error getting user info:', error.message);
                throw error;
            }
        }

        async logout() {
            try {
                const response = await fetch(`${this.apiUrl}/api/auth/logout`, this.getRequestConfig({
                    method: 'POST'
                }));

                if (!response.ok) {
                    throw new Error(response.statusText);
                }

                localStorage.removeItem(this.tokenKey);
                localStorage.removeItem(this.userKey);
                
                const data = await response.json();
                return data;
            } catch (error) {
                console.error('[AuthService] Logout error:', error.message);
                throw error;
            }
        }

        setAuth(token, user) {
            localStorage.setItem(this.tokenKey, token);
            localStorage.setItem(this.userKey, JSON.stringify(user));
            this.token = token;
            console.log('[AuthService] Auth data saved');
        }

        getToken() {
            return localStorage.getItem(this.tokenKey);
        }

        getUser() {
            const userStr = localStorage.getItem(this.userKey);
            try {
                return userStr ? JSON.parse(userStr) : null;
            } catch (error) {
                console.error('[AuthService] Error parsing user data:', error);
                return null;
            }
        }

        isAuthenticated() {
            return !!this.getToken();
        }

        // 处理登出
        handleLogout() {
            this.logout();
            window.location.href = '/auth/login.html';
        }

        async fetchWithAuth(endpoint, options = {}) {
            try {
                console.log(`Fetching ${endpoint} with auth`);
                const response = await fetch(`${this.apiUrl}${endpoint}`, this.getRequestConfig(options));

                if (!response.ok) {
                    const error = await response.json();
                    throw new Error(error.message || 'Request failed');
                }

                return response.json();
            } catch (error) {
                console.error(`[AuthService] ${endpoint} error:`, error.message);
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
    }
}

// 创建全局实例
if (!window.authService) {
    window.authService = new window.AuthService();
}
