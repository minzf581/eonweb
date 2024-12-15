const API_BASE_URL = '/eonweb';

class AuthService {
    constructor() {
        this.tokenKey = 'eon_auth_token';
        this.userKey = 'eon_user';
        // 基础路径，如果需要可以从环境变量获取
        this.basePath = '/eonweb';
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
                window.location.href = `${this.basePath}/public/admin/`;
            } else {
                // 普通用户重定向到主页
                window.location.href = `${this.basePath}/`;
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
}

// 创建全局实例
window.authService = new AuthService();
