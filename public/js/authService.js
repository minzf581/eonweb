// AuthService class definition
class AuthService {
    constructor() {
        this.DEBUG = process.env.NODE_ENV !== 'production';
        this._initialized = false;
        this._redirecting = false;

        try {
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
        } catch (error) {
            this.error('Initialization failed:', error);
            throw new Error('AuthService initialization failed: ' + error.message);
        }
    }

    // Logging utilities
    debug(...args) {
        if (this.DEBUG) {
            console.debug('[AuthService]', ...args);
        }
    }

    log(...args) {
        console.log('[AuthService]', ...args);
    }

    error(...args) {
        console.error('[AuthService]', ...args);
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

// Create and expose the auth service instance
const initializeAuthService = () => {
    console.log('[AuthService] Initializing auth service...');
    try {
        if (!window.authService) {
            window.authService = new AuthService();
            console.log('[AuthService] Auth service initialized successfully');
        } else {
            console.log('[AuthService] Auth service already initialized');
        }
        return window.authService;
    } catch (error) {
        console.error('[AuthService] Failed to initialize auth service:', error);
        throw error;
    }
};

// Helper function to check if a method exists
const checkMethod = (methodName) => {
    if (!window.authService) {
        console.error(`[AuthService] Auth service not initialized when checking ${methodName}`);
        return false;
    }
    if (typeof window.authService[methodName] !== 'function') {
        console.error(`[AuthService] Method ${methodName} is not defined`);
        return false;
    }
    return true;
};

// Expose globally
window.authService = null;
window.initializeAuthService = initializeAuthService;
window.checkAuthMethod = checkMethod;

// Initialize when the script loads
if (typeof window !== 'undefined') {
    console.log('[AuthService] Script loaded, initializing...');
    initializeAuthService();
}