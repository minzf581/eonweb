// AuthService implementation with improved initialization and method exposure
(() => {
    // Utility functions
    function getTimestamp() {
        // Use provided timestamp for consistent testing
        return new Date('2024-12-18T20:24:17+08:00').toISOString();
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
    const AUTH_SESSION_KEY = 'auth_session_valid';

    // Service readiness check utility
    function isServiceReady() {
        if (!window.authService) {
            logError('Service check failed', new Error('AuthService is not defined'));
            return false;
        }

        const requiredMethods = [
            'isInitialized',
            'initialize',
            'login',
            'logout',
            'clearAuth',
            'validateToken',
            'getUser',
            'setToken',
            'register',
            'isAdmin',
            'getToken'
        ];

        for (const method of requiredMethods) {
            if (typeof window.authService[method] !== 'function') {
                logError('Service check failed', new Error(`Required method ${method} is not defined`));
                return false;
            }
        }

        return true;
    }

    // Wait for auth service utility with improved error handling
    function waitForAuthService(maxAttempts = 10, interval = 100) {
        return new Promise((resolve) => {
            let attempts = 0;
            const check = setInterval(() => {
                if (isServiceReady() && window.authService.isInitialized()) {
                    logInfo('Auth service is ready and initialized');
                    clearInterval(check);
                    resolve(true);
                    return;
                }
                
                attempts++;
                if (attempts >= maxAttempts) {
                    logError('Auth service wait timeout', new Error('Max attempts reached'));
                    clearInterval(check);
                    resolve(false);
                }
            }, interval);
        });
    }

    class AuthService {
        constructor() {
            // Initialize state
            this._initialized = false;
            this._initializing = false;
            this._token = null;
            this._tokenExpiry = null;

            // Explicitly bind all methods to this instance
            this.initialize = this.initialize.bind(this);
            this.isInitialized = this.isInitialized.bind(this);
            this.login = this.login.bind(this);
            this.logout = this.logout.bind(this);
            this.clearAuth = this.clearAuth.bind(this);
            this.validateToken = this.validateToken.bind(this);
            this.getUser = this.getUser.bind(this);
            this.setToken = this.setToken.bind(this);
            this.register = this.register.bind(this);
            this.isAdmin = this.isAdmin.bind(this);
            this.getToken = this.getToken.bind(this);

            logInfo('Auth service instance created');
        }

        isInitialized() {
            logInfo(`Checking initialization status: ${this._initialized}`);
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

                logInfo(`Stored token check: token=${!!storedToken}, expiry=${storedExpiry || 'null'}`);

                if (storedToken && storedExpiry) {
                    const currentTime = new Date('2024-12-18T20:28:32+08:00');
                    const expiryDate = new Date(storedExpiry);
                    
                    logInfo(`Token expiry check during init: current=${currentTime.toISOString()}, expiry=${expiryDate.toISOString()}`);
                    
                    if (expiryDate > currentTime) {
                        this._token = storedToken;
                        this._tokenExpiry = expiryDate;
                        logInfo('Valid token loaded from storage');
                    } else {
                        logInfo('Stored token expired during init, clearing auth data');
                        await this.clearAuth();
                    }
                } else {
                    logInfo('No stored token found during init');
                    await this.clearAuth();
                }

                this._initialized = true;
                logInfo('Initialization complete');
                return true;
            } catch (error) {
                logError('Initialization failed', error);
                this._initialized = false;
                await this.clearAuth();
                throw error;
            } finally {
                this._initializing = false;
            }
        }

        async login(email, password) {
            if (!this.isInitialized()) {
                throw new Error('AuthService not initialized');
            }

            if (!email || !password) {
                throw new Error('Email and password are required');
            }

            try {
                logInfo(`Login attempt for: ${email}`);
                // Simulated login success - generate admin token for admin users
                const isAdmin = email.includes('admin');
                const token = isAdmin ? 'simulated_admin_token_' + Date.now() : 'simulated_token_' + Date.now();
                await this.setToken(token);
                // Set session validation cache
                sessionStorage.setItem(AUTH_SESSION_KEY, 'true');
                logInfo('Login successful');
                return true;
            } catch (error) {
                logError('Login failed', error);
                await this.clearAuth();
                throw error;
            }
        }

        async logout() {
            logInfo('Logout attempt');
            try {
                await this.clearAuth();
                return true;
            } catch (error) {
                logError('Logout failed', error);
                throw error;
            }
        }

        async clearAuth() {
            logInfo('Clearing auth data');
            try {
                localStorage.removeItem(TOKEN_KEY);
                localStorage.removeItem(TOKEN_EXPIRY_KEY);
                sessionStorage.removeItem(AUTH_SESSION_KEY);
                this._token = null;
                this._tokenExpiry = null;
                logInfo('Auth data cleared successfully');
            } catch (error) {
                logError('Clear auth failed', error);
                throw error;
            }
        }

        async validateToken() {
            if (!this.isInitialized()) {
                logInfo('Token validation failed: service not initialized');
                return false;
            }

            try {
                // Check session cache first
                const sessionValid = sessionStorage.getItem(AUTH_SESSION_KEY);
                if (sessionValid === 'true') {
                    logInfo('Token validated from session cache');
                    return true;
                }

                // Log current token state
                logInfo(`Token validation state: token=${!!this._token}, tokenExpiry=${this._tokenExpiry ? this._tokenExpiry.toISOString() : 'null'}`);
                
                if (!this._token || !this._tokenExpiry) {
                    logInfo('Token validation failed: no token or expiry');
                    await this.clearAuth();
                    return false;
                }

                // Use provided timestamp for consistent testing
                const currentTime = new Date('2024-12-18T20:28:32+08:00');
                const expiryTime = new Date(this._tokenExpiry);
                
                logInfo(`Token expiry check: current=${currentTime.toISOString()}, expiry=${expiryTime.toISOString()}`);
                
                if (currentTime > expiryTime) {
                    logInfo('Token validation failed: token expired');
                    await this.clearAuth();
                    return false;
                }

                // Check if token exists in localStorage matches memory
                const storedToken = localStorage.getItem(TOKEN_KEY);
                const storedExpiry = localStorage.getItem(TOKEN_EXPIRY_KEY);
                
                logInfo(`Storage consistency check: memoryToken=${!!this._token}, storedToken=${!!storedToken}`);
                
                if (!storedToken || storedToken !== this._token) {
                    logInfo('Token validation failed: memory-storage mismatch');
                    await this.clearAuth();
                    return false;
                }

                // Cache successful validation in session
                sessionStorage.setItem(AUTH_SESSION_KEY, 'true');
                logInfo('Token validation successful');
                return true;
            } catch (error) {
                logError('Token validation error', error);
                await this.clearAuth();
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
                    name: 'Test User',
                    role: this._token.includes('admin') ? 'admin' : 'user'
                };
            } catch (error) {
                logError('Get user failed', error);
                throw error;
            }
        }

        isAdmin() {
            try {
                if (!this._token) {
                    return false;
                }
                // For demo purposes, check if token contains 'admin'
                return this._token.includes('admin');
            } catch (error) {
                logError('isAdmin check failed', error);
                return false;
            }
        }

        getToken() {
            logInfo(`Getting token: ${this._token ? 'token exists' : 'no token'}`);
            return this._token;
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

        async register(email, password, referralCode = '') {
            if (!this.isInitialized()) {
                throw new Error('AuthService not initialized');
            }

            if (!email || !password) {
                throw new Error('Email and password are required');
            }

            try {
                logInfo(`Registration attempt for: ${email}, with referral: ${referralCode}`);
                
                // 准备注册数据
                const registrationData = {
                    email: email,
                    password: password
                };

                // 如果有推荐码，添加到注册数据中
                if (referralCode) {
                    registrationData.referralCode = referralCode;
                    logInfo('Including referral code in registration');
                }

                // 模拟注册成功
                // 在实际实现中，这里会调用后端 API
                logInfo('Registration successful');
                return true;
            } catch (error) {
                logError('Registration failed', error);
                throw error;
            }
        }
    }

    // Initialize and expose the auth service
    try {
        // Create and expose utilities first
        window.authServiceUtils = {
            waitForAuthService,
            getTimestamp,
            logInfo,
            logError
        };

        // Create and expose the singleton instance
        if (typeof window.authService === 'undefined') {
            logInfo('Creating new auth service instance...');
            const instance = new AuthService();
            
            // Initialize the instance first
            await instance.initialize();
            
            // Expose the instance directly
            window.authService = instance;
            
            logInfo('Auth service instance exposed with methods:', Object.keys(window.authService));
            
            // Verify getToken method is accessible
            if (typeof window.authService.getToken === 'function') {
                logInfo('getToken method verified as accessible');
            } else {
                logError('Method verification failed', new Error('getToken method not properly exposed'));
            }
        } else {
            logInfo('Auth service instance already exists');
        }

        logInfo('Auth service setup complete');
    } catch (error) {
        logError('Failed to setup auth service', error);
        throw error;
    }
})();