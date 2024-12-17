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

            // 根据环境设置 API URL
            this.apiUrl = 'https://eonweb-production.up.railway.app/proxy';
            console.log('[AuthService] Initializing with API URL:', this.apiUrl);
            
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
            window.location.href = 'https://eonweb-production.up.railway.app/public/auth/login.html';
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
                
                const response = await fetch(`${this.apiUrl}/auth/login`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ email, password }),
                    credentials: 'include',
                    mode: 'cors'
                });

                console.log('[AuthService] Login response:', {
                    status: response.status,
                    ok: response.ok,
                    headers: Object.fromEntries(response.headers.entries())
                });

                if (!response.ok) {
                    const errorData = await response.json();
                    console.error('[AuthService] Login failed:', errorData);
                    throw new Error(errorData.message || 'Login failed');
                }

                const data = await response.json();
                console.log('[AuthService] Login successful:', { 
                    token: data.token ? 'present' : 'missing',
                    user: data.user ? 'present' : 'missing'
                });

                // 保存认证信息
                this.setAuth(data.token, data.user);
                return data;
            } catch (error) {
                console.error('[AuthService] Login error:', error);
                throw error;
            }
        }

        async getUserInfo() {
            try {
                const response = await fetch(`${this.apiUrl}/user`, this.getRequestConfig());
                
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
                const response = await fetch(`${this.apiUrl}/auth/logout`, this.getRequestConfig({
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

        async isAuthenticated() {
            const token = this.getToken();
            if (!token) {
                return false;
            }

            try {
                // 验证 token 是否有效
                const response = await fetch(`${this.apiUrl}/auth/verify`, {
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

        // 获取用户任务
        async getUserTasks() {
            try {
                const response = await this.fetchWithAuth('/api/tasks/user');
                return response.tasks || [];
            } catch (error) {
                console.error('Error getting user tasks:', error);
                return [];
            }
        }

        // 获取用户统计信息
        async getUserStats() {
            try {
                const response = await this.fetchWithAuth('/api/users/stats');
                return response;
            } catch (error) {
                console.error('Error getting user stats:', error);
                return null;
            }
        }

        // 获取推荐信息
        async getReferralInfo() {
            try {
                const response = await this.fetchWithAuth('/api/users/referral-info');
                return response;
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
                const response = await fetch(`${this.apiUrl}/api/user/role`, {
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
