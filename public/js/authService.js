class AuthService {
    #initialized = false;
    #redirecting = false;

    constructor() {
        console.log('[AuthService] Starting initialization...');
        try {
            this.AUTH_BASE = '/api/auth';
            this.API_BASE = '/api';
            this.tokenKey = 'token';
            this.userKey = 'user';
            this.token = localStorage.getItem(this.tokenKey);
            
            // Reset redirect state on page show
            window.addEventListener('pageshow', () => {
                this.#redirecting = false;
            });

            this.#initialized = true;
            console.log('[AuthService] Initialization completed successfully');
        } catch (error) {
            console.error('[AuthService] Initialization failed:', error);
            throw error;
        }
    }

    isInitialized() {
        return this.#initialized;
    }

    isAuthenticated() {
        const token = this.getToken();
        return !!token;
    }

    async validateToken() {
        try {
            if (!this.token) {
                console.log('[AuthService] No token found');
                return false;
            }

            const response = await fetch(`${this.AUTH_BASE}/validate`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${this.token}`
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
        localStorage.removeItem(this.tokenKey);
        localStorage.removeItem(this.userKey);
        this.token = null;
    }

    setAuth(token, user) {
        console.log('[AuthService] Setting auth data...');
        localStorage.setItem(this.tokenKey, token);
        localStorage.setItem(this.userKey, JSON.stringify(user));
        this.token = token;
    }

    getToken() {
        return this.token;
    }

    getUser() {
        const userStr = localStorage.getItem(this.userKey);
        return userStr ? JSON.parse(userStr) : null;
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
        if (this.#redirecting) return;
        this.#redirecting = true;
        this.clearAuth();
        window.location.href = '/public/auth/login.html';
    }
}

// Create and expose the global auth service instance
if (typeof window !== 'undefined') {
    if (!window.authService) {
        console.log('[AuthService] Creating global instance...');
        try {
            const auth = new AuthService();
            window.authService = auth;
            console.log('[AuthService] Global instance created successfully');
        } catch (error) {
            console.error('[AuthService] Failed to create global instance:', error);
            throw error;
        }
    }
}