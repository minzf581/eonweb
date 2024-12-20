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
            baseUrl: window.location.hostname === 'localhost' 
                ? 'http://localhost:8080/api'
                : 'https://eonweb-production.up.railway.app/api',
            retryDelay: 1000,  // 初始重试延迟（毫秒）
            maxRetries: 3,      // 最大重试次数
            requestTimeout: 10000  // 10 seconds timeout
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

    // Core methods
    async initialize() {
        if (this.initializing || this.initialized) {
            return;
        }

        this._data.initializing = true;
        this.logInfo('Starting initialization');

        try {
            // Load stored token
            this._data.token = localStorage.getItem('auth_token');
            this._data.tokenExpiry = localStorage.getItem('auth_token_expiry');

            // Validate token if exists
            if (this._data.token) {
                const isValid = await this.validateToken();
                if (!isValid) {
                    this.clearAuth();
                }
            }

            this._data.initialized = true;
            this.logInfo('Initialization complete', {
                hasToken: !!this.token,
                tokenExpiry: this.tokenExpiry
            });
        } catch (error) {
            this.logError('Initialization failed', error);
            this.clearAuth();
        } finally {
            this._data.initializing = false;
        }
    }

    async validateToken() {
        if (!this.token) return false;

        try {
            const response = await this.fetchWithRetry(`${this._data.baseUrl}/auth/validate`, {
                headers: {
                    'Authorization': `Bearer ${this.token}`,
                    'Accept': 'application/json'
                }
            });

            if (!response.ok) {
                this.logError('Token validation failed', {
                    status: response.status,
                    statusText: response.statusText
                });
                return false;
            }

            return true;
        } catch (error) {
            this.logError('Token validation failed', error);
            return false;
        }
    }

    clearAuth() {
        this._data.token = null;
        this._data.tokenExpiry = null;
        this._data.user = null;
        localStorage.removeItem('auth_token');
        localStorage.removeItem('auth_token_expiry');
        this.logInfo('Auth cleared');
    }

    async login(email, password) {
        this.logInfo('Attempting login');
        try {
            // 检查参数
            if (!email || !password) {
                throw new Error('Email and password are required');
            }

            this.logInfo(`Making login request to ${this._data.baseUrl}/auth/login`);
            const response = await this.fetchWithRetry(`${this._data.baseUrl}/auth/login`, {
                method: 'POST',
                body: JSON.stringify({ email, password }),
                timeout: 15000
            });

            this.logInfo('Login response status:', response.status);
            this.logInfo('Login response headers:', response.headers);

            if (!response.ok) {
                let errorMessage = 'Login failed';
                try {
                    const errorData = await response.json();
                    this.logError('Login error response:', errorData);
                    errorMessage = errorData.message || errorData.error || 'Login failed';
                } catch (e) {
                    this.logError('Failed to parse error response:', e);
                    if (response.status === 404) {
                        errorMessage = 'Login service is temporarily unavailable';
                    } else if (response.status === 401) {
                        errorMessage = 'Invalid email or password';
                    } else if (response.status >= 500) {
                        errorMessage = 'Server error, please try again later';
                    }
                }
                throw new Error(errorMessage);
            }

            this.logInfo('Parsing login response...');
            const data = await response.json();
            this.logInfo('Login response data:', { 
                hasToken: !!data.token,
                hasUser: !!data.user
            });

            if (!data.token) {
                throw new Error('Invalid response from server: missing token');
            }

            this.setToken(data.token);
            this._data.user = data.user || null;
            this.logInfo('Login successful');
            
            return true;
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
            const response = await this.fetchWithRetry(`${this._data.baseUrl}/auth/user`, {
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
        localStorage.setItem('auth_token', token);
        const expiry = new Date();
        expiry.setDate(expiry.getDate() + 7); // Token expires in 7 days
        this._data.tokenExpiry = expiry.toISOString();
        localStorage.setItem('auth_token_expiry', this._data.tokenExpiry);
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