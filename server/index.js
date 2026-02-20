const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
require('dotenv').config();

const { db, initDb } = require('./db/init');
const rateLimit = require('express-rate-limit');
const { authenticate } = require('./middleware/auth');

const app = express();

// Global Rate Limiting (Security enhancement from audit)
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    limit: 1000, // Increased for local desktop app to prevent freezing upon rapid clicks
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { error: 'Too many requests, please try again after 15 minutes' }
});

const PORT = process.env.PORT || 3000;

// Middleware
app.use(limiter);
app.use(cors());
app.use(helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    crossOriginEmbedderPolicy: false,
    contentSecurityPolicy: {
        directives: {
            ...helmet.contentSecurityPolicy.getDefaultDirectives(),
            "img-src": ["'self'", "data:", "blob:", "*", "http://localhost:3000", "http://127.0.0.1:3000"],
            "frame-src": ["'self'", "http://localhost:3000", "http://127.0.0.1:3000", "blob:"],
            "object-src": ["'self'", "http://localhost:3000", "http://127.0.0.1:3000", "blob:"],
            "frame-ancestors": ["*"],
            "default-src": ["*"],
            "connect-src": ["*"],
        },
    },
    xFrameOptions: false,
}));
app.use(express.json());

const { initializeDatabase } = require('./db/init');

// Serve uploaded files
const uploadsPath = process.env.UPLOADS_PATH || path.join(__dirname, 'uploads');
app.use('/uploads', express.static(uploadsPath, {
    setHeaders: (res) => {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
        res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    }
}));

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/license', require('./routes/license'));

// Protect all following routes
app.use(authenticate);

app.use('/api/tenants', require('./routes/tenants'));
app.use('/api/properties', require('./routes/properties'));
app.use('/api/finance', require('./routes/finance'));
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/reports', require('./routes/reports'));
app.use('/api/mri', require('./routes/mri'));
app.use('/api/settings', require('./routes/settings'));
app.use('/api/help', require('./routes/help'));
app.use('/api/expenses', require('./routes/expenses'));
app.use('/api/maintenance', require('./routes/maintenance'));

// Basic Route
app.get('/api/status', (req, res) => {
    res.json({ status: 'ok', database: 'connected' });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('GLOBAL ERROR:', err);
    res.status(500).json({ error: err.message || 'Internal Server Error' });
});

// Start Server
async function start() {
    console.log('Backend Server Starting...');
    console.log('Environment:', process.env.NODE_ENV);
    console.log('Port:', PORT);
    console.log('DB Path:', process.env.DB_PATH);
    console.log('Uploads Path:', process.env.UPLOADS_PATH);

    try {
        await initializeDatabase();
        const server = app.listen(PORT, () => {
            console.log(`Server running on port ${PORT}`);
            if (process.send) {
                process.send('ready');
            }
        });

        // Anti-Gravity Keep-Alive: Prevent process exit if event loop drains
        // This is necessary because sql.js/fs interactions sometimes clear the loop prematurely
        setInterval(() => { }, 1000 * 60 * 60);

    } catch (err) {
        console.error('Failed to start server:', err);
        process.exit(1);
    }
}

if (require.main === module) {
    start();
}

module.exports = { app };
