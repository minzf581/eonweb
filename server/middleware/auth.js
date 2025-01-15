const validateApiKey = (req, res, next) => {
  console.log('收到的请求头:', {
    'x-api-key': req.headers['x-api-key'],
    'authorization': req.headers['authorization']
  });
  console.log('环境配置的 API_KEY:', process.env.API_KEY);
  
  const apiKey = req.headers['x-api-key'];
  if (!apiKey) {
    console.log('未提供 API key');
    return res.status(401).json({ success: false, message: 'API key not provided' });
  }
  
  if (apiKey !== process.env.API_KEY) {
    console.log('API key 不匹配');
    console.log('收到的 key:', apiKey);
    console.log('预期的 key:', process.env.API_KEY);
    return res.status(401).json({ success: false, message: 'Invalid API key' });
  }
  
  next();
}; 