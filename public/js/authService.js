// AuthService implementation
class AuthService {
    constructor() {
        console.log('[AuthService] Creating new instance');
        
        this._initialized = false;
        this._initializing = false;
        this._token = localStorage.getItem('auth_token');
        this._tokenExpiry = localStorage.getItem('auth_token_expiry');

        // Log the instance structure
        console.log('[AuthService] Instance structure:', {
            _initialized: this._initialized,
            _initializing: this._initializing,
            _token: !!this._token,
            _tokenExpiry: this._tokenExpiry,
            getToken: typeof this.getToken,
            isInitialized: typeof this.isInitialized
        });

        this.logInfo('Auth service instance created');
        this.logInfo('Auth service setup complete');
        
        // Initialize immediately
        this.initialize().then(() => {
            console.log('[AuthService] Initialization complete, rechecking instance structure:', {
                _initialized: this._initialized,
                _initializing: this._initializing,
                _token: !!this._token,
                _tokenExpiry: this._tokenExpiry,
                getToken: typeof this.getToken,
                isInitialized: typeof this.isInitialized
            });
        });
    }

    logInfo(message) {
        console.log(`[AuthService ${new Date().toISOString()}] ${message}`);
    }

    logError(message, error) {
        console.error(`[AuthService ${new Date().toISOString()}] ${message}:`, error);
    }

    isInitialized() {
        console.log('[AuthService] Checking initialization status:', {
            _initialized: this._initialized,
            hasToken: !!this._token,
            tokenExpiry: this._tokenExpiry
        });
        return this._initialized;
    }

    getToken() {
        console.log('[AuthService] getToken called:', {
            _initialized: this._initialized,
            hasToken: !!this._token,
            tokenExpiry: this._tokenExpiry
        });

        try {
            if (!this._initialized) {
                throw new Error('AuthService not initialized');
            }
            return this._token;
        } catch (error) {
            this.logError('Error accessing token', error);
            return null;
        }
    }

    async initialize() {
        console.log('[AuthService] Initialize called:', {
            _initialized: this._initialized,
            _initializing: this._initializing
        });

        if (this._initializing || this._initialized) {
            console.log('[AuthService] Initialize skipped - already initialized or initializing');
            return;
        }

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
            
            // Log final state after initialization
            console.log('[AuthService] Final state after initialization:', {
                _initialized: this._initialized,
                _initializing: this._initializing,
                hasToken: !!this._token,
                tokenExpiry: this._tokenExpiry
            });
        } catch (error) {
            this.logError('Initialization failed', error);
            this.clearAuth();
        } finally {
            this._initializing = false;
        }
    }

    async validateToken() {
        console.log('[AuthService] validateToken called:', {
            hasToken: !!this._token
        });

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
    }

    clearAuth() {
        console.log('[AuthService] clearAuth called');
        this._token = null;
        this._tokenExpiry = null;
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
                    'Authorization': `Bearer ${this._token}`
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
        this._token = token;
        const expiry = new Date();
        expiry.setHours(expiry.getHours() + 24);
        this._tokenExpiry = expiry.toISOString();
        localStorage.setItem('auth_token', token);
        localStorage.setItem('auth_token_expiry', this._tokenExpiry);
    }

    async getUser() {
        console.log('[AuthService] getUser called:', {
            hasToken: !!this._token
        });

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

// Log the instance before attaching to window
console.log('[AuthService] Instance before attaching to window:', {
    instance: authService,
    hasGetToken: typeof authService.getToken === 'function',
    hasIsInitialized: typeof authService.isInitialized === 'function'
});

// Attach to window and make it non-configurable
Object.defineProperty(window, 'authService', {
    value: authService,
    writable: false,
    configurable: false
});

// Log the instance after attaching to window
console.log('[AuthService] Instance after attaching to window:', {
    instance: window.authService,
    hasGetToken: typeof window.authService.getToken === 'function',
    hasIsInitialized: typeof window.authService.isInitialized === 'function'
});