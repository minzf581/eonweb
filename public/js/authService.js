// AuthService implementation
class AuthService {
    constructor() {
        this._data = {
            token: null,
            user: null
        };
        this.initFromStorage();
    }

    logInfo(...args) {
        console.log('[AuthService]', ...args);
    }

    logError(...args) {
        console.error('[AuthService]', ...args);
    }

    initFromStorage() {
        try {
            const token = localStorage.getItem('authToken');
            const userData = localStorage.getItem('user');
            
            if (token && userData) {
                this._data.token = token;
                this._data.user = JSON.parse(userData);
                this.logInfo('Initialized from storage:', {
                    email: this._data.user.email,
                    isAdmin: this._data.user.isAdmin
                });
            } else {
                this.logInfo('No auth data in storage');
            }
        } catch (error) {
            this.logError('Error initializing from storage:', error);
            this.clearAuth();
        }
    }

    clearAuth() {
        this._data.token = null;
        this._data.user = null;
        localStorage.removeItem('authToken');
        localStorage.removeItem('user');
        this.logInfo('Auth data cleared');
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

            if (!response.ok) {
                const error = await response.json();
                this.logError('Login failed:', error.message);
                return {
                    success: false,
                    error: error.message || 'Login failed'
                };
            }

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
                    user: {
                        id: data.user.id,
                        email: data.user.email,
                        isAdmin: data.user.isAdmin,
                        points: data.user.points,
                        referralCode: data.user.referralCode
                    }
                };
            } else {
                this.logError('Login failed:', data.message || 'Invalid response');
                return {
                    success: false,
                    error: data.message || 'Login failed'
                };
            }
        } catch (error) {
            this.logError('Login error:', error);
            return {
                success: false,
                error: 'Network error'
            };
        }
    }

    async verifyToken() {
        if (!this._data.token) {
            this.logInfo('No token available for verification');
            return false;
        }

        this.logInfo('Verifying token');

        try {
            const response = await fetch('/api/auth/me', {
                headers: {
                    'Authorization': `Bearer ${this._data.token}`
                }
            });

            if (!response.ok) {
                this.logError('Token verification failed:', response.status);
                this.clearAuth();
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
            this.clearAuth();
            return false;
        } catch (error) {
            this.logError('Token verification error:', error);
            this.clearAuth();
            return false;
        }
    }

    getToken() {
        if (!this._data.token) {
            this.logInfo('No token available');
            return null;
        }
        return this._data.token;
    }

    getUser() {
        if (!this._data.user) {
            this.logInfo('No user data available');
            return null;
        }
        return this._data.user;
    }

    isLoggedIn() {
        return !!this._data.token && !!this._data.user;
    }

    isAdmin() {
        return this._data.user && this._data.user.isAdmin === true;
    }

    logout() {
        this.logInfo('Logging out');
        this.clearAuth();
        window.location.href = '/';
    }
}

// 创建全局实例
window._authService = new AuthService();