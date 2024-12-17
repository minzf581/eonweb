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

            // 使用相对路径，因为前端和后端在同一域名下
            this.BASE_URL = '';  // 空字符串表示使用相对路径
            this.AUTH_BASE = '/auth';
            this.API_BASE = '/api';
            console.log('[AuthService] Using relative paths for API calls');
            
            this.tokenKey = 'token';
            this.userKey = 'user';
            
            // 从 localStorage 获取 token
            this.token = localStorage.getItem(this.tokenKey);
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
            window.location.href = '/public/auth/login.html';
        }

        // 获取请求配置
        getRequestConfig(customConfig = {}) {
            const config = {
                ...customConfig,
                headers: {
                    'Content-Type': 'application/json',
                    ...customConfig.headers
                },
                credentials: 'include'
            };

            if (this.token) {
                config.headers['Authorization'] = `Bearer ${this.token}`;
            }

            console.log('[AuthService] Request config:', config);
            return config;
        }

        async login(email, password) {
            try {
                console.log('[AuthService] Attempting login with:', { email });
                
                const response = await fetch(`${this.AUTH_BASE}/login`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ email, password })
                });

                console.log('[AuthService] Login response:', {
                    status: response.status,
                    ok: response.ok
                });

                if (!response.ok) {
                    const errorData = await response.json();
                    console.error('[AuthService] Login failed:', errorData);
                    throw new Error(errorData.message || 'Login failed');
                }

                const data = await response.json();
                if (data.token) {
                    this.setAuth(data.token, data.user);
                    return data;
                } else {
                    throw new Error('No token received');
                }
            } catch (error) {
                console.error('[AuthService] Login error:', error);
                throw error;
            }
        }

        async getUserInfo() {
            try {
                const response = await fetch(`${this.API_BASE}/user/info`, {
                    headers: {
                        'Authorization': `Bearer ${this.getToken()}`
                    }
                });
                
                if (!response.ok) {
                    throw new Error(response.statusText);
                }

                return await response.json();
            } catch (error) {
                console.error('[AuthService] Get user info error:', error);
                throw error;
            }
        }

        async logout() {
            // 清除本地存储
            localStorage.removeItem(this.tokenKey);
            localStorage.removeItem(this.userKey);
            console.log('[AuthService] Logged out successfully');
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

        async isAuthenticated() {
            const token = this.getToken();
            if (!token) {
                return false;
            }

            try {
                // 验证 token 是否有效
                const response = await fetch(`${this.API_BASE}/verify`, {
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });

                return response.ok;
            } catch (error) {
                console.error('[AuthService] Token verification failed:', error);
                return false;
            }
        }

        // 处理登出
        async handleLogout() {
            try {
                await this.logout();
                window.location.href = '/public/auth/login.html';
            } catch (error) {
                console.error('[AuthService] Logout failed:', error);
                // Still redirect even if logout fails to ensure user is logged out of frontend
                window.location.href = '/public/auth/login.html';
            }
        }

        async fetchWithAuth(endpoint, options = {}) {
            try {
                console.log(`Fetching ${endpoint} with auth`);
                const response = await fetch(`${this.API_BASE}${endpoint}`, this.getRequestConfig(options));

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

        // 获取用户任务
        async getUserTasks() {
            try {
                const response = await this.fetchWithAuth('/tasks/user');
                if (!response.ok) {
                    throw new Error('Failed to fetch user tasks');
                }
                const data = await response.json();
                return data.tasks || [];
            } catch (error) {
                console.error('Error getting user tasks:', error);
                return [];
            }
        }

        // 获取用户统计信息
        async getUserStats() {
            try {
                const response = await this.fetchWithAuth('/users/stats');
                if (!response.ok) {
                    throw new Error('Failed to fetch user stats');
                }
                const data = await response.json();
                return data;
            } catch (error) {
                console.error('Error getting user stats:', error);
                return null;
            }
        }

        // 获取推荐信息
        async getReferralInfo() {
            try {
                const response = await this.fetchWithAuth('/users/referral-info');
                if (!response.ok) {
                    throw new Error('Failed to fetch referral info');
                }
                const data = await response.json();
                return data;
            } catch (error) {
                console.error('Error getting referral info:', error);
                return null;
            }
        }

        // 获取用户角色
        async getUserRole() {
            const token = this.getToken();
            if (!token) {
                throw new Error('No token found');
            }

            try {
                const response = await fetch(`${this.API_BASE}/user/role`, {
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });

                if (!response.ok) {
                    throw new Error('Failed to get user role');
                }

                const data = await response.json();
                return data.role;
            } catch (error) {
                console.error('Error getting user role:', error);
                throw error;
            }
        }
    }
}

// 创建全局实例
if (!window.authService) {
    window.authService = new window.AuthService();
}
