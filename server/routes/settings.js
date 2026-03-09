const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { db, initializeDatabase } = require('../db/init');
const { authorizeAdmin } = require('../middleware/auth');

const dbPath = process.env.DB_PATH || path.join(__dirname, '../rental.db');

// Configure Multer for File Uploads
const upload = multer({ dest: 'uploads/' });

// Backup Database (Download)
router.get('/backup', authorizeAdmin, (req, res) => {
    // Ensure the DB is flushed to disk before downloading
    try {
        if (db.saveImmediately) {
            db.saveImmediately();
        }
    } catch (e) {
        console.warn('Could not force save before backup:', e);
    }

    res.download(dbPath, `rental_backup_${new Date().toISOString().split('T')[0]}.db`, (err) => {
        if (err) {
            console.error('Error downloading database:', err);
            if (!res.headersSent) {
                res.status(500).send('Could not download database.');
            }
        }
    });
});

// Restore Database (Upload)
router.post('/restore', authorizeAdmin, upload.single('backupFile'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ message: 'No file uploaded.' });
    }

    const uploadedPath = req.file.path;

    try {
        // 1. Verify it's a valid SQLite file (basic check)
        // ideally we'd check magic headers, but for now we rely on trust + try/catch

        // 2. Overwrite the existing DB
        // Close existing connection if possible or just overwrite file?
        // SQLite (especially sql.js wrapper) holds file open. 
        // We might need to restart the app, but let's try hot-swapping.

        fs.copyFileSync(uploadedPath, dbPath);

        // 3. Reload the database connection
        await initializeDatabase();

        // 4. Cleanup
        fs.unlinkSync(uploadedPath);

        res.json({ message: 'Database restored successfully! The system has been reloaded with the backup data.' });
    } catch (err) {
        console.error('RESTORE ERROR:', err);
        res.status(500).json({ message: 'Failed to restore database. Ensure the file is a valid backup.' });
    }
});

// Clear All Data
router.post('/clear', authorizeAdmin, (req, res) => {
    try {
        const tables = [
            'transactions',
            'maintenance_logs',
            'maintenance_expenses',
            'maintenance_requests',
            'mri_records',
            'expenses',
            'user_help_progress',
            'tenants',
            'houses',
            'properties'
        ];

        const transaction = db.transaction(() => {
            // Delete data in order (child -> parent)
            db.prepare('DELETE FROM transactions').run();
            db.prepare('DELETE FROM maintenance_logs').run();
            db.prepare('DELETE FROM maintenance_expenses').run();
            db.prepare('DELETE FROM maintenance_requests').run();
            db.prepare('DELETE FROM mri_records').run();
            db.prepare('DELETE FROM expenses').run();
            db.prepare('DELETE FROM user_help_progress').run();
            db.prepare('DELETE FROM tenants').run();
            db.prepare('DELETE FROM houses').run();
            db.prepare('DELETE FROM properties').run();

            // Optional: Reset settings to default but PROTECT identity/security
            const deviceId = db.prepare("SELECT value FROM settings WHERE key = 'device_id'").get()?.value;
            const jwtSecret = db.prepare("SELECT value FROM settings WHERE key = 'jwt_secret'").get()?.value;

            db.prepare('DELETE FROM settings').run();
            const defaultSettings = [
                { key: 'company_name', value: 'Rental Management System' },
                { key: 'company_address', value: '123 Main St, City' },
                { key: 'company_phone', value: '0700 000 000' },
                { key: 'device_id', value: deviceId || 'MISSING' },
                { key: 'jwt_secret', value: jwtSecret || 'MISSING' }
            ];
            const seedStmt = db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)');
            defaultSettings.forEach(s => seedStmt.run(s.key, s.value));

            // Reset autoincrement (not strictly necessary for TEXT PKs, but safe)
            db.prepare("DELETE FROM sqlite_sequence WHERE name IN ('transactions', 'maintenance_logs', 'maintenance_expenses', 'maintenance_requests', 'mri_records', 'expenses', 'user_help_progress', 'tenants', 'houses', 'properties', 'settings')").run();
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
        const sensitiveKeys = ['jwt_secret', 'device_id'];

        rows.forEach(row => {
            if (!sensitiveKeys.includes(row.key)) {
                settings[row.key] = row.value;
            }
        });
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

// Get Sync Info for pairing
router.get('/sync-info', (req, res) => {
    try {
        const deviceId = db.prepare("SELECT value FROM settings WHERE key = 'device_id'").get()?.value;
        const companyName = db.prepare("SELECT value FROM settings WHERE key = 'company_name'").get()?.value;
        res.json({
            device_id: deviceId,
            company_name: companyName,
            is_owner: true // For now, the one where pairing starts is owner
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
