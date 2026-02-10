const jwt = require('jsonwebtoken');
const SECRET_KEY = process.env.JWT_SECRET || 'dev-only-secret-key-123-change-this';

const authenticate = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ message: 'Authentication required. Please log in.' });
    }

    jwt.verify(token, SECRET_KEY, (err, decoded) => {
        if (err) {
            console.error('JWT Verification Error:', err.message);
            return res.status(403).json({ message: 'Session expired or invalid. Please log in again.' });
        }
        req.user = decoded;
        next();
    });
};

const authorizeAdmin = (req, res, next) => {
    if (!req.user || req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Access denied. Admin privileges required.' });
    }
    next();
};

module.exports = { authenticate, authorizeAdmin };
