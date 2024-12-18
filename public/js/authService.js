// 只在 window.AuthService 未定义时声明类
if (typeof window !== 'undefined' && typeof window.AuthService === 'undefined') {
    window.AuthService = class AuthService {
        #redirecting = false;
        #validationCache = null;
        #lastValidation = 0;
        #validationTimeout = 5000; // 5秒缓存
        #initialized = false;

        constructor() {
            console.log('[AuthService] Starting initialization...');
            try {
                this.AUTH_BASE = '/api/auth';
                this.API_BASE = '/api';
                this.tokenKey = 'token';
                this.userKey = 'user';
                this.token = localStorage.getItem(this.tokenKey);
                
                // 重置重定向状态
                window.addEventListener('pageshow', () => {
                    this.#redirecting = false;
                });

                this.addRequestInterceptor();
                this.#initialized = true;
                console.log('[AuthService] Initialization completed successfully');
            } catch (error) {
                console.error('[AuthService] Initialization failed:', error);
                throw error;
            }
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

        // 基本的token存在检查
        isAuthenticated() {
            const token = this.getToken();
            return !!token;
        }

        // 检查服务是否已初始化
        isInitialized() {
            return this.#initialized;
        }

        // 与后端验证token有效性
        async validateToken() {
            try {
                // 如果没有token，直接返回false
                if (!this.token) {
                    console.log('[AuthService] No token found');
                    return false;
                }

                // 检查缓存
                const now = Date.now();
                if (this.#validationCache !== null && (now - this.#lastValidation) < this.#validationTimeout) {
                    console.log('[AuthService] Using cached validation result:', this.#validationCache);
                    return this.#validationCache;
                }

                console.log('[AuthService] Validating token with server...');
                const response = await this.fetchWithAuth(`${this.AUTH_BASE}/validate`);
                
                if (!response.ok) {
                    console.warn('[AuthService] Token validation failed:', response.status);
                    this.#validationCache = false;
                    this.#lastValidation = now;
                    return false;
                }

                const data = await response.json();
                this.#validationCache = data.valid === true;
                this.#lastValidation = now;

                if (!this.#validationCache) {
                    console.warn('[AuthService] Server reported token as invalid');
                    this.clearAuth();
                }

                return this.#validationCache;
            } catch (error) {
                console.error('[AuthService] Token validation error:', error);
                // 在发生错误时清除缓存，这样下次可以重试
                this.#validationCache = null;
                this.#lastValidation = 0;
                return false;
            }
        }

        // 处理认证错误
        handleAuthError() {
            if (this.#redirecting) {
                console.log('[AuthService] Redirect already in progress');
                return;
            }

            const currentPath = window.location.pathname;
            if (currentPath.includes('/auth/login')) {
                console.log('[AuthService] Already on login page');
                return;
            }

            console.log('[AuthService] Handling auth error...');
            this.#redirecting = true;
            this.clearAuth();
            window.location.href = '/public/auth/login.html';
        }

        clearAuth() {
            localStorage.removeItem(this.tokenKey);
            localStorage.removeItem(this.userKey);
            this.token = null;
            this.#validationCache = null;
        }

        setAuth(token, user) {
            localStorage.setItem(this.tokenKey, token);
            localStorage.setItem(this.userKey, JSON.stringify(user));
            this.token = token;
            this.#validationCache = true;
            this.#lastValidation = Date.now();
        }

        getToken() {
            return this.token;
        }

        getUser() {
            const userStr = localStorage.getItem(this.userKey);
            return userStr ? JSON.parse(userStr) : null;
        }

        async login(email, password) {
            try {
                console.log('[AuthService] Attempting login...');
                const response = await fetch(`${this.AUTH_BASE}/login`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ email, password }),
                    credentials: 'include'
                });

                if (!response.ok) {
                    const error = await response.json();
                    throw new Error(error.message || 'Login failed');
                }

                const data = await response.json();
                this.setAuth(data.token, data.user);
                return true;
            } catch (error) {
                console.error('[AuthService] Login error:', error);
                this.clearAuth();
                throw error;
            }
        }

        logout() {
            this.clearAuth();
            if (!this.#redirecting) {
                this.#redirecting = true;
                window.location.href = '/public/auth/login.html';
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
                    if (response.status === 401) {
                        this.handleAuthError();
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
    }
}

// 创建全局实例
if (typeof window !== 'undefined' && !window.authService) {
    console.log('[AuthService] Creating global instance...');
    try {
        window.authService = new window.AuthService();
        console.log('[AuthService] Global instance created successfully');
    } catch (error) {
        console.error('[AuthService] Failed to create global instance:', error);
    }
}
