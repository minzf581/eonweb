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

            // 发送验证请求
            const response = await fetch(`${this.AUTH_BASE}/validate`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });

            const isValid = response.ok;
            
            // 更新缓存
            this.#validationCache = isValid;
            this.#lastValidation = now;

            if (!isValid) {
                console.log('[AuthService] Token validation failed');
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
        console.log('[AuthService] Clearing auth data...');
        localStorage.removeItem(this.tokenKey);
        localStorage.removeItem(this.userKey);
        this.token = null;
        this.#validationCache = null;
        this.#lastValidation = 0;
    }

    setAuth(token, user) {
        console.log('[AuthService] Setting auth data...');
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
            const response = await fetch(`${this.AUTH_BASE}/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ email, password })
            });

            if (!response.ok) {
                throw new Error('Login failed');
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

    async logout() {
        console.log('[AuthService] Logging out...');
        if (this.#redirecting) return;
        this.#redirecting = true;
        this.clearAuth();
        window.location.href = '/public/auth/login.html';
    }
}

// 初始化函数
function initializeAuthService() {
    console.log('[AuthService] Initializing auth service...');
    if (!window.authService) {
        try {
            const authService = new AuthService();
            // 确保所有方法都正确绑定到实例上
            window.authService = {
                isInitialized: () => authService.isInitialized(),
                isAuthenticated: () => authService.isAuthenticated(),
                validateToken: () => authService.validateToken(),
                clearAuth: () => authService.clearAuth(),
                setAuth: (token, user) => authService.setAuth(token, user),
                getToken: () => authService.getToken(),
                getUser: () => authService.getUser(),
                login: (email, password) => authService.login(email, password),
                logout: () => authService.logout()
            };
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
if (typeof window !== 'undefined') {
    window.initializeAuthService = initializeAuthService;
    initializeAuthService();
}