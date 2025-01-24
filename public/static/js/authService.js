// Auth service for handling API calls
const authService = {
    async login(email, password) {
        try {
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ email, password }),
            });
            
            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.message || 'Login failed');
            }
            
            const data = await response.json();
            auth.setToken(data.token);
            auth.setUser(data.user);
            return data;
        } catch (error) {
            console.error('Login error:', error);
            throw error;
        }
    },
    
    async logout() {
        try {
            const response = await fetch('/api/auth/logout', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${auth.getToken()}`,
                },
            });
            
            if (!response.ok) {
                throw new Error('Logout failed');
            }
            
            auth.clearToken();
            auth.clearUser();
        } catch (error) {
            console.error('Logout error:', error);
            throw error;
        }
    },
    
    async register(username, password, email) {
        try {
            const response = await fetch('/api/auth/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ username, password, email }),
            });
            
            if (!response.ok) {
                throw new Error('Registration failed');
            }
            
            return await response.json();
        } catch (error) {
            console.error('Registration error:', error);
            throw error;
        }
    },

    isAdmin() {
        const user = auth.getUser();
        return user && user.is_admin === true;
    },

    isLoggedIn() {
        return !!auth.getToken();
    }
};

// Auth utilities
const auth = {
    getToken() {
        return localStorage.getItem('token');
    },

    setToken(token) {
        localStorage.setItem('token', token);
    },

    clearToken() {
        localStorage.removeItem('token');
    },

    getUser() {
        const userStr = localStorage.getItem('user');
        return userStr ? JSON.parse(userStr) : null;
    },

    setUser(user) {
        localStorage.setItem('user', JSON.stringify(user));
    },

    clearUser() {
        localStorage.removeItem('user');
    }
};

// Auth service utilities
const authServiceUtils = {
    waitForAuthService() {
        return new Promise((resolve) => {
            if (window.authService) {
                resolve();
            } else {
                const checkInterval = setInterval(() => {
                    if (window.authService) {
                        clearInterval(checkInterval);
                        resolve();
                    }
                }, 100);
            }
        });
    }
};

// Export to window
window.authService = authService;
window.authServiceUtils = authServiceUtils;
