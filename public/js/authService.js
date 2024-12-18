// AuthService singleton implementation
class AuthService {
    constructor() {
        if (window.authService) {
            console.warn('[AuthService] Instance already exists, returning existing instance');
            return window.authService;
        }

        this.DEBUG = process.env.NODE_ENV !== 'production';
        this._initialized = false;
        this._initializing = false;
        this._redirecting = false;

        // Store instance in window object
        window.authService = this;
    }

    // Initialize the service
    async initialize() {
        if (this._initialized) {
            this.debug('Already initialized');
            return true;
        }

        if (this._initializing) {
            this.debug('Initialization already in progress');
            return false;
        }

        try {
            this._initializing = true;
            this.debug('Starting initialization...');

            // Initialize API paths
            this.AUTH_BASE = '/api/auth';
            this.API_BASE = '/api';
            this.debug('Using API paths:', { auth: this.AUTH_BASE, api: this.API_BASE });

            // Initialize storage keys
            this.TOKEN_KEY = 'token';
            this.USER_KEY = 'user';
            
            // Load initial token
            this._token = localStorage.getItem(this.TOKEN_KEY);
            
            // Bind all methods to instance
            this.isInitialized = this.isInitialized.bind(this);
            this.isAuthenticated = this.isAuthenticated.bind(this);
            this.validateToken = this.validateToken.bind(this);
            this.clearAuth = this.clearAuth.bind(this);
            this.setAuth = this.setAuth.bind(this);
            this.getToken = this.getToken.bind(this);
            this.getUser = this.getUser.bind(this);
            this.login = this.login.bind(this);
            this.logout = this.logout.bind(this);

            // Reset redirect state on page show
            window.addEventListener('pageshow', () => {
                this._redirecting = false;
            });

            this._initialized = true;
            this.debug('Initialization completed successfully');
            return true;
        } catch (error) {
            this.error('Initialization failed:', error);
            throw new Error('AuthService initialization failed: ' + error.message);
        } finally {
            this._initializing = false;
        }
    }

    // Logging utilities with timestamps
    debug(...args) {
        if (this.DEBUG) {
            console.debug(`[AuthService ${new Date().toISOString()}]`, ...args);
        }
    }

    log(...args) {
        console.log(`[AuthService ${new Date().toISOString()}]`, ...args);
    }

    error(...args) {
        console.error(`[AuthService ${new Date().toISOString()}]`, ...args);
    }

    // Check if the service is initialized
    isInitialized() {
        return this._initialized === true;
    }

    // Check if user is authenticated
    isAuthenticated() {
        return !!this.getToken();
    }

    // Validate the current token
    async validateToken() {
        try {
            const token = this.getToken();
            if (!token) {
                this.debug('No token found');
                return false;
            }

            const response = await fetch(`${this.AUTH_BASE}/validate`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) {
                this.debug('Token validation failed');
                this.clearAuth();
                return false;
            }

            this.debug('Token validation successful');
            return true;
        } catch (error) {
            this.error('Token validation error:', error);
            this.clearAuth();
            return false;
        }
    }

    // Clear authentication data
    clearAuth() {
        this.debug('Clearing auth data...');
        try {
            localStorage.removeItem(this.TOKEN_KEY);
            localStorage.removeItem(this.USER_KEY);
            this._token = null;
            this.debug('Auth data cleared successfully');
        } catch (error) {
            this.error('Error clearing auth data:', error);
            throw error;
        }
    }

    // Set authentication data
    setAuth(token, user) {
        this.debug('Setting auth data...');
        try {
            if (!token) {
                throw new Error('Token is required');
            }
            localStorage.setItem(this.TOKEN_KEY, token);
            localStorage.setItem(this.USER_KEY, JSON.stringify(user));
            this._token = token;
            this.debug('Auth data set successfully');
        } catch (error) {
            this.error('Error setting auth data:', error);
            throw error;
        }
    }

    // Get the current token
    getToken() {
        return this._token;
    }

    // Get the current user
    getUser() {
        try {
            const userStr = localStorage.getItem(this.USER_KEY);
            return userStr ? JSON.parse(userStr) : null;
        } catch (error) {
            this.error('Error getting user:', error);
            return null;
        }
    }

    // Login with credentials
    async login(email, password) {
        this.debug('Attempting login...');
        try {
            if (!email || !password) {
                throw new Error('Email and password are required');
            }

            const response = await fetch(`${this.AUTH_BASE}/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ email, password })
            });

            if (!response.ok) {
                throw new Error('Login failed: Invalid credentials');
            }

            const data = await response.json();
            if (!data.token) {
                throw new Error('Login failed: No token received');
            }

            this.setAuth(data.token, data.user);
            this.debug('Login successful');
            return true;
        } catch (error) {
            this.error('Login error:', error);
            this.clearAuth();
            throw error;
        }
    }

    // Logout and redirect
    async logout() {
        this.debug('Logging out...');
        try {
            if (this._redirecting) {
                this.debug('Redirect already in progress');
                return;
            }

            const currentPath = window.location.pathname;
            const loginPath = '/public/auth/login.html';
            
            this._redirecting = true;
            this.clearAuth();

            if (currentPath !== loginPath) {
                this.debug('Redirecting to login page...');
                window.location.href = loginPath;
            } else {
                this.debug('Already on login page');
            }
        } catch (error) {
            this.error('Logout error:', error);
            throw error;
        }
    }
}

// Helper function to wait for auth service initialization
async function waitForAuthService(maxAttempts = 20) {
    console.log('[AuthService] Waiting for service...');
    for (let i = 0; i < maxAttempts; i++) {
        if (window.authService?.isInitialized?.()) {
            console.log('[AuthService] Service is ready');
            return true;
        }
        await new Promise(resolve => setTimeout(resolve, 100));
        console.log(`[AuthService] Attempt ${i + 1}/${maxAttempts}`);
    }
    console.error('[AuthService] Service not available after maximum attempts');
    return false;
}

// Helper function to check if a method exists
function checkAuthMethod(methodName) {
    if (!window.authService) {
        console.error(`[AuthService] Service not initialized when checking ${methodName}`);
        return false;
    }
    if (typeof window.authService[methodName] !== 'function') {
        console.error(`[AuthService] Method ${methodName} is not defined`);
        return false;
    }
    return true;
}

// Initialize auth service
async function initializeAuthService() {
    console.log('[AuthService] Starting initialization...');
    try {
        // Create singleton instance if it doesn't exist
        if (!window.authService) {
            window.authService = new AuthService();
        }
        
        // Initialize the service
        await window.authService.initialize();
        console.log('[AuthService] Initialization successful');
        return window.authService;
    } catch (error) {
        console.error('[AuthService] Initialization failed:', error);
        throw error;
    }
}

// Expose globally
window.authService = null;
window.initializeAuthService = initializeAuthService;
window.waitForAuthService = waitForAuthService;
window.checkAuthMethod = checkAuthMethod;

// Initialize when the script loads
if (typeof window !== 'undefined') {
    console.log('[AuthService] Script loaded, initializing...');
    initializeAuthService().catch(error => {
        console.error('[AuthService] Auto-initialization failed:', error);
    });
}