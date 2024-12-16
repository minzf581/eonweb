// 只在 window.AuthService 未定义时声明类
if (typeof window.AuthService === 'undefined') {
    window.AuthService = class AuthService {
        constructor() {
            // API URL configuration using Railway service name
            const apiBaseUrls = [
                'https://illustrious-perfection-production.up.railway.app',  // Production URL
                'https://illustrious-perfection.up.railway.app',             // Staging URL
                window.location.origin                                       // Local development
            ].filter(Boolean);
            
            this.apiBaseUrl = apiBaseUrls[0];
            console.log('[AuthService] Initializing with API URL:', this.apiBaseUrl);
            
            this.tokenKey = 'token';
            this.userKey = 'user';
            
            // Add request interceptor for debugging
            this.addRequestInterceptor();
        }
        
        addRequestInterceptor() {
            const originalFetch = window.fetch;
            window.fetch = async (...args) => {
                const [url, config] = args;
                
                console.log('[AuthService] Request:', {
                    url,
                    method: config?.method || 'GET',
                    headers: config?.headers
                });
                
                try {
                    const response = await originalFetch(...args);
                    console.log('[AuthService] Response:', {
                        url,
                        status: response.status,
                        ok: response.ok
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
                
                const url = `${this.apiBaseUrl}/api/auth/login`;
                const response = await fetch(url, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json'
                    },
                    credentials: 'include',
                    body: JSON.stringify({ email, password })
                });

                const data = await response.json();
                
                if (!response.ok) {
                    console.error('[AuthService] Login failed:', data);
                    throw new Error(data.message || 'Login failed');
                }

                console.log('[AuthService] Login successful');
                this.setAuth(data.token, data.user);
                return data;
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

                const url = `${this.apiBaseUrl}/api/user`;
                const response = await fetch(url, {
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Accept': 'application/json'
                    },
                    credentials: 'include'
                });

                const data = await response.json();
                
                if (!response.ok) {
                    console.error('[AuthService] Failed to get user info:', data);
                    throw new Error(data.message || 'Failed to get user info');
                }

                console.log('[AuthService] Got user info:', { ...data, token: '[REDACTED]' });
                return data;
            } catch (error) {
                console.error('[AuthService] Error getting user info:', error.message);
                throw error;
            }
        }

        setAuth(token, user) {
            localStorage.setItem(this.tokenKey, token);
            localStorage.setItem(this.userKey, JSON.stringify(user));
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
            console.log('[AuthService] Logged out');
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
