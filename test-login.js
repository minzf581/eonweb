const fetch = require('node-fetch');

async function testLogin() {
    const apiUrl = 'https://illustrious-perfection-production.up.railway.app';
    
    try {
        console.log('Testing login...');
        const response = await fetch(`${apiUrl}/api/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Origin': 'https://w3router.github.io'
            },
            body: JSON.stringify({
                email: 'test@example.com',
                password: 'password123'
            })
        });

        console.log('Response status:', response.status);
        console.log('Response headers:', response.headers.raw());

        const data = await response.text();
        console.log('Response body:', data);

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
    } catch (error) {
        console.error('Error:', error);
    }
}

testLogin();
