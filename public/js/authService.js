class AuthService {
    constructor() {
        this.tokenKey = 'eon_auth_token';
        this.userKey = 'eon_user';
        // 使用完整的 GitHub Pages URL
        this.basePath = 'https://w3router.github.io/eonweb';
        // API 基础 URL
        this.apiBaseUrl = 'https://eonweb-production.up.railway.app';
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
                // 普通用户重定向到主页
                window.location.href = `${this.basePath}/index.html`;
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
            const response = await fetch(`${this.apiBaseUrl}/api/auth/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ email, password }),
            });

            if (!response.ok) {
                if (response.status === 404) {
                    throw new Error('Login service is not available. Please try again later.');
                }
                const errorText = await response.text();
                console.error('Login failed:', response.status, errorText);
                throw new Error('Login failed. Please check your credentials.');
            }

            const contentType = response.headers.get('content-type');
            if (!contentType || !contentType.includes('application/json')) {
                throw new Error('Invalid server response. Please try again later.');
            }

            const data = await response.json();
            if (!data.token) {
                throw new Error('Invalid response from server');
            }

            this.setAuth(data.token, data.user);
            return data;
        } catch (error) {
            console.error('Login error:', error);
            throw error;
        }
    }

    // 执行注册
    async register(email, password, referralCode) {
        const response = await fetch(`${this.apiBaseUrl}/api/auth/register`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ 
                email, 
                password,
                referralCode: referralCode || undefined
            }),
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || 'Registration failed');
        }

        this.setAuth(data.token, data.user);
        return data;
    }
}

// 创建全局实例 - 只在 window.authService 未定义时创建
if (!window.authService) {
    window.authService = new AuthService();
}
