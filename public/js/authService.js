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
            baseUrl: window.location.origin + '/api',  // 添加 /api 前缀
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

        // 设置默认选项
        const defaultOptions = {
            headers: {
                'Content-Type': 'application/json'
            },
            timeout: this._data.requestTimeout
        };

        // 如果有 token，添加到请求头
        if (this._data.token) {
            defaultOptions.headers['Authorization'] = `Bearer ${this._data.token}`;
        }

        // 合并选项
        const finalOptions = {
            ...defaultOptions,
            ...options,
            headers: {
                ...defaultOptions.headers,
                ...(options.headers || {})
            }
        };

        this.logInfo('Request options:', finalOptions);

        try {
            const response = await this.fetchWithRetry(url, finalOptions);
            this.logInfo('Response received:', {
                status: response.status,
                statusText: response.statusText,
                headers: response.headers
            });

            if (!response.ok) {
                let errorMessage;
                try {
                    const errorData = await response.json();
                    errorMessage = errorData.error || 'Request failed';
                } catch (e) {
                    errorMessage = response.statusText || 'Request failed';
                }
                throw new Error(errorMessage);
            }

            return response;
        } catch (error) {
            this.logError('Request failed:', error);
            throw error;
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
            const response = await this.makeRequest('/auth/validate', {
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
            const response = await this.makeRequest('/auth/login', {
                method: 'POST',
                body: JSON.stringify({ email, password })
            });

            const data = await response.json();
            
            if (!data.token || !data.user) {
                throw new Error('Invalid response from server');
            }

            this._data.token = data.token;
            this._data.user = data.user;

            // 存储登录信息
            localStorage.setItem('token', data.token);
            localStorage.setItem('user', JSON.stringify(data.user));

            // 根据用户类型重定向
            if (data.user.isAdmin) {
                window.location.href = '/admin/dashboard';
            } else {
                window.location.href = '/dashboard';
            }

            return true;
        } catch (error) {
            this.logError('Login failed:', error);
            throw new Error('Login service is temporarily unavailable');
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
            const response = await this.makeRequest('/auth/user', {
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