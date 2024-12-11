const API_BASE_URL = 'https://eon-api.railway.app';

async function handleLogin(event) {
    // ...
    const response = await fetch(`${API_BASE_URL}/auth/api/login`, {
        // ...
    });
} 