const jwt = require('jsonwebtoken');

const authenticateToken = async (req, res, next) => {
    try {
        console.log('[Auth] Authenticating request:', {
            path: req.path,
            method: req.method,
            headers: {
                ...req.headers,
                authorization: req.headers.authorization ? 'Bearer [hidden]' : undefined
            }
        });

        const authHeader = req.headers['authorization'];
        if (!authHeader) {
            console.log('[Auth] No authorization header');
            return res.status(401).json({ error: 'No authorization header' });
        }

        const token = authHeader.split(' ')[1];
        if (!token) {
            console.log('[Auth] No token in authorization header');
            return res.status(401).json({ error: 'No token provided' });
        }

        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            console.log('[Auth] Token decoded:', {
                id: decoded.id,
                email: decoded.email,
                isAdmin: decoded.isAdmin
            });
            
            if (!decoded.id || !decoded.email) {
                console.log('[Auth] Invalid token payload');
                return res.status(403).json({ error: 'Invalid token payload' });
            }

            req.user = decoded;
            next();
        } catch (error) {
            console.error('[Auth] Token verification error:', error);
            return res.status(403).json({ error: 'Invalid token' });
        }
    } catch (error) {
        console.error('[Auth] Authentication error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

const isAdmin = async (req, res, next) => {
    try {
        console.log('[Auth] Checking admin status:', {
            path: req.path,
            method: req.method,
            user: req.user ? {
                id: req.user.id,
                email: req.user.email,
                isAdmin: req.user.isAdmin
            } : null
        });

        if (!req.user) {
            console.log('[Auth] No user found in request');
            return res.status(401).json({ error: 'Authentication required' });
        }

        if (!req.user.isAdmin) {
            console.log('[Auth] User is not admin:', {
                id: req.user.id,
                email: req.user.email,
                isAdmin: req.user.isAdmin
            });
            return res.status(403).json({ error: 'Admin privileges required' });
        }

        console.log('[Auth] Admin access granted');
        next();
    } catch (error) {
        console.error('[Auth] Error in admin authentication:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

module.exports = {
    authenticateToken,
    isAdmin
};
