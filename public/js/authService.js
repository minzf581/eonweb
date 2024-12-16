// 只在 window.AuthService 未定义时声明类
if (typeof window.AuthService === 'undefined') {
    window.AuthService = class AuthService {
        constructor() {
            // 调试信息
            console.log('Current location:', {
                href: window.location.href,
                hostname: window.location.hostname,
                protocol: window.location.protocol,
                origin: window.location.origin
            });

            // 直接使用生产环境 URL
            this.apiUrl = 'https://illustrious-perfection-production.up.railway.app';
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
                // First, send a preflight OPTIONS request
                const preflightResponse = await fetch(`${this.apiUrl}/api/auth/login`, {
                    method: 'OPTIONS',
                    headers: {
                        'Origin': window.location.origin,
                        'Access-Control-Request-Method': 'POST',
                        'Access-Control-Request-Headers': 'Content-Type,Authorization'
                    },
                    mode: 'cors',
                    credentials: 'include'
                });
                
                console.log('[AuthService] Preflight response:', {
                    status: preflightResponse.status,
                    headers: Object.fromEntries(preflightResponse.headers.entries())
                });

                // Then send the actual login request
                const response = await fetch(`${this.apiUrl}/api/auth/login`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Origin': window.location.origin
                    },
                    body: JSON.stringify({ email, password }),
                    mode: 'cors',
                    credentials: 'include'
                });

                if (!response.ok) {
                    const errorText = await response.text();
                    console.error('[AuthService] Login failed:', {
                        status: response.status,
                        statusText: response.statusText,
                        error: errorText
                    });
                    throw new Error(errorText || response.statusText);
                }

                const data = await response.json();
                this.setAuth(data.token, data.user);
                return data;
            } catch (error) {
                console.error('[AuthService] Login error:', error);
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
