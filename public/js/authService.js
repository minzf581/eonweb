// AuthService implementation with improved error handling and checks
(function() {
    // Helper functions
    function logError(context, error) {
        console.error(`[AuthService] ${context}:`, error);
        console.error('[AuthService] Stack:', error.stack);
    }

    function logInfo(message) {
        console.log(`[AuthService] ${message}`);
    }

    class AuthService {
        constructor() {
            if (typeof window === 'undefined') {
                throw new Error('AuthService requires a window object');
            }

            if (window.authService instanceof AuthService) {
                logInfo('Returning existing instance');
                return window.authService;
            }

            this._initialized = false;
            this._initializing = false;
            this._token = null;
            
            // Bind methods to instance
            this.initialize = this.initialize.bind(this);
            this.isInitialized = this.isInitialized.bind(this);
            this.login = this.login.bind(this);
            this.logout = this.logout.bind(this);
            this.clearAuth = this.clearAuth.bind(this);
            this.validateToken = this.validateToken.bind(this);
            this.getUser = this.getUser.bind(this);

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

                // Load stored token
                this._token = localStorage.getItem('auth_token');
                logInfo(`Token ${this._token ? 'found' : 'not found'} in storage`);

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

        isInitialized() {
            return this._initialized === true;
        }

        async login(email, password) {
            if (!this._initialized) {
                throw new Error('AuthService not initialized');
            }

            if (!email || !password) {
                throw new Error('Email and password are required');
            }

            try {
                logInfo(`Login attempt for: ${email}`);
                // Simulated login success
                this._token = 'simulated_token';
                localStorage.setItem('auth_token', this._token);
                return true;
            } catch (error) {
                logError('Login failed', error);
                this.clearAuth();
                throw error;
            }
        }

        async logout() {
            if (!this._initialized) {
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
            if (!this._initialized) {
                throw new Error('AuthService not initialized');
            }

            try {
                logInfo('Clearing auth data');
                localStorage.removeItem('auth_token');
                this._token = null;
            } catch (error) {
                logError('Clear auth failed', error);
                throw error;
            }
        }

        async validateToken() {
            if (!this._initialized) {
                throw new Error('AuthService not initialized');
            }

            try {
                const token = localStorage.getItem('auth_token');
                logInfo(`Validating token: ${token ? 'exists' : 'not found'}`);
                return !!token;
            } catch (error) {
                logError('Token validation failed', error);
                return false;
            }
        }

        getUser() {
            if (!this._initialized) {
                throw new Error('AuthService not initialized');
            }

            try {
                // Simulated user data
                return { email: 'user@example.com', name: 'Test User' };
            } catch (error) {
                logError('Get user failed', error);
                throw error;
            }
        }
    }

    // Helper function to check auth method availability
    function checkAuthMethod(methodName) {
        if (!window.authService) {
            logError('Method check failed', new Error('AuthService not available'));
            return false;
        }

        const methodExists = typeof window.authService[methodName] === 'function';
        if (!methodExists) {
            logError('Method check failed', new Error(`Method ${methodName} not available`));
        }
        return methodExists;
    }

    // Helper function to wait for auth service
    async function waitForAuthService(maxAttempts = 20) {
        logInfo('Waiting for service availability');
        
        for (let i = 0; i < maxAttempts; i++) {
            if (window.authService instanceof AuthService) {
                logInfo('Service instance found');
                
                if (!checkAuthMethod('initialize')) {
                    logError('Wait failed', new Error('Initialize method not available'));
                    return false;
                }

                try {
                    await window.authService.initialize();
                    logInfo('Service initialized successfully');
                    return true;
                } catch (error) {
                    logError('Service initialization failed', error);
                    return false;
                }
            }

            await new Promise(resolve => setTimeout(resolve, 100));
            logInfo(`Attempt ${i + 1}/${maxAttempts}`);
        }

        logError('Wait failed', new Error('Service not available after maximum attempts'));
        return false;
    }

    // Create and expose the singleton instance
    try {
        if (!window.authService) {
            window.authService = new AuthService();
        }

        // Expose helper functions
        window.waitForAuthService = waitForAuthService;
        window.checkAuthMethod = checkAuthMethod;

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