const express = require('express');
const router = express.Router();
const path = require('path');
const { db } = require('../db/init');
const { authorizeAdmin } = require('../middleware/auth');

const dbPath = process.env.DB_PATH || path.join(__dirname, '../rental.db');

// Backup Database
router.get('/backup', authorizeAdmin, (req, res) => {
    res.download(dbPath, 'rental_backup.db', (err) => {
        if (err) {
            console.error('Error downloading database:', err);
            res.status(500).send('Could not download database.');
        }
    });
});

// Clear All Data
router.post('/clear', authorizeAdmin, (req, res) => {
    try {
        const tables = [
            'transactions',
            'tenants',
            'houses',
            'properties',
            'expenses'
        ];

        const transaction = db.transaction(() => {
            // Delete data in order
            db.prepare('DELETE FROM transactions').run();
            db.prepare('DELETE FROM expenses').run();
            db.prepare('DELETE FROM tenants').run();
            db.prepare('DELETE FROM houses').run();
            db.prepare('DELETE FROM properties').run();

            // Optional: Reset settings to default
            db.prepare('DELETE FROM settings').run();
            const defaultSettings = [
                { key: 'company_name', value: 'Rental Management System' },
                { key: 'company_address', value: '123 Main St, City' },
                { key: 'company_phone', value: '0700 000 000' }
            ];
            const seedStmt = db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)');
            defaultSettings.forEach(s => seedStmt.run(s.key, s.value));

            // Reset autoincrement
            db.prepare("DELETE FROM sqlite_sequence WHERE name IN ('transactions', 'tenants', 'houses', 'properties', 'expenses', 'settings')").run();
        });

        transaction();
        console.log('SYSTEM WIPE: All tables cleared and settings reset to default.');
        res.json({ message: 'System has been successfully reset to factory defaults!' });
    } catch (err) {
        console.error('SYSTEM WIPE ERROR:', err);
        res.status(500).json({ message: `Full system reset failed: ${err.message}` });
    }
});

// Get Settings
router.get('/', (req, res) => {
    try {
        const rows = db.prepare('SELECT * FROM settings').all();
        const settings = {};
        rows.forEach(row => { settings[row.key] = row.value; });
        res.json(settings);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error fetching settings' });
    }
});

// Update Settings
router.post('/', (req, res) => {
    const {
        company_name, company_address, company_phone,
        mri_enabled, penalty_enabled, penalty_type, penalty_amount
    } = req.body;
    try {
        const stmt = db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value');
        const transaction = db.transaction(() => {
            if (company_name !== undefined) stmt.run('company_name', company_name);
            if (company_address !== undefined) stmt.run('company_address', company_address);
            if (company_phone !== undefined) stmt.run('company_phone', company_phone);
            if (mri_enabled !== undefined) stmt.run('mri_enabled', String(mri_enabled));
            if (penalty_enabled !== undefined) stmt.run('penalty_enabled', String(penalty_enabled));
            if (penalty_type !== undefined) stmt.run('penalty_type', penalty_type);
            if (penalty_amount !== undefined) stmt.run('penalty_amount', String(penalty_amount));
        });
        transaction();
        res.json({ message: 'Settings updated successfully' });
    } catch (err) {
        console.error('SETTINGS UPDATE ERROR:', err);
        res.status(500).json({ message: `Database error while saving settings: ${err.message}` });
    }
});

module.exports = router;
