// 只在 window.AuthService 未定义时声明类
if (typeof window.AuthService === 'undefined') {
    window.AuthService = class AuthService {
        #redirecting = false;

        constructor() {
            // 调试信息
            console.log('[AuthService] Initializing...');
            
            // 使用相对于网站根目录的路径
            this.BASE_URL = '';  // 空字符串表示使用相对路径
            this.AUTH_BASE = '/api/auth';  // 后端 API 路径
            this.API_BASE = '/api';
            console.log('[AuthService] Using API paths:', {
                auth: this.AUTH_BASE,
                api: this.API_BASE
            });
            
            this.tokenKey = 'token';
            this.userKey = 'user';
            
            // 从 localStorage 获取 token
            this.token = localStorage.getItem(this.tokenKey);
            
            // 重置重定向状态
            this.hasRedirected = false;
            
            // 添加重定向状态重置
            window.addEventListener('pageshow', () => {
                this.hasRedirected = false;
            });
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
                    let errorMessage = 'Login failed';
                    try {
                        const errorData = await response.json();
                        errorMessage = errorData.message || errorMessage;
                    } catch (e) {
                        // 如果响应不是 JSON 格式，使用默认错误消息
                        console.warn('[AuthService] Failed to parse error response:', e);
                    }
                    throw new Error(errorMessage);
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

        isAuthenticated() {
            const token = this.getToken();
            if (!token) {
                console.log('[AuthService] No token found');
                return false;
            }

            try {
                // 解析token并检查是否过期
                const tokenData = JSON.parse(atob(token.split('.')[1]));
                const expirationTime = tokenData.exp * 1000;
                const isValid = Date.now() < expirationTime;
                
                if (!isValid) {
                    console.log('[AuthService] Token expired');
                    this.clearAuth();
                }
                
                return isValid;
            } catch (error) {
                console.error('[AuthService] Token validation error:', error);
                this.clearAuth();
                return false;
            }
        }

        clearAuth() {
            console.log('[AuthService] Clearing auth data');
            localStorage.removeItem(this.tokenKey);
            localStorage.removeItem(this.userKey);
            this.token = null;
        }

        handleAuthError() {
            if (this.hasRedirected) {
                console.log('[AuthService] Redirect already in progress');
                return;
            }

            this.hasRedirected = true;
            console.log('[AuthService] Handling auth error');
            
            // 清理认证数据
            this.clearAuth();
            
            // 显示错误消息
            const errorDiv = document.createElement('div');
            errorDiv.style.cssText = 'position: fixed; top: 20px; right: 20px; background: #ff4444; color: white; padding: 10px; border-radius: 4px; z-index: 1000;';
            errorDiv.textContent = 'Session expired. Please login again.';
            document.body.appendChild(errorDiv);

            // 延迟重定向
            setTimeout(() => {
                window.location.href = '/public/auth/login.html';
            }, 2000);
        }

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
