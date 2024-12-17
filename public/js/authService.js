// 只在 window.AuthService 未定义时声明类
if (typeof window.AuthService === 'undefined') {
    window.AuthService = class AuthService {
        #redirecting = false;
        _validating = false;

        constructor() {
            // 调试信息
            console.log('[AuthService] Initializing...');
            
            // 使用相对于网站根目录的路径
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
                AuthService.resetRedirectState();
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

        // 基本的token存在检查
        isAuthenticated() {
            const token = this.getToken();
            return !!token;
        }

        // 与后端验证token有效性
        async validateToken() {
            const token = this.getToken();
            if (!token) {
                console.log('[AuthService] No token found');
                return false;
            }

            // 如果已经在验证中，返回 true 防止重复验证
            if (this._validating) {
                console.log('[AuthService] Token validation already in progress');
                return true;
            }

            try {
                this._validating = true;
                console.log('[AuthService] Validating token...');
                
                const response = await fetch(`${this.AUTH_BASE}/verify`, {
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    }
                });

                if (!response.ok) {
                    console.log('[AuthService] Token validation failed:', response.status);
                    // 只有在明确的认证错误时才清除认证
                    if (response.status === 401 || response.status === 403) {
                        this.clearAuth();
                    }
                    return false;
                }

                const data = await response.json();
                return data.valid === true;
            } catch (error) {
                console.error('[AuthService] Token validation error:', error);
                // 网络错误不清除认证
                return false;
            } finally {
                this._validating = false;
            }
        }

        clearAuth() {
            localStorage.removeItem(this.tokenKey);
            localStorage.removeItem(this.userKey);
            this.token = null;
        }

        // 全局重定向标志
        static hasRedirected = false;

        handleAuthError() {
            // 检查是否已经在重定向
            if (this.#redirecting) {
                console.log('[AuthService] Already redirecting, skipping...');
                return;
            }

            // 检查当前页面是否已经是登录页面
            if (window.location.pathname.includes('/auth/login.html')) {
                console.log('[AuthService] Already on login page, skipping redirect...');
                return;
            }

            this.#redirecting = true;
            console.log('[AuthService] Handling auth error, redirecting to login...');
            
            // 清除认证信息
            this.clearAuth();
            
            // 重定向到登录页面
            window.location.href = '/public/auth/login.html';
        }

        // 重置重定向状态
        static resetRedirectState() {
            AuthService.hasRedirected = false;
        }

        // 统一的API请求错误处理
        handleApiError(response) {
            if (response.status === 401) {
                this.handleAuthError();
                return true;
            }
            return false;
        }

        // 安全的API请求包装器
        async fetchWithAuth(endpoint, options = {}) {
            if (!this.isAuthenticated()) {
                this.handleAuthError();
                return null;
            }

            try {
                const response = await fetch(`${this.API_BASE}${endpoint}`, {
                    ...options,
                    headers: {
                        ...options.headers,
                        'Authorization': `Bearer ${this.token}`
                    }
                });

                if (!response.ok) {
                    if (this.handleApiError(response)) {
                        return null;
                    }
                    throw new Error(`API request failed: ${response.status}`);
                }

                return response;
            } catch (error) {
                console.error(`[AuthService] API error (${endpoint}):`, error);
                return null;
            }
        }

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
