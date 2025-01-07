const http = require('http');
const server = http.createServer((req, res) => {
  if (req.url === '/_ah/health') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('OK');
  } else {
    res.writeHead(404);
    res.end();
  }
});

const port = process.env.PORT || 8081;
server.listen(port, () => {
  console.log(`Health check server listening on port ${port}`);
});
