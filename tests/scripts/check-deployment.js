import https from 'https';

const files = [
    '/static/js/authService.js',
    '/public/auth/login.html'
];

const baseUrl = 'https://eonweb-production.up.railway.app';

async function checkFile(path) {
    return new Promise((resolve, reject) => {
        https.get(`${baseUrl}${path}`, (res) => {
            let data = '';
            
            res.on('data', (chunk) => {
                data += chunk;
            });
            
            res.on('end', () => {
                console.log(`[${res.statusCode}] ${path}: ${data.length} bytes`);
                resolve({
                    path,
                    status: res.statusCode,
                    size: data.length
                });
            });
        }).on('error', (err) => {
            console.error(`Error checking ${path}:`, err.message);
            reject(err);
        });
    });
}

async function main() {
    console.log('Checking deployment files...');
    console.log('Base URL:', baseUrl);
    
    try {
        const results = await Promise.all(files.map(checkFile));
        const allOk = results.every(r => r.status === 200);
        
        if (allOk) {
            console.log('\n✅ All files are accessible');
        } else {
            console.log('\n❌ Some files are missing or inaccessible');
        }
    } catch (error) {
        console.error('\n❌ Error checking files:', error.message);
    }
}

main();
