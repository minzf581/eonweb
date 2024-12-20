// Auth helper functions
document.addEventListener('DOMContentLoaded', async function() {
    // Login functionality
    const loginLink = document.getElementById('loginLink');
    if (loginLink) {
        loginLink.addEventListener('click', async (e) => {
            e.preventDefault();
            try {
                // Wait for auth service to be ready
                if (window.authServiceUtils) {
                    await window.authServiceUtils.waitForAuthService();
                    
                    // Check if already logged in
                    if (window.authService.token) {
                        const user = await window.authService.getUser();
                        if (user) {
                            // Redirect to appropriate dashboard
                            const redirectPath = user.role === 'admin' ? '/admin/index.html' : '/dashboard/index.html';
                            window.location.href = redirectPath;
                            return;
                        }
                    }
                }
                // Not logged in, redirect to login page
                window.location.href = '/auth/login.html';
            } catch (error) {
                console.error('[Auth] Failed to handle login:', error);
                // Fallback to direct navigation
                window.location.href = '/auth/login.html';
            }
        });
    }

    // Check auth status on page load
    try {
        if (window.authServiceUtils) {
            await window.authServiceUtils.waitForAuthService();
            if (window.authService.token) {
                // Update UI for logged-in state if needed
                const loginText = document.querySelector('#loginLink span');
                if (loginText) {
                    loginText.textContent = 'Dashboard';
                }
            }
        }
    } catch (error) {
        console.error('[Auth] Failed to check auth status:', error);
    }
});
