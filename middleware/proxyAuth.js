const { ProxyApiKey } = require('../models');

const authenticateProxyBackend = async (req, res, next) => {
    try {
        const apiKey = req.header('X-API-Key');
        
        if (!apiKey) {
            return res.status(401).json({
                code: 401,
                message: 'API密钥缺失'
            });
        }

        const proxyApiKey = await ProxyApiKey.findOne({
            where: {
                key: apiKey,
                status: 'active'
            }
        });

        if (!proxyApiKey) {
            return res.status(401).json({
                code: 401,
                message: 'API密钥无效'
            });
        }

        // 更新最后使用时间
        await proxyApiKey.update({
            lastUsedAt: new Date()
        });

        // 检查是否过期
        if (proxyApiKey.expiresAt && new Date() > proxyApiKey.expiresAt) {
            return res.status(401).json({
                code: 401,
                message: 'API密钥已过期'
            });
        }

        req.proxyBackend = proxyApiKey;
        next();
    } catch (error) {
        console.error('Proxy authentication error:', error);
        return res.status(500).json({ 
            code: 500, 
            message: 'Internal server error' 
        });
    }
};

module.exports = { authenticateProxyBackend };
