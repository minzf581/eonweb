// AuthService implementation
class AuthService {
    constructor() {
        this.logInfo('Creating new instance');
        
        // Private fields
        this._data = {
            initialized: false,
            initializing: false,
            token: null,
            tokenExpiry: null,
            user: null,
            baseUrl: 'https://eonhome-445809.et.r.appspot.com',  // 使用 App Engine URL
            retryDelay: 1000,
            maxRetries: 3,
            requestTimeout: 10000
        };

        // Initialize immediately but don't wait
        this.initialize();
    }

    // Getters
    get initialized() {
        return this._data.initialized;
    }

    get initializing() {
        return this._data.initializing;
    }

    get token() {
        return this._data.token;
    }

    get tokenExpiry() {
        return this._data.tokenExpiry;
    }

    get getToken() {
        if (!this.initialized) {
            this.logInfo('getToken called before initialization');
            return null;
        }
        return this.token;
    }

    isInitialized() {
        return this._data.initialized;
    }

    isAdmin() {
        return this._data.user && this._data.user.isAdmin;
    }

    getUser() {
        return this._data.user;
    }

    // Logging methods
    logInfo(message, data = null) {
        const timestamp = new Date().toISOString();
        if (data) {
            console.log(`[AuthService] ${message}:`, data);
        } else {
            console.log(`[AuthService] ${message}`);
        }
    }

    logError(message, error) {
        console.error(`[AuthService] ${message}:`, error);
    }

    // Helper methods
    async fetchWithTimeout(url, options = {}) {
        const { timeout = this._data.requestTimeout } = options;
        
        this.logInfo(`Making request to ${url} with timeout ${timeout}ms`);
        this.logInfo('Request options:', {
            method: options.method,
            headers: options.headers,
            timeout
        });
        
        const controller = new AbortController();
        const id = setTimeout(() => {
            controller.abort();
            this.logError('Request timed out after', timeout, 'ms');
        }, timeout);
        
        try {
            const response = await fetch(url, {
                ...options,
                signal: controller.signal,
                headers: {
                    ...options.headers,
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                }
            });
            
            this.logInfo('Response received:', {
                status: response.status,
                statusText: response.statusText,
                headers: response.headers
            });
            
            if (response.status === 503 || response.status === 502 || response.status === 504) {
                throw new Error('Server temporarily unavailable');
            }
            
            return response;
        } finally {
            clearTimeout(id);
        }
    }

    async fetchWithRetry(url, options, retries = this._data.maxRetries) {
        this.logInfo(`Making request to: ${url}`);
        
        try {
            return await this.fetchWithTimeout(url, options);
        } catch (error) {
            this.logError('Request failed', { url, error: error.message });
            
            if (error.name === 'AbortError') {
                throw new Error('Request timeout. Please try again.');
            }
            
            if (retries > 0 && (error.message.includes('Failed to fetch') || 
                error.message.includes('temporarily unavailable'))) {
                this.logInfo(`Retrying request, ${retries} attempts remaining`);
                await new Promise(resolve => setTimeout(resolve, this._data.retryDelay));
                return this.fetchWithRetry(url, options, retries - 1);
            }
            
            throw error;
        }
    }

