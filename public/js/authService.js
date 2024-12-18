// AuthService implementation with improved method exposure and error handling
(function() {
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

    // Error types for better error handling
    class AuthError extends Error {
        constructor(message, type = 'AUTH_ERROR') {
            super(message);
            this.name = 'AuthError';
            this.type = type;
        }
    }

    // Network retry utility
    async function retryOperation(operation, maxRetries = 3, delay = 1000) {
        let lastError;
        
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                return await operation();
            } catch (error) {
                lastError = error;
                if (attempt < maxRetries) {
                    logInfo(`Retry attempt ${attempt}/${maxRetries}`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
            }
        }
        
        throw lastError;
    }

    // Network status check
    function checkNetworkStatus() {
        return navigator.onLine;
    }

    // Constants
    const TOKEN_KEY = 'auth_token';
    const TOKEN_EXPIRY_KEY = 'auth_token_expiry';
    const TOKEN_EXPIRY_HOURS = 24;

    class AuthService {
        constructor() {
            if (typeof window === 'undefined') {
                throw new AuthError('AuthService requires a window object', 'NO_WINDOW');
            }

            // Return existing instance if available
            if (window.authService instanceof AuthService) {
                logInfo('Returning existing instance');
                return window.authService;
            }

            this._initialized = false;
            this._initializing = false;
            this._token = null;
            this._tokenExpiry = null;

            // Bind all methods to instance
            const methods = [
                'initialize', 'isInitialized', 'login', 'logout',
                'clearAuth', 'validateToken', 'getUser', 'setToken'
            ];
            
            methods.forEach(method => {
                if (typeof this[method] === 'function') {
                    this[method] = this[method].bind(this);
                } else {
                    logError(`Method binding failed`, new Error(`Method ${method} not found`));
                }
            });

            // Expose methods directly on the instance
            Object.defineProperties(this, {
                isInitialized: {
                    enumerable: true,
                    value: () => this._initialized
                },
                clearAuth: {
                    enumerable: true,
                    value: this.clearAuth
                },
                validateToken: {
                    enumerable: true,
                    value: this.validateToken
                },
                login: {
                    enumerable: true,
                    value: this.login
                },
                logout: {
                    enumerable: true,
                    value: this.logout
                },
                getUser: {
                    enumerable: true,
                    value: this.getUser
                }
            });

            logInfo('New instance created');
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

        setToken(token) {
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

        async login(email, password) {
            if (!this._initialized) {
                throw new AuthError('AuthService not initialized', 'NOT_INITIALIZED');
            }

            if (!email || !password) {
                throw new AuthError('Email and password are required', 'INVALID_INPUT');
            }

            if (!checkNetworkStatus()) {
                throw new AuthError('No internet connection', 'NETWORK_ERROR');
            }

            try {
                logInfo(`Login attempt for: ${email}`);
                return await retryOperation(async () => {
                    // Simulated login success
                    const token = 'simulated_token_' + Date.now();
                    await this.setToken(token);
                    return true;
                });
            } catch (error) {
                logError('Login failed', error);
                await this.clearAuth();
                throw new AuthError(
                    error.message || 'Login failed',
                    error.type || 'LOGIN_ERROR'
                );
            }
        }

        async logout() {
            if (!this._initialized) {
                throw new Error('AuthService not initialized');
            }

            try {
                logInfo('Logging out');
                await this.clearAuth();
                
                // Clear any session storage
                sessionStorage.clear();
                
                // Clear any cookies
                document.cookie.split(';').forEach(cookie => {
                    document.cookie = cookie.replace(/^ +/, '').replace(/=.*/, '=;expires=' + new Date().toUTCString() + ';path=/');
                });
                
                return true;
            } catch (error) {
                logError('Logout failed', error);
                throw error;
            }
        }

        async clearAuth() {
            if (!this._initialized) {
                throw new Error('AuthService not initialized');
            }

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
            if (!this._initialized) {
                throw new AuthError('AuthService not initialized', 'NOT_INITIALIZED');
            }

            try {
                if (!this._token || !this._tokenExpiry) {
                    logInfo('No token or expiry found');
                    return { valid: false, reason: 'NO_TOKEN' };
                }

                if (new Date() > this._tokenExpiry) {
                    logInfo('Token expired');
                    await this.clearAuth();
                    return { valid: false, reason: 'TOKEN_EXPIRED' };
                }

                if (!checkNetworkStatus()) {
                    return { valid: false, reason: 'NETWORK_ERROR' };
                }

                logInfo('Token is valid');
                return { valid: true, reason: null };
            } catch (error) {
                logError('Token validation failed', error);
                return { valid: false, reason: 'VALIDATION_ERROR' };
            }
        }

        getUser() {
            if (!this._initialized) {
                throw new Error('AuthService not initialized');
            }

            try {
                if (!this._token) {
                    throw new Error('No authenticated user');
                }
                // Simulated user data
                return {
                    email: 'user@example.com',
                    name: 'Test User',
                    avatar: 'https://via.placeholder.com/150'
                };
            } catch (error) {
                logError('Get user failed', error);
                throw error;
            }
        }
    }

    // Helper function to check auth method availability with error handling
    function checkAuthMethod(methodName) {
        try {
            if (!window.authService) {
                throw new AuthError('AuthService not available', 'SERVICE_UNAVAILABLE');
            }

            const service = window.authService;
            const method = service[methodName];

            if (typeof method !== 'function') {
                throw new AuthError(`Method ${methodName} not available`, 'METHOD_UNAVAILABLE');
            }

            // Ensure method is bound to service instance
            if (method.bind(service) !== method) {
                throw new AuthError(`Method ${methodName} not properly bound`, 'METHOD_BINDING_ERROR');
            }

            return true;
        } catch (error) {
            logError(`Method check failed: ${methodName}`, error);
            return false;
        }
    }

    // Helper function to wait for auth service with timeout
    async function waitForAuthService(maxAttempts = 20, interval = 100) {
        logInfo('Waiting for service availability');
        
        let attempts = 0;
        const timeout = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Service wait timeout')), maxAttempts * interval);
        });

        const checkService = new Promise(async (resolve) => {
            while (attempts < maxAttempts) {
                if (window.authService instanceof AuthService) {
                    logInfo('Service instance found');
                    
                    if (!checkAuthMethod('initialize')) {
                        logError('Wait failed', new Error('Initialize method not available'));
                        resolve(false);
                        return;
                    }

                    try {
                        await window.authService.initialize();
                        logInfo('Service initialized successfully');
                        resolve(true);
                        return;
                    } catch (error) {
                        logError('Service initialization failed', error);
                        resolve(false);
                        return;
                    }
                }

                attempts++;
                await new Promise(resolve => setTimeout(resolve, interval));
                logInfo(`Attempt ${attempts}/${maxAttempts}`);
            }
            resolve(false);
        });

        try {
            return await Promise.race([checkService, timeout]);
        } catch (error) {
            logError('Wait failed', error);
            return false;
        }
    }

    // Create and expose the singleton instance and utilities
    try {
        // Create auth service namespace with enhanced utilities
        window.authServiceUtils = {
            waitForAuthService,
            checkAuthMethod,
            getTimestamp,
            checkNetworkStatus,
            AuthError,
            initializeAuthService: async () => {
                if (!window.authService) {
                    window.authService = new AuthService();
                }
                return await window.authService.initialize();
            }
        };

        // Create singleton instance with error handling
        if (!window.authService) {
            window.authService = new AuthService();
        }

        // Initialize on page load with retry logic
        window.addEventListener('load', () => {
            logInfo('Page loaded, initializing service');
            window.authServiceUtils.initializeAuthService()
                .catch(error => {
                    logError('Load initialization failed', error);
                    window.dispatchEvent(new CustomEvent('auth:init:failed', { 
                        detail: { error } 
                    }));
                });
        });
    } catch (error) {
        logError('Service setup failed', error);
        throw new AuthError('Failed to setup auth service', 'SETUP_ERROR');
    }
})();