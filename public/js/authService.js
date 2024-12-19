// AuthService implementation
class AuthService {
    constructor() {
        console.log('[AuthService] Creating new instance');
        
        // Private fields
        this._data = {
            initialized: false,
            initializing: false,
            token: localStorage.getItem('auth_token'),
            tokenExpiry: localStorage.getItem('auth_token_expiry')
        };
        
        // Log the instance structure
        console.log('[AuthService] Instance structure:', {
            initialized: this.initialized,
            initializing: this.initializing,
            hasToken: !!this.token,
            tokenExpiry: this.tokenExpiry,
            getToken: typeof this.getToken
        });

        this.logInfo('Auth service instance created');
        this.logInfo('Auth service setup complete');
        
        // Initialize immediately
        this.initialize().then(() => {
            console.log('[AuthService] Initialization complete, rechecking instance structure:', {
                initialized: this.initialized,
                initializing: this.initializing,
                hasToken: !!this.token,
                tokenExpiry: this.tokenExpiry,
                getToken: typeof this.getToken
            });
        });
    }

    // Getters
    get initialized() {
        return this._data.initialized;
    }

    get token() {
        return this._data.token;
    }

    get tokenExpiry() {
        return this._data.tokenExpiry;
    }

    // Methods
    logInfo(message) {
        console.log(`[AuthService ${new Date().toISOString()}] ${message}`);
    }

    logError(message, error) {
        console.error(`[AuthService ${new Date().toISOString()}] ${message}:`, error);
    }

    isInitialized() {
        console.log('[AuthService] Checking initialization status:', {
            initialized: this.initialized,
            hasToken: !!this.token,
            tokenExpiry: this.tokenExpiry
        });
        return this.initialized;
    }

    getToken() {
        console.log('[AuthService] getToken called:', {
            initialized: this.initialized,
            hasToken: !!this.token,
            tokenExpiry: this.tokenExpiry
        });

        try {
            if (!this.initialized) {
                throw new Error('AuthService not initialized');
            }
            return this.token;
        } catch (error) {
            this.logError('Error accessing token', error);
            return null;
        }
    }

    async initialize() {
        console.log('[AuthService] Initialize called:', {
            initialized: this.initialized,
            initializing: this.initializing
        });

        if (this.initializing || this.initialized) {
            console.log('[AuthService] Initialize skipped - already initialized or initializing');
            return;
        }

        this._data.initializing = true;
        this.logInfo('Starting initialization');

        try {
            if (this.token && this.tokenExpiry) {
                this.logInfo(`Stored token check: token=${!!this.token}, expiry=${this.tokenExpiry}`);
                const now = new Date();
                const expiry = new Date(this.tokenExpiry);
                this.logInfo(`Token expiry check during init: current=${now.toISOString()}, expiry=${expiry.toISOString()}`);

                if (now < expiry) {
                    this.logInfo('Valid token loaded from storage');
                    await this.validateToken();
                } else {
                    this.logInfo('Token expired, clearing auth');
                    this.clearAuth();
                }
            }

            this._data.initialized = true;
            this.logInfo('Initialization complete');
            
            // Log final state after initialization
            console.log('[AuthService] Final state after initialization:', {
                initialized: this.initialized,
                initializing: this.initializing,
                hasToken: !!this.token,
                tokenExpiry: this.tokenExpiry
            });
        } catch (error) {
            this.logError('Initialization failed', error);
            this.clearAuth();
        } finally {
            this._data.initializing = false;
        }
    }

    async validateToken() {
        console.log('[AuthService] validateToken called:', {
            hasToken: !!this.token
        });

        if (!this.token) return false;

        try {
            const response = await fetch('/api/auth/validate', {
                headers: {
                    'Authorization': `Bearer ${this.token}`
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
    }

    clearAuth() {
        console.log('[AuthService] clearAuth called');
        this._data.token = null;
        this._data.tokenExpiry = null;
        localStorage.removeItem('auth_token');
        localStorage.removeItem('auth_token_expiry');
        this.logInfo('Auth cleared');
    }

    async logout() {
        console.log('[AuthService] logout called');
        try {
            await fetch('/api/auth/logout', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });
        } catch (error) {
            this.logError('Logout failed', error);
        } finally {
            this.clearAuth();
            window.location.href = '/auth/login';
        }
    }

    async login(email, password) {
        console.log('[AuthService] login called');
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
    }

    async register(email, password, referralCode = '') {
        console.log('[AuthService] register called');
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
    }

    setToken(token) {
        console.log('[AuthService] setToken called');
        this._data.token = token;
        const expiry = new Date();
        expiry.setHours(expiry.getHours() + 24);
        this._data.tokenExpiry = expiry.toISOString();
        localStorage.setItem('auth_token', token);
        localStorage.setItem('auth_token_expiry', this._data.tokenExpiry);
    }

    async getUser() {
        console.log('[AuthService] getUser called:', {
            hasToken: !!this.token
        });

        if (!this.token) return null;

        try {
            const response = await fetch('/api/auth/user', {
                headers: {
                    'Authorization': `Bearer ${this.token}`
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
    }

    async isAdmin() {
        console.log('[AuthService] isAdmin called');
        const user = await this.getUser();
        return user && user.isAdmin;
    }
}

// Create and expose the singleton instance
console.log('[AuthService] Creating global instance');
const authService = new AuthService();

// Log the instance and its methods
console.log('[AuthService] Instance methods check:', {
    instance: authService,
    getToken: authService.getToken,
    isInitialized: authService.isInitialized,
    methodNames: Object.getOwnPropertyNames(AuthService.prototype)
});

// Define the window.authService property with a getter
Object.defineProperty(window, 'authService', {
    get() {
        return authService;
    },
    configurable: false,
    enumerable: true
});