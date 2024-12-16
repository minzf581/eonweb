// 只在 window.AuthService 未定义时声明类
if (typeof window.AuthService === 'undefined') {
    window.AuthService = class AuthService {
        constructor() {
            // 根据当前环境选择 API URL
            this.apiUrl = window.location.hostname === 'localhost' 
                ? 'http://localhost:3000'
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

        async login(email, password) {
            try {
                console.log('[AuthService] Attempting login:', { email });
                
                const response = await fetch(`${this.apiUrl}/api/auth/login`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    credentials: 'include',
                    body: JSON.stringify({ email, password })
                });

                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.message || 'Login failed');
                }

                const data = await response.json();
                
                if (data.success) {
                    // 存储用户信息
                    localStorage.setItem(this.userKey, JSON.stringify(data.user));
                    this.setAuth(data.token, data.user);
                    return data;
                } else {
                    throw new Error(data.message || 'Login failed');
                }
            } catch (error) {
                console.error('[AuthService] Login error:', error.message);
                throw error;
            }
        }

        async getUserInfo() {
            try {
                const token = this.getToken();
                if (!token) {
                    throw new Error('No authentication token found');
                }

                const response = await fetch(`${this.apiUrl}/api/user`, {
                    method: 'GET',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    credentials: 'include'
                });

                if (!response.ok) {
                    throw new Error('Failed to get user info');
                }

                const data = await response.json();
                return data;
            } catch (error) {
                console.error('[AuthService] Get user info error:', error.message);
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

        logout() {
            localStorage.removeItem(this.tokenKey);
            localStorage.removeItem(this.userKey);
            this.token = null;
            
            // 调用登出 API
            return fetch(`${this.apiUrl}/api/auth/logout`, {
                method: 'POST',
                credentials: 'include'
            }).then(response => {
                if (!response.ok) {
                    throw new Error('Logout failed');
                }
                return response.json();
            }).catch(error => {
                console.error('[AuthService] Logout error:', error.message);
                throw error;
            });
        }

        // API 请求基础配置
        getRequestConfig(options = {}) {
            const token = this.getToken();
            const config = {
                ...options,
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
                    ...options.headers
                }
            };
            console.log('Request config:', config);
            return config;
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

        // 处理登出
        handleLogout() {
            this.logout();
            window.location.href = '/auth/login.html';
        }
    }
}

// 创建全局实例 - 只在 window.authService 未定义时创建
if (!window.authService) {
    window.authService = new window.AuthService();
}
