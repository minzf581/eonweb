class AuthService {
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

            this.#initialized = true;
            console.log('[AuthService] Initialization completed successfully');
        } catch (error) {
            console.error('[AuthService] Initialization failed:', error);
            throw error;
        }
    }

    // 检查服务是否已初始化
    isInitialized() {
        return this.#initialized;
    }

    // 基本的token存在检查
    isAuthenticated() {
        const token = this.getToken();
        return !!token;
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
            const response = await fetch(`${this.AUTH_BASE}/validate`, {
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });
            
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
            this.#validationCache = null;
            this.#lastValidation = 0;
            return false;
        }
    }

    clearAuth() {
        console.log('[AuthService] Clearing auth data...');
        localStorage.removeItem(this.tokenKey);
        localStorage.removeItem(this.userKey);
        this.token = null;
        this.#validationCache = null;
        this.#lastValidation = 0;
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
            console.log('[AuthService] Login successful');
            return true;
        } catch (error) {
            console.error('[AuthService] Login error:', error);
            this.clearAuth();
            throw error;
        }
    }

    logout() {
        if (this.#redirecting) {
            console.log('[AuthService] Redirect already in progress');
            return;
        }
        console.log('[AuthService] Logging out...');
        this.clearAuth();
        this.#redirecting = true;
        window.location.href = '/public/auth/login.html';
    }
}

// 初始化函数
function initializeAuthService() {
    console.log('[AuthService] Initializing auth service...');
    if (!window.authService) {
        try {
            window.authService = new AuthService();
            console.log('[AuthService] Auth service initialized successfully');
            return window.authService;
        } catch (error) {
            console.error('[AuthService] Failed to initialize auth service:', error);
            throw error;
        }
    }
    return window.authService;
}

// 创建全局实例
if (typeof window !== 'undefined' && !window.authService) {
    console.log('[AuthService] Creating global instance...');
    try {
        window.authService = initializeAuthService();
        console.log('[AuthService] Global instance created successfully');
    } catch (error) {
        console.error('[AuthService] Failed to create global instance:', error);
        throw error;
    }
}