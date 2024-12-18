// AuthService implementation with improved initialization and method exposure
(() => {
    // Utility functions
    function getTimestamp() {
        return new Date().toISOString();
    }

    function logError(context, error) {
        console.error(`[AuthService ${getTimestamp()}] ${context}:`, error);
        console.error(`[AuthService ${getTimestamp()}] Stack:`, error.stack);
    }

    function logInfo(message) {
        console.log(`[AuthService ${getTimestamp()}] ${message}`);
    }

    // Constants
    const TOKEN_KEY = 'auth_token';
    const TOKEN_EXPIRY_KEY = 'auth_token_expiry';
    const TOKEN_EXPIRY_HOURS = 24;

    // Wait for auth service utility
    function waitForAuthService(maxAttempts = 10, interval = 100) {
        return new Promise((resolve) => {
            let attempts = 0;
            const check = setInterval(() => {
                if (window.authService?.isInitialized()) {
                    clearInterval(check);
                    resolve(true);
                    return;
                }
                attempts++;
                if (attempts >= maxAttempts) {
                    clearInterval(check);
                    resolve(false);
                }
            }, interval);
        });
    }

    class AuthService {
        constructor() {
            this._initialized = false;
            this._initializing = false;
            this._token = null;
            this._tokenExpiry = null;

            // Bind methods to instance
            [
                'initialize',
                'isInitialized',
                'login',
                'logout',
                'clearAuth',
                'validateToken',
                'getUser',
                'setToken'
            ].forEach(method => {
                if (typeof this[method] === 'function') {
                    this[method] = this[method].bind(this);
                }
            });

            logInfo('Auth service instance created');
        }

        isInitialized() {
            return this._initialized === true;
        }

        async initialize() {
            if (this._initialized) {
                logInfo('Already initialized');
                return true;
            }

            if (this._initializing) {
                logInfo('Initialization in progress');
                return new Promise((resolve) => {
                    const checkInit = setInterval(() => {
                        if (this._initialized) {
                            clearInterval(checkInit);
                            resolve(true);
                        }
                    }, 100);
                });
            }

            try {
                this._initializing = true;
                logInfo('Starting initialization');

                // Load and validate stored token
                const storedToken = localStorage.getItem(TOKEN_KEY);
                const storedExpiry = localStorage.getItem(TOKEN_EXPIRY_KEY);

                if (storedToken && storedExpiry) {
                    const expiryDate = new Date(storedExpiry);
                    if (expiryDate > new Date()) {
                        this._token = storedToken;
                        this._tokenExpiry = expiryDate;
                        logInfo('Valid token loaded from storage');
                    } else {
                        logInfo('Stored token expired, clearing auth data');
                        await this.clearAuth();
                    }
                }

                this._initialized = true;
                logInfo('Initialization complete');
                return true;
            } catch (error) {
                logError('Initialization failed', error);
                this._initialized = false;
                throw error;
            } finally {
                this._initializing = false;
            }
        }

        async login(email, password) {
            if (!this.isInitialized()) {
                throw new Error('AuthService not initialized');
            }

            try {
                logInfo(`Login attempt for: ${email}`);
                // Simulated login success
                const token = 'simulated_token_' + Date.now();
                await this.setToken(token);
                return true;
            } catch (error) {
                logError('Login failed', error);
                await this.clearAuth();
                throw error;
            }
        }

        async logout() {
            if (!this.isInitialized()) {
                throw new Error('AuthService not initialized');
            }

            try {
                logInfo('Logging out');
                await this.clearAuth();
                return true;
            } catch (error) {
                logError('Logout failed', error);
                throw error;
            }
        }

        async clearAuth() {
            try {
                logInfo('Clearing auth data');
                localStorage.removeItem(TOKEN_KEY);
                localStorage.removeItem(TOKEN_EXPIRY_KEY);
                this._token = null;
                this._tokenExpiry = null;
            } catch (error) {
                logError('Clear auth failed', error);
                throw error;
            }
        }

        async validateToken() {
            if (!this.isInitialized()) {
                throw new Error('AuthService not initialized');
            }

            try {
                if (!this._token || !this._tokenExpiry) {
                    logInfo('No token or expiry found');
                    return false;
                }

                if (new Date() > this._tokenExpiry) {
                    logInfo('Token expired');
                    await this.clearAuth();
                    return false;
                }

                logInfo('Token is valid');
                return true;
            } catch (error) {
                logError('Token validation failed', error);
                return false;
            }
        }

        async getUser() {
            if (!this.isInitialized()) {
                throw new Error('AuthService not initialized');
            }

            try {
                if (!this._token) {
                    throw new Error('No authenticated user');
                }
                return {
                    email: 'user@example.com',
                    name: 'Test User'
                };
            } catch (error) {
                logError('Get user failed', error);
                throw error;
            }
        }

        async setToken(token) {
            if (!token) {
                throw new Error('Token is required');
            }

            try {
                const expiry = new Date();
                expiry.setHours(expiry.getHours() + TOKEN_EXPIRY_HOURS);

                this._token = token;
                this._tokenExpiry = expiry;

                localStorage.setItem(TOKEN_KEY, token);
                localStorage.setItem(TOKEN_EXPIRY_KEY, expiry.toISOString());

                logInfo('Token set successfully');
            } catch (error) {
                logError('Failed to set token', error);
                throw error;
            }
        }
    }

    // Initialize and expose the auth service
    try {
        // Create and expose utilities
        window.authServiceUtils = {
            waitForAuthService,
            getTimestamp,
            logInfo,
            logError
        };

        // Create and expose the singleton instance
        window.authService = new AuthService();
        
        // Initialize on page load
        window.addEventListener('load', () => {
            logInfo('Page loaded, initializing service');
            window.authService.initialize().catch(error => {
                logError('Load initialization failed', error);
            });
        });
    } catch (error) {
        logError('Service setup failed', error);
    }
})();