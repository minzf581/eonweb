const API_BASE_URL = 'https://eonweb-production.up.railway.app';

class AuthService {
    constructor() {
        this.tokenKey = 'eon_auth_token';
        this.userKey = 'eon_user';
    }

    // 保存认证信息
    setAuth(token, user) {
        localStorage.setItem(this.tokenKey, token);
        localStorage.setItem(this.userKey, JSON.stringify(user));
    }

    // 获取认证信息
    getAuth() {
        const token = localStorage.getItem(this.tokenKey);
        const userStr = localStorage.getItem(this.userKey);
        return {
            token,
            user: userStr ? JSON.parse(userStr) : null
        };
    }

    // 检查是否已登录
    isAuthenticated() {
        const { token } = this.getAuth();
        return !!token;
    }

    // 检查是否为管理员
    isAdmin() {
        const { user } = this.getAuth();
        return user && user.isAdmin;
    }

    // 清除认证信息
    clearAuth() {
        localStorage.removeItem(this.tokenKey);
        localStorage.removeItem(this.userKey);
    }

    // 处理登录后的重定向
    handleAuthRedirect() {
        const auth = this.getAuth();
        if (auth && auth.token) {
            // 已登录，根据角色重定向
            if (this.isAdmin()) {
                window.location.href = '/eonweb/public/admin/';
            } else {
                window.location.href = '/eonweb/public/dashboard/';
            }
            return;
        }

        // 未登录，重定向到注册页面
        window.location.href = '/eonweb/auth/register.html';
    }

    // 登出
    logout() {
        this.clearAuth();
        window.location.href = '/eonweb/auth/register.html';
    }
}

// 创建全局实例
window.authService = new AuthService();
