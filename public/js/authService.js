// AuthService implementation
class AuthService {
    constructor() {
        // Initialize private fields
        this._initialized = false;
        this._initializing = false;
        this._token = localStorage.getItem('auth_token');
        this._tokenExpiry = localStorage.getItem('auth_token_expiry');
        
        // Bind all methods to this instance
        this.getToken = () => {
            if (!this._initialized) {
                throw new Error('AuthService not initialized');
            }
            return this._token;
        };

        this.logInfo = (message) => {
            console.log(`[AuthService ${new Date().toISOString()}] ${message}`);
        };

        this.logError = (message, error) => {
            console.error(`[AuthService ${new Date().toISOString()}] ${message}:`, error);
        };

        this.isInitialized = () => {
            this.logInfo(`Checking initialization status: ${this._initialized}`);
            return this._initialized;
        };

        this.clearAuth = () => {
            this._token = null;
            this._tokenExpiry = null;
            localStorage.removeItem('auth_token');
            localStorage.removeItem('auth_token_expiry');
            this.logInfo('Auth cleared');
        };

        this.setToken = (token) => {
            this._token = token;
            const expiry = new Date();
            expiry.setHours(expiry.getHours() + 24);
            this._tokenExpiry = expiry.toISOString();
            localStorage.setItem('auth_token', token);
            localStorage.setItem('auth_token_expiry', this._tokenExpiry);
        };

        this.validateToken = async () => {
            if (!this._token) return false;

            try {
                const response = await fetch('/api/auth/validate', {
                    headers: {
                        'Authorization': `Bearer ${this._token}`
                    }
                });

                if (!response.ok) {
                    this.clearAuth();
                    return false;
                }

                this.logInfo('Token validated from session cache');
                return true;
            } catch (error) {
                this.logError('Token validation failed', error);
                this.clearAuth();
                return false;
            }
        };

        this.initialize = async () => {
            if (this._initializing) return;
            if (this._initialized) return;

            this._initializing = true;
            this.logInfo('Starting initialization');

            try {
                if (this._token && this._tokenExpiry) {
                    this.logInfo(`Stored token check: token=${!!this._token}, expiry=${this._tokenExpiry}`);
                    const now = new Date();
                    const expiry = new Date(this._tokenExpiry);
                    this.logInfo(`Token expiry check during init: current=${now.toISOString()}, expiry=${expiry.toISOString()}`);

                    if (now < expiry) {
                        this.logInfo('Valid token loaded from storage');
                        await this.validateToken();
                    } else {
                        this.logInfo('Token expired, clearing auth');
                        this.clearAuth();
                    }
                }

                this._initialized = true;
                this.logInfo('Initialization complete');
            } catch (error) {
                this.logError('Initialization failed', error);
                this.clearAuth();
            } finally {
                this._initializing = false;
            }
        };

        this.login = async (email, password) => {
            try {
                const response = await fetch('/api/auth/login', {
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
                this.setToken(data.token);
                return true;
            } catch (error) {
                this.logError('Login failed', error);
                return false;
            }
        };

        this.register = async (email, password, referralCode = '') => {
            try {
                const response = await fetch('/api/auth/register', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ email, password, referralCode })
                });

                if (!response.ok) {
                    throw new Error('Registration failed');
                }

                const data = await response.json();
                this.setToken(data.token);
                return true;
            } catch (error) {
                this.logError('Registration failed', error);
                return false;
            }
        };

        this.logout = async () => {
            try {
                await fetch('/api/auth/logout', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${this._token}`
                    }
                });
            } catch (error) {
                this.logError('Logout failed', error);
            } finally {
                this.clearAuth();
                window.location.href = '/auth/login';
            }
        };

        this.getUser = async () => {
            if (!this._token) return null;

            try {
                const response = await fetch('/api/auth/user', {
                    headers: {
                        'Authorization': `Bearer ${this._token}`
                    }
                });

                if (!response.ok) {
                    throw new Error('Failed to get user data');
                }

                return await response.json();
            } catch (error) {
                this.logError('Get user failed', error);
                return null;
            }
        };

        this.isAdmin = async () => {
            const user = await this.getUser();
            return user && user.isAdmin;
        };

        this.logInfo('Auth service instance created');
        this.logInfo('Auth service setup complete');

        // Initialize immediately
        this.initialize();
    }
}

// Create and expose a singleton instance
const authServiceInstance = new AuthService();

// Use Object.defineProperty to ensure the instance is properly bound
Object.defineProperty(window, 'authService', {
    value: authServiceInstance,
    writable: false,
    configurable: false
});