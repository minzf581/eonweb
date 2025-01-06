// Auth related functions
const auth = {
    token: null,
    
    init() {
        this.token = localStorage.getItem('token');
    },
    
    isAuthenticated() {
        return !!this.token;
    },
    
    setToken(token) {
        this.token = token;
        localStorage.setItem('token', token);
    },
    
    clearToken() {
        this.token = null;
        localStorage.removeItem('token');
    },
    
    getToken() {
        return this.token;
    }
};

// Initialize auth on page load
document.addEventListener('DOMContentLoaded', () => {
    auth.init();
});
