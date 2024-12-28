// AuthService implementation
class AuthService {
    constructor() {
        if (window._authService) {
            return window._authService;
        }

        this._data = {
            token: null,
            user: null,
            initialized: false
        };

        this.initialize();
        window._authService = this;
    }

    logInfo(...args) {
        console.log('[AuthService]', ...args);
    }

    logError(...args) {
        console.error('[AuthService]', ...args);
    }

    async initialize() {
        this.logInfo('Starting initialization');
        
        try {
            // 从 localStorage 恢复会话
            const token = localStorage.getItem('authToken');
            const userData = localStorage.getItem('user');

            if (token && userData) {
                this._data.token = token;
                this._data.user = JSON.parse(userData);
                this.logInfo('Restored session from localStorage');
            }

            this._data.initialized = true;
            this.logInfo('Initialization complete');
        } catch (error) {
            this.logError('Initialization failed:', error);
            this.clearAuth();
        }
    }

    isAuthenticated() {
        return !!this._data.token;
    }

    getToken() {
        return this._data.token;
    }

    getUser() {
        return this._data.user;
    }

    async login(email, password) {
        this.logInfo('Login attempt for:', email);
        
        try {
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ email, password })
            });

            const data = await response.json();
            
            if (data.success && data.token && data.user) {
                this.logInfo('Login successful:', {
                    email: data.user.email,
                    isAdmin: data.user.isAdmin
                });

                // 保存认证数据
                this._data.token = data.token;
                this._data.user = data.user;
                
                // 保存到 localStorage
                localStorage.setItem('authToken', data.token);
                localStorage.setItem('user', JSON.stringify(data.user));

                this.logInfo('Auth data saved');

                // 根据用户角色重定向
                const redirectUrl = data.user.isAdmin ? '/admin/' : '/dashboard/';
                this.logInfo('Redirecting to:', redirectUrl);
                window.location.replace(redirectUrl);

                return data;
            } else {
                this.logError('Login failed:', data.message);
                throw new Error(data.message || '登录失败，请检查您的邮箱和密码');
            }
        } catch (error) {
            this.logError('Login error:', error);
            throw error;
        }
    }

    async logout() {
        this.logInfo('Logging out');
        this.clearAuth();
        window.location.replace('/auth/login.html');
    }

    clearAuth() {
        this.logInfo('Clearing auth data');
        this._data = {
            token: null,
            user: null,
            initialized: true
        };
        localStorage.removeItem('authToken');
        localStorage.removeItem('user');
    }
}

// 创建全局实例
window._authService = new AuthService();