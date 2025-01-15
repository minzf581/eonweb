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

module.exports = { validateApiKey }; 