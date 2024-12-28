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
        if (!this._data.token) {
            this.logInfo('No token in memory, checking localStorage');
            const token = localStorage.getItem('authToken');
            if (token) {
                this.logInfo('Token found in localStorage');
                this._data.token = token;
            }
        }
        return this._data.token;
    }

    async getUser() {
        if (!this._data.user) {
            this.logInfo('No user in memory, checking localStorage');
            const userData = localStorage.getItem('user');
            if (userData) {
                try {
                    this._data.user = JSON.parse(userData);
                    this.logInfo('User found in localStorage:', {
                        email: this._data.user.email,
                        isAdmin: this._data.user.isAdmin
                    });
                } catch (error) {
                    this.logError('Error parsing user data:', error);
                    return null;
                }
            }
        }

        if (!this._data.token || !this._data.user) {
            this.logInfo('No token or user available');
            return null;
        }

        // Verify token and refresh user data
        const isValid = await this.verifyToken();
        if (!isValid) {
            this.logInfo('Token invalid, clearing auth data');
            this.clearAuth();
            return null;
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
                this.logInfo('Login successful:', {
                    email: data.user.email,
                    isAdmin: data.user.isAdmin
                });

                // Store auth data
                this._data.token = data.token;
                this._data.user = data.user;

                // Save to localStorage
                localStorage.setItem('authToken', data.token);
                localStorage.setItem('user', JSON.stringify(data.user));

                return {
                    success: true,
                    user: data.user
                };
            } else {
                this.logError('Login failed:', data.message);
                return {
                    success: false,
                    error: data.message || 'Login failed'
                };
            }
        } catch (error) {
            this.logError('Login error:', error);
            return {
                success: false,
                error: 'Login failed'
            };
        }
    }

    async logout() {
        this.logInfo('Logging out');
        this.clearAuth();
        window.location.replace('/auth/login.html');
    }

    async verifyToken() {
        this.logInfo('Verifying token');

        try {
            const response = await fetch('/api/auth/me', {
                headers: {
                    'Authorization': `Bearer ${this._data.token}`
                }
            });

            if (!response.ok) {
                this.logError('Token verification failed:', response.status);
                return false;
            }

            const data = await response.json();
            if (data.success && data.user) {
                this.logInfo('Token verified, user:', {
                    email: data.user.email,
                    isAdmin: data.user.isAdmin
                });

                // Update user data
                this._data.user = data.user;
                localStorage.setItem('user', JSON.stringify(data.user));
                return true;
            }

            this.logError('Token verification failed: Invalid response');
            return false;
        } catch (error) {
            this.logError('Token verification error:', error);
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