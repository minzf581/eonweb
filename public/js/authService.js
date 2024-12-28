// AuthService implementation
class AuthService {
    constructor() {
        // 单例模式
        if (window._authService) {
            return window._authService;
        }

        // 初始化数据
        this._data = {
            token: null,
            user: null,
            initialized: false
        };

        // 从 localStorage 恢复会话
        this.initialize();

        // 保存实例
        window._authService = this;
        return this;
    }

    logInfo(message) {
        console.log('[AuthService]', message);
    }

    logError(message, error) {
        console.error('[AuthService]', message, error);
    }

    initialize() {
        this.logInfo('Starting initialization');
        
        try {
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
            this.logError('Initialization failed', error);
            this.clearAuth();
        }
    }

    isAuthenticated() {
        return !!this._data.token && !!this._data.user;
    }

    getToken() {
        return this._data.token;
    }

    async getUser() {
        if (!this._data.token) {
            this.logInfo('No token available');
            return null;
        }

        if (!this._data.user) {
            const isValid = await this.verifyToken();
            if (!isValid) {
                this.logInfo('Token invalid, clearing auth data');
                this.clearAuth();
                return null;
            }
        }

        return this._data.user;
    }

    async login(email, password) {
        this.logInfo('Login attempt for: ' + email);
        
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
                this.logInfo('Login successful: ' + JSON.stringify({
                    email: data.user.email,
                    isAdmin: data.user.isAdmin
                }));

                // 保存认证数据
                this._data.token = data.token;
                this._data.user = data.user;
                
                // 保存到 localStorage
                localStorage.setItem('authToken', data.token);
                localStorage.setItem('user', JSON.stringify(data.user));

                this.logInfo('Auth data saved');

                // 根据用户角色重定向
                const redirectUrl = data.user.isAdmin ? '/admin/' : '/dashboard/';
                this.logInfo('Redirecting to: ' + redirectUrl);
                window.location.replace(redirectUrl);

                return data;
            } else {
                const message = data.message || '登录失败，请检查您的邮箱和密码';
                this.logError('Login failed', message);
                throw new Error(message);
            }
        } catch (error) {
            this.logError('Login error', error);
            throw error;
        }
    }

    async logout() {
        this.logInfo('Logging out');
        this.clearAuth();
        window.location.replace('/auth/login.html');
    }

    async verifyToken() {
        const token = this.getToken();
        if (!token) {
            this.logInfo('No token to verify');
            return false;
        }

        try {
            const response = await fetch('/api/auth/verify-token', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) {
                this.logError('Token verification failed', response.status);
                return false;
            }

            const data = await response.json();
            if (!data.success) {
                this.logError('Token invalid', data.message);
                return false;
            }

            // 更新用户数据
            if (data.user) {
                this._data.user = data.user;
                localStorage.setItem('user', JSON.stringify(data.user));
                this.logInfo('User data updated from token verification');
            }

            return true;
        } catch (error) {
            this.logError('Token verification error', error);
            return false;
        }
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