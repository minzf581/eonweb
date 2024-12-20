// Auth helper functions
document.addEventListener('DOMContentLoaded', function() {
    // Login functionality
    const loginLink = document.getElementById('loginLink');
    if (loginLink) {
        loginLink.addEventListener('click', async (e) => {
            e.preventDefault();
            try {
                // Wait for auth service to be ready
                if (window.authServiceUtils) {
                    await window.authServiceUtils.waitForAuthService();
                }
                // Redirect to login page
                window.location.href = '/auth/login.html';
            } catch (error) {
                console.error('Failed to handle login:', error);
                // Fallback to direct navigation
                window.location.href = '/auth/login.html';
            }
        });
    }
});
