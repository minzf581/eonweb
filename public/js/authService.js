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
            this.logInfo('Auth service instance created');
            this._initialized = false;
            this._initializing = false;
            this._token = localStorage.getItem('auth_token');
            this._tokenExpiry = localStorage.getItem('auth_token_expiry');
            
            // Bind methods to ensure correct 'this' context
            this.initialize = this.initialize.bind(this);
            this.isInitialized = this.isInitialized.bind(this);
            this.getToken = this.getToken.bind(this);
            this.validateToken = this.validateToken.bind(this);
            this.clearAuth = this.clearAuth.bind(this);
            this.logout = this.logout.bind(this);
            
            this.logInfo('Auth service setup complete');
        }

        logInfo(message) {
            console.log(`[AuthService ${new Date().toISOString()}] ${message}`);
        }

        logError(message, error) {
            console.error(`[AuthService ${new Date().toISOString()}] ${message}`, error);
        }

        isInitialized() {
            return this._initialized;
        }

        async initialize() {
            if (this._initializing) {
                this.logInfo('Already initializing, waiting...');
                return new Promise((resolve) => {
                    const checkInterval = setInterval(() => {
                        if (!this._initializing) {
                            clearInterval(checkInterval);
                            resolve();
                        }
                    }, 100);
                });
            }

            if (this._initialized) {
                this.logInfo('Already initialized');
                return;
            }

            this._initializing = true;
            this.logInfo('Starting initialization');

            try {
                // 检查存储的令牌
                const storedToken = localStorage.getItem('auth_token');
                const storedExpiry = localStorage.getItem('auth_token_expiry');
                
                this.logInfo(`Stored token check: token=${!!storedToken}, expiry=${storedExpiry}`);
                
                if (storedToken && storedExpiry) {
                    const currentTime = new Date();
                    const expiryTime = new Date(storedExpiry);
                    
                    this.logInfo(`Token expiry check during init: current=${currentTime.toISOString()}, expiry=${expiryTime.toISOString()}`);
                    
                    if (expiryTime > currentTime) {
                        this._token = storedToken;
                        this._tokenExpiry = expiryTime;
                        this.logInfo('Valid token loaded from storage');
                    } else {
                        this.logInfo('Token expired during init, clearing auth');
                        await this.clearAuth();
                    }
                } else {
                    this.logInfo('No token in storage during init');
                    await this.clearAuth();
                }
                
                this._initialized = true;
                this.logInfo('Service initialized successfully');
                return true;
            } catch (error) {
                this.logError('Initialization failed', error);
                await this.clearAuth();
                throw error;
            } finally {
                this._initializing = false;
            }
        }

        getToken() {
            if (!this._initialized) {
                throw new Error('Auth service not initialized');
            }
            return this._token;
        }

        async validateToken() {
            if (!this._initialized) {
                throw new Error('Auth service not initialized');
            }

            if (!this._token || !this._tokenExpiry) {
                this.logInfo('No token to validate');
                return false;
            }

            const currentTime = new Date();
            const expiryTime = new Date(this._tokenExpiry);

            if (expiryTime <= currentTime) {
                this.logInfo('Token expired during validation');
                await this.clearAuth();
                return false;
            }

            try {
                const response = await fetch('/public/api/auth/validate', {
                    headers: {
                        'Authorization': `Bearer ${this._token}`
                    }
                });

                if (!response.ok) {
                    this.logInfo('Token validation failed with server');
                    await this.clearAuth();
                    return false;
                }

                return true;
            } catch (error) {
                this.logError('Token validation failed', error);
                await this.clearAuth();
                return false;
            }
        }

        async clearAuth() {
            this.logInfo('Clearing auth state');
            this._token = null;
            this._tokenExpiry = null;
            localStorage.removeItem('auth_token');
            localStorage.removeItem('auth_token_expiry');
            this._initialized = true;  // 即使清除认证也认为服务已初始化
        }

        async logout() {
            if (!this._initialized) {
                throw new Error('Auth service not initialized');
            }

            try {
                if (this._token) {
                    await fetch('/public/api/auth/logout', {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${this._token}`
                        }
                    });
                }
            } catch (error) {
                this.logError('Logout request failed', error);
            } finally {
                await this.clearAuth();
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
                this.logInfo(`Login attempt for: ${email}`);
                // Simulated login success - generate admin token for admin users
                const isAdmin = email.includes('admin');
                const token = isAdmin ? 'simulated_admin_token_' + Date.now() : 'simulated_token_' + Date.now();
                await this.setToken(token);
                // Set session validation cache
                sessionStorage.setItem(AUTH_SESSION_KEY, 'true');
                this.logInfo('Login successful');
                return true;
            } catch (error) {
                this.logError('Login failed', error);
                await this.clearAuth();
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
                this.logInfo(`Registration attempt for: ${email}, with referral: ${referralCode}`);
                
                // 准备注册数据
                const registrationData = {
                    email: email,
                    password: password
                };

                // 如果有推荐码，添加到注册数据中
                if (referralCode) {
                    registrationData.referralCode = referralCode;
                    this.logInfo('Including referral code in registration');
                }

                // 模拟注册成功
                // 在实际实现中，这里会调用后端 API
                this.logInfo('Registration successful');
                return true;
            } catch (error) {
                this.logError('Registration failed', error);
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

                this.logInfo('Token set successfully');
            } catch (error) {
                this.logError('Failed to set token', error);
                throw error;
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
                this.logError('Get user failed', error);
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
                this.logError('isAdmin check failed', error);
                return false;
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
            const instance = new AuthService();
            
            // 在页面加载完成后初始化
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', () => {
                    instance.logInfo('Page loaded, initializing service');
                    instance.initialize().catch(error => {
                        instance.logError('Failed to initialize auth service', error);
                    });
                });
            } else {
                instance.logInfo('Page already loaded, initializing service');
                instance.initialize().catch(error => {
                    instance.logError('Failed to initialize auth service', error);
                });
            }
            
            window.authService = instance;
        } else {
            logInfo('Auth service instance already exists');
        }

        logInfo('Auth service setup complete');
    } catch (error) {
        logError('Failed to setup auth service', error);
        throw error;
    }
})();