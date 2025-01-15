const jwt = require('jsonwebtoken');

console.log('[DEBUG] 初始化 auth 中间件');

const validateApiKey = (req, res, next) => {
  console.log('验证 API Key:', {
    path: req.path,
    method: req.method,
    headers: {
      'x-api-key': req.headers['x-api-key']
    },
    expectedKey: process.env.API_KEY
  });

  const apiKey = req.headers['x-api-key'];
  if (!apiKey) {
    console.log('API Key 未提供');
    return res.status(401).json({ success: false, message: 'API key not provided' });
  }

  if (apiKey !== process.env.API_KEY) {
    console.log('API Key 不匹配:', {
      received: apiKey,
      expected: process.env.API_KEY
    });
    return res.status(401).json({ success: false, message: 'Invalid API key' });
  }

  console.log('API Key 验证通过');
  next();
};

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ success: false, message: 'No token provided' });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ success: false, message: 'Invalid token' });
    }
    req.user = user;
    next();
  });
};

const isAdmin = (req, res, next) => {
  if (!req.user || !req.user.isAdmin) {
    return res.status(403).json({ success: false, message: 'Admin access required' });
  }
  next();
};

module.exports = { 
  validateApiKey,
  authenticateToken,
  isAdmin
}; 

console.log('[DEBUG] auth 中间件导出完成:', {
  validateApiKey: typeof validateApiKey
}); 