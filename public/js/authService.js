// AuthService class definition
class AuthService {
    constructor() {
        // Log current location for debugging
        console.log('Current location:', {
            href: window.location.href,
            hostname: window.location.hostname,
            protocol: window.location.protocol,
            origin: window.location.origin
        });

        // Initialize API paths
        this.AUTH_BASE = '/api/auth';
        this.API_BASE = '/api';
        console.log('[AuthService] Using API paths:', { auth: this.AUTH_BASE, api: this.API_BASE });

        // Initialize storage keys
        this.TOKEN_KEY = 'token';
        this.USER_KEY = 'user';
        
        // Load initial token
        this._token = localStorage.getItem(this.TOKEN_KEY);
        this._initialized = true;
        
        // Bind methods to instance
        this.isInitialized = this.isInitialized.bind(this);
        this.isAuthenticated = this.isAuthenticated.bind(this);
        this.validateToken = this.validateToken.bind(this);
        this.clearAuth = this.clearAuth.bind(this);
        this.setAuth = this.setAuth.bind(this);
        this.getToken = this.getToken.bind(this);
        this.getUser = this.getUser.bind(this);
        this.login = this.login.bind(this);
        this.logout = this.logout.bind(this);
    }

    isInitialized() {
        return this._initialized === true;
    }

    isAuthenticated() {
        return !!this.getToken();
    }

    async validateToken() {
        try {
            const token = this.getToken();
            if (!token) {
                console.log('[AuthService] No token found');
                return false;
            }

            const response = await fetch(`${this.AUTH_BASE}/validate`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) {
                console.log('[AuthService] Token validation failed');
                this.clearAuth();
                return false;
            }

            return true;
        } catch (error) {
            console.error('[AuthService] Token validation error:', error);
            this.clearAuth();
            return false;
        }
    }

    clearAuth() {
        console.log('[AuthService] Clearing auth data...');
        localStorage.removeItem(this.TOKEN_KEY);
        localStorage.removeItem(this.USER_KEY);
        this._token = null;
    }

    setAuth(token, user) {
        console.log('[AuthService] Setting auth data...');
        localStorage.setItem(this.TOKEN_KEY, token);
        localStorage.setItem(this.USER_KEY, JSON.stringify(user));
        this._token = token;
    }

    getToken() {
        return this._token;
    }

    getUser() {
        try {
            const userStr = localStorage.getItem(this.USER_KEY);
            return userStr ? JSON.parse(userStr) : null;
        } catch (error) {
            console.error('[AuthService] Error getting user:', error);
            return null;
        }
    }

    async login(email, password) {
        try {
            const response = await fetch(`${this.AUTH_BASE}/login`, {
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
            this.setAuth(data.token, data.user);
            return true;
        } catch (error) {
            console.error('[AuthService] Login error:', error);
            this.clearAuth();
            throw error;
        }
    }

    async logout() {
        console.log('[AuthService] Logging out...');
        this.clearAuth();
        window.location.href = '/public/auth/login.html';
    }
}

// Create and expose the auth service instance
const initializeAuthService = () => {
    console.log('[AuthService] Initializing auth service...');
    if (!window.authService) {
        window.authService = new AuthService();
    }
    return window.authService;
};

// Expose initializeAuthService globally
window.initializeAuthService = initializeAuthService;

// Initialize when the script loads
if (typeof window !== 'undefined') {
    console.log('[AuthService] Script loaded, initializing...');
    initializeAuthService();
}