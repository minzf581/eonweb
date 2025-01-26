// Auth service for handling API calls
const authService = {
    async login(email, password) {
        try {
            console.log('[AuthService] 尝试登录:', { email });
            
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ email, password }),
            });
            
            if (!response.ok) {
                const data = await response.json();
                console.error('[AuthService] 登录失败:', data);
                throw new Error(data.message || 'Login failed');
            }
            
            const data = await response.json();
            console.log('[AuthService] 登录成功:', {
                userId: data.user.id,
                email: data.user.email,
                isAdmin: data.user.is_admin,
                username: data.user.username
            });
            
            // 先保存用户信息和token
            auth.setToken(data.token);
            auth.setUser(data.user);
            
            // 根据用户角色决定跳转页面
            if (data.user.is_admin === true) {
                console.log('[AuthService] 管理员用户，准备跳转到管理后台');
                window.location.href = '/admin/';
            } else {
                console.log('[AuthService] 普通用户，准备跳转到用户后台');
                window.location.href = '/dashboard/';
            }
            
            return data;
        } catch (error) {
            console.error('[AuthService] 登录错误:', error);
            throw error;
        }
    },
    
    async logout() {
        console.log('[AuthService] 尝试登出');
        
        const token = this.getToken();
        console.log('[AuthService] 当前用户Token:', token ? '存在' : '不存在');
        
        const user = this.getUser();
        console.log('[AuthService] 当前用户信息:', user);

        try {
            const response = await fetch('/api/auth/logout', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                console.log('[AuthService] 登出请求失败:', response);
                throw new Error('Logout failed');
            }

            // 清除本地存储的token和用户信息
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            
            // 重定向到登录页面
            window.location.href = '/auth/login.html';
        } catch (error) {
            console.log('[AuthService] 登出错误:', error);
            // 即使请求失败，也清除本地存储并重定向
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            window.location.href = '/auth/login.html';
        }
    },
    
    async register(username, password, email) {
        try {
            console.log('[AuthService] 尝试注册:', { email, username });
            
            const response = await fetch('/api/auth/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ username, password, email }),
            });
            
            if (!response.ok) {
                const data = await response.json();
                console.error('[AuthService] 注册失败:', data);
                throw new Error(data.message || 'Registration failed');
            }
            
            const data = await response.json();
            console.log('[AuthService] 注册成功:', {
                userId: data.user.id,
                email: data.user.email
            });
            
            return data;
        } catch (error) {
            console.error('[AuthService] 注册错误:', error);
            throw error;
        }
    },

    isAdmin() {
        const user = auth.getUser();
        console.log('[AuthService] 检查管理员权限:', {
            userId: user?.id,
            email: user?.email,
            isAdmin: user?.is_admin
        });
        return user && user.is_admin === true;
    },

    isLoggedIn() {
        const hasToken = !!auth.getToken();
        const user = auth.getUser();
        console.log('[AuthService] 检查登录状态:', {
            hasToken,
            userId: user?.id,
            email: user?.email
        });
        return hasToken;
    },

    getUser() {
        return auth.getUser();
    },

    getToken() {
        return auth.getToken();
    }
};

// Auth utilities
const auth = {
    getToken() {
        const token = localStorage.getItem('token');
        console.log('[Auth] 获取Token:', token ? '存在' : '不存在');
        return token;
    },

    setToken(token) {
        console.log('[Auth] 保存Token');
        if (!token) {
            console.warn('[Auth] 尝试保存空Token');
            return;
        }
        localStorage.setItem('token', token);
    },

    clearToken() {
        console.log('[Auth] 清除Token');
        localStorage.removeItem('token');
    },

    getUser() {
        const userStr = localStorage.getItem('user');
        try {
            const user = userStr ? JSON.parse(userStr) : null;
            console.log('[Auth] 获取用户信息:', user ? {
                id: user.id,
                email: user.email,
                isAdmin: user.is_admin
            } : '不存在');
            return user;
        } catch (error) {
            console.error('[Auth] 解析用户信息失败:', error);
            return null;
        }
    },

    setUser(user) {
        console.log('[Auth] 保存用户信息:', {
            userId: user.id,
            email: user.email,
            isAdmin: user.is_admin
        });
        localStorage.setItem('user', JSON.stringify(user));
    },

    clearUser() {
        console.log('[Auth] 清除用户信息');
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
