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

    isLoggedIn() {
        return !!this._data.token && !!this._data.user;
    }

    isAdmin() {
        return this._data.user && this._data.user.isAdmin;
    }

    logout() {
        this.logInfo('Logging out');
        this.clearAuth();
        window.location.href = '/';
    }
}

// 创建全局实例
window._authService = new AuthService();