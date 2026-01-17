const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const { db, initDb } = require('./db/init');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(helmet());
app.use(express.json());

// Initialize DB on startup
try {
    initDb();
} catch (e) {
    console.error('Failed to init DB:', e);
}

// Routes
app.use('/api/tenants', require('./routes/tenants'));
app.use('/api/properties', require('./routes/properties'));
app.use('/api/finance', require('./routes/finance'));
app.use('/api/maintenance', require('./routes/maintenance'));
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/reports', require('./routes/reports'));

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
