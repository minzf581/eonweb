// 只在 window.AuthService 未定义时声明类
if (typeof window.AuthService === 'undefined') {
    window.AuthService = class AuthService {
        constructor() {
            this.tokenKey = 'eon_auth_token';
            this.userKey = 'eon_user';
            // 根据当前环境选择正确的基础路径
            this.basePath = window.location.hostname === 'w3router.github.io' 
                ? 'https://w3router.github.io/eonweb'
                : '';
            // API 基础 URL
            this.apiBaseUrl = 'https://eonweb-production.up.railway.app';
            this.baseUrl = 'https://eonweb-production.up.railway.app/api/auth';
        }

        // 获取 token
        getToken() {
            return localStorage.getItem(this.tokenKey);
        }

        // 保存认证信息
        setAuth(token, user) {
            localStorage.setItem(this.tokenKey, token);
            localStorage.setItem(this.userKey, JSON.stringify(user));
        }

        // 获取认证信息
        getAuth() {
            const token = this.getToken();
            const userStr = localStorage.getItem(this.userKey);
            
            if (!token || !userStr) {
                return null;
            }

            try {
                const user = JSON.parse(userStr);
                return { token, user };
            } catch (error) {
                console.error('Error parsing user data:', error);
                return null;
            }
        }

        // 清除认证信息
        clearAuth() {
            localStorage.removeItem(this.tokenKey);
            localStorage.removeItem(this.userKey);
        }

        // 检查是否已登录
        isAuthenticated() {
            return !!this.getToken();
        }

        // 检查是否为管理员
        isAdmin() {
            const auth = this.getAuth();
            return auth?.user?.isAdmin || false;
        }

        // 处理登录后的重定向
        handleAuthRedirect() {
            if (this.isAuthenticated()) {
                // 已登录，根据角色重定向
                if (this.isAdmin()) {
                    window.location.href = `${this.basePath}/public/admin/index.html`;
                } else {
                    // 普通用户重定向到用户仪表板
                    window.location.href = `${this.basePath}/public/dashboard/index.html`;
                }
                return;
            }

            // 未登录，重定向到登录页面
            window.location.href = `${this.basePath}/public/auth/login.html`;
        }

        // 登出
        logout() {
            this.clearAuth();
            window.location.href = `${this.basePath}/public/auth/login.html`;
        }

        // 执行登录
        async login(email, password) {
            try {
                const response = await fetch(`${this.baseUrl}/login`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    credentials: 'include',
                    body: JSON.stringify({ email, password })
                });

                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.message || 'Login failed');
                }

                const data = await response.json();
                this.setAuth(data.token, data.user);
                return data;
            } catch (error) {
                console.error('Login error:', error);
                throw error;
            }
        }

        // 执行注册
        async register(userData) {
            try {
                const response = await fetch(`${this.baseUrl}/register`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    credentials: 'include',
                    body: JSON.stringify(userData)
                });

                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.message || 'Registration failed');
                }

                const data = await response.json();
                this.setAuth(data.token, data.user);
                return data;
            } catch (error) {
                console.error('Registration error:', error);
                throw error;
            }
        }
    }
}

// 创建全局实例 - 只在 window.authService 未定义时创建
if (!window.authService) {
    window.authService = new window.AuthService();
}
