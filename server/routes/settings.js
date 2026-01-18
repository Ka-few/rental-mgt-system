const express = require('express');
const router = express.Router();
const path = require('path');
const { db } = require('../db/init');

const dbPath = process.env.DB_PATH || path.join(__dirname, '../rental.db');

// Backup Database
router.get('/backup', (req, res) => {
    res.download(dbPath, 'rental_backup.db', (err) => {
        if (err) {
            console.error('Error downloading database:', err);
            res.status(500).send('Could not download database.');
        }
    });
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
    const { company_name, company_address, company_phone } = req.body;
    try {
        const stmt = db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value');
        const transaction = db.transaction(() => {
            if (company_name !== undefined) stmt.run('company_name', company_name);
            if (company_address !== undefined) stmt.run('company_address', company_address);
            if (company_phone !== undefined) stmt.run('company_phone', company_phone);
        });
        transaction();
        res.json({ message: 'Settings updated successfully' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error updating settings' });
    }
});

module.exports = router;
