const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
require('dotenv').config();
const { db, initDb } = require('./db/init');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    contentSecurityPolicy: {
        directives: {
            ...helmet.contentSecurityPolicy.getDefaultDirectives(),
            "img-src": ["'self'", "data:", "blob:", "*"],
            "frame-ancestors": ["*"],
            "default-src": ["*"],
        },
    },
    xFrameOptions: false,
}));
app.use(express.json());

// Initialize DB on startup
try {
    initDb();
} catch (e) {
    console.error('Failed to init DB:', e);
}

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/tenants', require('./routes/tenants'));
app.use('/api/properties', require('./routes/properties'));
app.use('/api/finance', require('./routes/finance'));
app.use('/api/maintenance', require('./routes/maintenance'));
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/reports', require('./routes/reports'));
app.use('/api/mri', require('./routes/mri'));
app.use('/api/settings', require('./routes/settings'));
app.use('/api/help', require('./routes/help'));

// Basic Route
app.get('/api/status', (req, res) => {
    res.json({ status: 'ok', database: 'connected' });
});

// Start Server
if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
        if (process.send) {
            process.send('ready');
        }
    });
}

module.exports = { app };
