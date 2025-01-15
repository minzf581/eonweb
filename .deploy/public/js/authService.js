// AuthService implementation
class AuthService {
    constructor() {
        this._data = {
            token: null,
            user: null
        };
        this._ready = false;
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
            this._ready = true;
        } catch (error) {
            this.logError('Error initializing from storage:', error);
            this.clearAuth();
            this._ready = true;
        }
    }

    isReady() {
        return this._ready;
    }

    clearAuth() {
        this._data.token = null;
        this._data.user = null;
        localStorage.removeItem('authToken');
        localStorage.removeItem('user');
        this.logInfo('Auth data cleared');
    }

    async register(email, password, referralCode = '') {
        this.logInfo('Registration attempt for:', email, 'with referral code:', referralCode);
        
        try {
            const response = await fetch('/api/auth/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ 
                    email, 
                    password,
                    referralCode
                })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || 'Registration failed');
            }

            const data = await response.json();
            this.logInfo('Registration successful');
            return data;
        } catch (error) {
            this.logError('Registration error:', error);
            throw error;
        }
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
                throw new Error(error.message || 'Login failed');
            }

            const data = await response.json();
            this._data.token = data.token;
            this._data.user = data.user;

            localStorage.setItem('authToken', data.token);
            localStorage.setItem('user', JSON.stringify(data.user));

            this.logInfo('Login successful:', {
                email: this._data.user.email,
                isAdmin: this._data.user.isAdmin
            });

            return data;
        } catch (error) {
            this.logError('Login error:', error);
            throw error;
        }
    }

    async verifyToken() {
        if (!this._data.token) {
            return false;
        }

        try {
            const response = await fetch('/api/auth/verify', {
                headers: {
                    'Authorization': `Bearer ${this._data.token}`
                }
            });

            return response.ok;
        } catch (error) {
            this.logError('Token verification error:', error);
            return false;
        }
    }

    getUser() {
        return this._data.user;
    }

    isLoggedIn() {
        return !!this._data.token && !!this._data.user;
    }

    isAdmin() {
        return this._data.user?.isAdmin || false;
    }

    async logout() {
        this.logInfo('Logging out');
        this.clearAuth();
        window.location.href = '/auth/login.html';
    }

    getToken() {
        return this._data.token;
    }
}

// Create global instance
window.authService = new AuthService();

// Create auth service utils
window.authServiceUtils = {
    waitForAuthService(timeout = 5000) {
        return new Promise((resolve, reject) => {
            const startTime = Date.now();
            
            function checkService() {
                if (window.authService && window.authService.isReady()) {
                    resolve(window.authService);
                } else if (Date.now() - startTime > timeout) {
                    reject(new Error('AuthService not available'));
                } else {
                    setTimeout(checkService, 100);
                }
            }
            
            checkService();
        });
    }
};