    async checkServerHealth() {
        try {
            this.logInfo('Checking server health...');
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 5000);
            
            try {
                const response = await fetch(`${this._data.baseUrl}/health`, {
                    signal: controller.signal
                });
                
                this.logInfo('Health check response:', {
                    status: response.status,
                    statusText: response.statusText
                });
                
                if (response.ok) {
                    const data = await response.json();
                    this.logInfo('Health check data:', data);
                }
                
                const isHealthy = response.ok;
                this.logInfo(`Server health check: ${isHealthy ? 'OK' : 'Failed'}`);
                return isHealthy;
            } finally {
                clearTimeout(timeout);
            }
        } catch (error) {
            if (error.name === 'AbortError') {
                this.logError('Server health check timed out');
                return false;
            }
            this.logError('Server health check failed:', error);
            return false;
        }
    }

    async makeRequest(endpoint, options = {}) {
        const url = `${this._data.baseUrl}${endpoint}`;
        this.logInfo('Making request to:', url);

        const finalOptions = {
            ...options,
            timeout: this._data.requestTimeout,
            headers: {
                ...options.headers,
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            }
        };

        if (this._data.token) {
            finalOptions.headers['Authorization'] = `Bearer ${this._data.token}`;
        }

        this.logInfo('Request options:', finalOptions);

        try {
            const response = await this.fetchWithRetry(url, finalOptions);
            this.logInfo('Response received:', {
                status: response.status,
                statusText: response.statusText,
                headers: response.headers
            });

            const data = await response.json();
            this.logInfo('Response data:', data);

            if (!data.success) {
                throw new Error(data.message || 'Request failed');
            }

            return data;
        } catch (error) {
            this.logError('Request failed:', error);
            throw error;
        }
    }

    async getReferralInfo() {
        try {
            const data = await this.makeRequest('/api/users/referrals');
            return data;
        } catch (error) {
            this.logError('Failed to get referral info:', error);
            throw error;
        }
    }

    async register(email, password, referralCode = null) {
        try {
            const response = await this.makeRequest('/api/auth/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    email,
                    password,
                    referralCode
                })
            });

            const data = await response.json();
            
            // 保存认证信息
            this._data.token = data.token;
            this._data.user = data.user;

            // 存储到 localStorage
            localStorage.setItem('authToken', data.token);
            localStorage.setItem('user', JSON.stringify(data.user));

            return {
                success: true,
                user: data.user
            };
        } catch (error) {
            this.logError('Registration failed:', error);
            throw error;
        }
    }

    // Core methods
    async initialize() {
        if (this._data.initializing || this._data.initialized) {
            return;
        }

        this.logInfo('Starting initialization');
        this._data.initializing = true;

        try {
            // 从 localStorage 恢复 token
            const savedToken = localStorage.getItem('authToken');
            const savedUser = localStorage.getItem('user');

            if (savedToken && savedUser) {
                this._data.token = savedToken;
                this._data.user = JSON.parse(savedUser);
                
                // 验证 token
                try {
                    const isValid = await this.verifyToken();
                    if (!isValid) {
                        this.clearAuth();
                    }
                } catch (error) {
                    this.logError('Token verification failed:', error);
                    this.clearAuth();
                }
            }
        } catch (error) {
            this.logError('Initialization error:', error);
            this.clearAuth();
        } finally {
            this._data.initialized = true;
            this._data.initializing = false;
            this.logInfo('Initialization complete:', {
                hasToken: !!this._data.token,
                tokenExpiry: this._data.tokenExpiry,
                isAdmin: this.isAdmin()
            });
        }
    }

    async verifyToken() {
        if (!this._data.token) {
            return false;
        }

        try {
            const response = await this.makeRequest('/api/auth/verify-token', {
                method: 'GET'
            });

            if (response.ok) {
                const data = await response.json();
                this.logInfo('Token validation successful:', data);
                return true;
            } else {
                this.logInfo('Token validation failed');
                return false;
            }
        } catch (error) {
            this.logError('Token validation error:', error);
            return false;
        }
    }

    async validateToken() {
        if (!this._data.token) {
            this.logInfo('No token to validate');
            return false;
        }

        try {
            const response = await this.makeRequest('/api/auth/validate', {
                method: 'GET'
            });

            if (response.ok) {
                const data = await response.json();
                this.logInfo('Token validation successful:', data);
                return true;
            } else {
                this.logInfo('Token validation failed');
                return false;
            }
        } catch (error) {
            this.logError('Token validation error:', error);
            return false;
        }
    }

    clearAuth() {
        this._data.token = null;
        this._data.tokenExpiry = null;
        this._data.user = null;
        localStorage.removeItem('authToken');
        localStorage.removeItem('user');
        this.logInfo('Auth cleared');
    }

    async login(email, password) {
        this.logInfo('Attempting login');

        try {
            const data = await this.makeRequest('/api/auth/login', {
                method: 'POST',
                body: JSON.stringify({ email, password })
            });
            
            if (!data.token || !data.user) {
                throw new Error('Invalid response from server');
            }

            // 保存认证信息
            this._data.token = data.token;
            this._data.user = data.user;

            // 存储到 localStorage
            localStorage.setItem('authToken', data.token);
            localStorage.setItem('user', JSON.stringify(data.user));

            this.logInfo('Login successful');
            return data;
        } catch (error) {
            this.logError('Login failed:', error);
            throw error;
        }
    }

    async getUser() {
        if (!this.token) {
            return null;
        }

        if (this._data.user) {
            return this._data.user;
        }

        try {
            const response = await this.makeRequest('/api/auth/user', {
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });

            if (!response.ok) {
                throw new Error('Failed to fetch user data');
            }

            const data = await response.json();
            this._data.user = data;
            return data;
        } catch (error) {
            this.logError('Failed to get user data', error);
            return null;
        }
    }

    setToken(token) {
        this._data.token = token;
        localStorage.setItem('authToken', token);
        const expiry = new Date();
        expiry.setDate(expiry.getDate() + 7); // Token expires in 7 days
        this._data.tokenExpiry = expiry.toISOString();
        localStorage.setItem('authTokenExpiry', this._data.tokenExpiry);
    }
}

// Create and expose the singleton instance
console.log('[AuthService] Creating global instance');
const authService = new AuthService();

// Create AuthServiceUtils
const authServiceUtils = {
    async waitForAuthService(timeoutMs = 5000) {
        const startTime = Date.now();
        while (Date.now() - startTime < timeoutMs) {
            if (authService && authService.initialized) {
                return authService;
            }
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        throw new Error('Timeout waiting for AuthService initialization');
    },
    
    get instance() {
        return authService;
    }
};

// Expose both AuthService instance and utils globally
window.authService = authService;
window.authServiceUtils = authServiceUtils;