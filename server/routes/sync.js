const express = require('express');
const router = express.Router();
const { db, generateUUID } = require('../db/init');
const { authenticate, authorizeAdmin } = require('../middleware/auth');
const crypto = require('crypto');
const axios = require('axios');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const FormData = require('form-data');

// --- HELPERS ---

// Verify Device API Token
const verifyDevice = (req, res, next) => {
    const token = req.headers['x-sync-token'];
    const deviceId = req.headers['x-device-id'];

    if (!token || !deviceId) {
        return res.status(401).json({ error: 'Device identifying headers missing.' });
    }

    try {
        const device = db.prepare('SELECT * FROM authorized_devices WHERE id = ? AND api_token = ? AND is_active = 1').get(deviceId, token);
        if (!device) {
            return res.status(403).json({ error: 'Unauthorized or inactive device.' });
        }
        req.device = device;
        next();
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Multer Setup for Sync Uploads
const syncStorage = multer.diskStorage({
    destination: function (req, file, cb) {
        const baseUploadDir = process.env.UPLOADS_PATH || path.join(__dirname, '../uploads');
        // The client should provide the intended subpath in a header or body
        const subPath = req.headers['x-file-path'] || 'sync_uploads';
        const uploadDir = path.join(baseUploadDir, path.dirname(subPath));

        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        cb(null, path.basename(req.headers['x-file-path'] || file.originalname));
    }
});

const syncUpload = multer({ storage: syncStorage });

// --- ROUTES ---

// 1. Device Registration (Owner only)
// Caretaker uses this once to pair with Owner.
router.post('/register', authenticate, authorizeAdmin, (req, res) => {
    const { device_id, device_name } = req.body;

    if (!device_id || !device_name) {
        return res.status(400).json({ error: 'device_id and device_name are required for registration.' });
    }

    try {
        // Check if already registered
        const existing = db.prepare('SELECT * FROM authorized_devices WHERE id = ?').get(device_id);
        if (existing) {
            return res.json({
                message: 'Device already registered.',
                api_token: existing.api_token,
                role: existing.role
            });
        }

        const apiToken = crypto.randomBytes(32).toString('hex');
        db.prepare(`
            INSERT INTO authorized_devices (id, device_name, role, api_token)
            VALUES (?, ?, 'branch', ?)
        `).run(device_id, device_name, apiToken);

        res.json({
            message: 'Device registered successfully.',
            api_token: apiToken,
            role: 'branch'
        });
    } catch (err) {
        console.error('REGISTRATION ERROR:', err);
        res.status(500).json({ error: err.message });
    }
});

// 2. Data Push (Caretaker -> Owner)
router.post('/push', verifyDevice, (req, res) => {
    const { payload, sync_id } = req.body;
    // payload structure: { table_name: [records...], ... }

    if (!payload || typeof payload !== 'object') {
        return res.status(400).json({ error: 'Invalid sync payload.' });
    }

    const deviceId = req.device.id;
    const startTime = new Date().toISOString();
    let recordsReceived = 0;

    try {
        // Get last successful sync pull/push time for this device to help with conflict resolution
        const lastSync = db.prepare(`
            SELECT MAX(sync_completed_at) as last_time 
            FROM sync_logs 
            WHERE device_id = ? AND status = 'success'
        `).get(deviceId)?.last_time || '1970-01-01T00:00:00Z';

        db.transaction(() => {
            for (const [tableName, records] of Object.entries(payload)) {
                if (!Array.isArray(records)) continue;

                for (const record of records) {
                    const existing = db.prepare(`SELECT updated_at FROM ${tableName} WHERE id = ?`).get(record.id);

                    if (existing) {
                        const ownerModified = new Date(existing.updated_at) > new Date(lastSync);
                        const caretakerModified = new Date(record.updated_at) > new Date(lastSync);

                        if (caretakerModified && ownerModified) {
                            // CASE: Both modified -> Owner Priority (Keep existing)
                            console.log(`Sync Conflict on ${tableName}:${record.id} - Owner Priority applied.`);
                            continue;
                        } else if (caretakerModified) {
                            // CASE: Only Caretaker modified -> Update Owner
                            const columns = Object.keys(record).filter(k => k !== 'id');
                            const setClause = columns.map(c => `${c} = ?`).join(', ');
                            const values = columns.map(c => record[c]);
                            db.prepare(`UPDATE ${tableName} SET ${setClause} WHERE id = ?`).run(...values, record.id);
                        }
                    } else {
                        // Insert new
                        const columns = Object.keys(record);
                        const placeholders = columns.map(() => '?').join(', ');
                        const values = columns.map(c => record[c]);
                        db.prepare(`INSERT INTO ${tableName} (${columns.join(', ')}) VALUES (${placeholders})`).run(...values);
                    }
                    recordsReceived++;
                }
            }

            // Log sync
            db.prepare(`
                INSERT INTO sync_logs (id, device_id, records_received, sync_started_at, sync_completed_at, status)
                VALUES (?, ?, ?, ?, ?, 'success')
            `).run(generateUUID(), deviceId, recordsReceived, startTime, new Date().toISOString());
        })();

        res.json({ success: true, records_received: recordsReceived });
    } catch (err) {
        console.error('PUSH SYNC ERROR:', err);
        res.status(500).json({ error: err.message });
    }
});

// 3. Data Pull (Owner -> Caretaker)
router.get('/pull', verifyDevice, (req, res) => {
    const { since } = req.query; // Timestamp of last successful pull

    if (!since) {
        return res.status(400).json({ error: 'since timestamp is required for incremental sync.' });
    }

    try {
        const syncableTables = [
            'users', 'properties', 'houses', 'tenants', 'transactions',
            'maintenance_requests', 'maintenance_expenses', 'maintenance_logs',
            'mri_records', 'expenses'
        ];

        const payload = {};
        let recordsSent = 0;

        for (const table of syncableTables) {
            // Find records created or updated since the last sync
            const records = db.prepare(`SELECT * FROM ${table} WHERE updated_at > ? OR created_at > ?`).all(since, since);
            if (records.length > 0) {
                payload[table] = records;
                recordsSent += records.length;
            }
        }

        // Log sync
        db.prepare(`
            INSERT INTO sync_logs (id, device_id, records_sent, sync_started_at, sync_completed_at, status)
            VALUES (?, ?, ?, ?, ?, 'success')
        `).run(generateUUID(), req.device.id, recordsSent, new Date().toISOString(), new Date().toISOString());

        res.json({ payload, server_time: new Date().toISOString() });
    } catch (err) {
        console.error('PULL SYNC ERROR:', err);
        res.status(500).json({ error: err.message });
    }
});

// 4. File Sync: Upload (Receive file from device)
router.post('/file/upload', verifyDevice, syncUpload.single('file'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded.' });
    res.json({ success: true, message: 'File synced successfully.' });
});

// 5. File Sync: Download (Send file to device)
router.get('/file/download', verifyDevice, (req, res) => {
    const filePath = req.query.path;
    if (!filePath) return res.status(400).json({ error: 'File path required.' });

    const baseUploadDir = process.env.UPLOADS_PATH || path.join(__dirname, '../uploads');
    const absolutePath = path.join(baseUploadDir, filePath);

    if (!fs.existsSync(absolutePath)) {
        return res.status(404).json({ error: 'File not found on server.' });
    }

    res.sendFile(absolutePath);
});

// --- CLIENT SIDE HELPERS (Caretaker Machine) ---

const uploadFileToOwner = async (ownerUrl, apiToken, deviceId, relativePath) => {
    const baseUploadDir = process.env.UPLOADS_PATH || path.join(__dirname, '../uploads');
    const fullPath = path.join(baseUploadDir, relativePath);

    if (!fs.existsSync(fullPath)) return;

    try {
        const form = new FormData();
        form.append('file', fs.createReadStream(fullPath));

        await axios.post(`${ownerUrl}/api/sync/file/upload`, form, {
            headers: {
                ...form.getHeaders(),
                'x-sync-token': apiToken,
                'x-device-id': deviceId,
                'x-file-path': relativePath
            }
        });
        console.log(`[FileSync] Pushed ${relativePath}`);
    } catch (err) {
        console.error(`[FileSync] Failed to push ${relativePath}:`, err.message);
    }
};

const downloadFileFromOwner = async (ownerUrl, apiToken, deviceId, relativePath) => {
    const baseUploadDir = process.env.UPLOADS_PATH || path.join(__dirname, '../uploads');
    const fullPath = path.join(baseUploadDir, relativePath);

    if (fs.existsSync(fullPath)) return; // Already have it

    try {
        const response = await axios.get(`${ownerUrl}/api/sync/file/download`, {
            params: { path: relativePath },
            headers: { 'x-sync-token': apiToken, 'x-device-id': deviceId },
            responseType: 'stream'
        });

        // Ensure directory exists
        const dir = path.dirname(fullPath);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

        const writer = fs.createWriteStream(fullPath);
        response.data.pipe(writer);

        return new Promise((resolve, reject) => {
            writer.on('finish', resolve);
            writer.on('error', reject);
        });
    } catch (err) {
        console.error(`[FileSync] Failed to pull ${relativePath}:`, err.message);
    }
};

const scanAndSyncFiles = async (ownerUrl, apiToken, deviceId, payload, direction = 'push') => {
    const fileFields = ['issue_image_path', 'receipt_image_path', 'receipt_path', 'agreement_path'];

    for (const [tableName, records] of Object.entries(payload)) {
        for (const record of records) {
            for (const field of fileFields) {
                if (record[field]) {
                    if (direction === 'push') {
                        await uploadFileToOwner(ownerUrl, apiToken, deviceId, record[field]);
                    } else {
                        await downloadFileFromOwner(ownerUrl, apiToken, deviceId, record[field]);
                    }
                }
            }
        }
    }
};

// --- CLIENT SIDE ROUTES (Caretaker Machine) ---

// 1. Initiate registration with an owner
router.post('/client/register', authenticate, authorizeAdmin, async (req, res) => {
    const { owner_url, device_name } = req.body;
    const deviceId = db.prepare("SELECT value FROM settings WHERE key = 'device_id'").get()?.value;

    if (!owner_url || !deviceId) {
        return res.status(400).json({ error: 'owner_url and device_id are required.' });
    }

    try {
        // We assume the caller is an admin on BOTH machines or has credentials.
        // For simplicity, we'll try to register.
        const response = await axios.post(`${owner_url}/api/sync/register`, {
            device_id: deviceId,
            device_name: device_name || 'Caretaker Device'
        }, {
            headers: { 'Authorization': req.headers['authorization'] } // Forwards current JWT
        });

        const { api_token } = response.data;

        db.transaction(() => {
            db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('owner_url', ?)").run(owner_url);
            db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('sync_api_token', ?)").run(api_token);
        })();

        res.json({ message: 'Registered with owner successfully.', api_token });
    } catch (err) {
        console.error('CLIENT REGISTRATION ERROR:', err.response?.data || err.message);
        res.status(500).json({ error: err.response?.data?.error || err.message });
    }
});

// 2. Trigger Manual Sync
router.post('/client/sync', authenticate, async (req, res) => {
    const owner_url = db.prepare("SELECT value FROM settings WHERE key = 'owner_url'").get()?.value;
    const api_token = db.prepare("SELECT value FROM settings WHERE key = 'sync_api_token'").get()?.value;
    const deviceId = db.prepare("SELECT value FROM settings WHERE key = 'device_id'").get()?.value;
    const last_sync = db.prepare("SELECT value FROM settings WHERE key = 'last_sync_timestamp'").get()?.value || '1970-01-01T00:00:00Z';

    if (!owner_url || !api_token) {
        return res.status(400).json({ error: 'Device not registered with any owner.' });
    }

    const sync_start = new Date().toISOString();
    let stats = { pushed: 0, pulled: 0, errors: [] };

    try {
        const syncableTables = [
            'users', 'properties', 'houses', 'tenants', 'transactions',
            'maintenance_requests', 'maintenance_expenses', 'maintenance_logs',
            'mri_records', 'expenses'
        ];

        // --- STEP A: PUSH LOCAL CHANGES ---
        const payload = {};
        for (const table of syncableTables) {
            const pending = db.prepare(`SELECT * FROM ${table} WHERE sync_status = 'pending'`).all();
            if (pending.length > 0) {
                payload[table] = pending;
            }
        }

        if (Object.keys(payload).length > 0) {
            await axios.post(`${owner_url}/api/sync/push`, { payload }, {
                headers: { 'x-sync-token': api_token, 'x-device-id': deviceId }
            });

            // Sync files for pushed records
            await scanAndSyncFiles(owner_url, api_token, deviceId, payload, 'push');

            // Mark as synced locally
            db.transaction(() => {
                for (const table of Object.keys(payload)) {
                    db.prepare(`UPDATE ${table} SET sync_status = 'synced' WHERE sync_status = 'pending'`).run();
                    stats.pushed += payload[table].length;
                }
            })();
        }

        // --- STEP B: PULL UPDATES ---
        const pullResponse = await axios.get(`${owner_url}/api/sync/pull`, {
            params: { since: last_sync },
            headers: { 'x-sync-token': api_token, 'x-device-id': deviceId }
        });

        const ownerPayload = pullResponse.data.payload;
        if (ownerPayload && Object.keys(ownerPayload).length > 0) {
            db.transaction(() => {
                for (const [tableName, records] of Object.entries(ownerPayload)) {
                    for (const record of records) {
                        const existing = db.prepare(`SELECT updated_at FROM ${tableName} WHERE id = ?`).get(record.id);

                        if (existing) {
                            // Client Merge Logic: Owner wins if Conflict
                            // Here we just apply owner's version if it's newer than ours
                            if (new Date(record.updated_at) > new Date(existing.updated_at)) {
                                const columns = Object.keys(record).filter(k => k !== 'id');
                                const setClause = columns.map(c => `${c} = ?`).join(', ');
                                const values = columns.map(c => record[c]);
                                db.prepare(`UPDATE ${tableName} SET ${setClause}, sync_status = 'synced' WHERE id = ?`).run(...values, record.id);
                            }
                        } else {
                            const columns = Object.keys(record);
                            const placeholders = columns.map(() => '?').join(', ');
                            const values = columns.map(c => record[c]);
                            db.prepare(`INSERT INTO ${tableName} (${columns.join(', ')}) VALUES (${placeholders})`).run(...values);
                            db.prepare(`UPDATE ${tableName} SET sync_status = 'synced' WHERE id = ?`).run(record.id);
                        }
                        stats.pulled++;
                    }
                }
            })();

            // Sync files for pulled records
            await scanAndSyncFiles(owner_url, api_token, deviceId, ownerPayload, 'pull');
        }

        // --- FINALIZE ---
        db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('last_sync_timestamp', ?)").run(sync_start);

        res.json({ success: true, stats });
    } catch (err) {
        console.error('SYNC EXECUTION ERROR:', err.response?.data || err.message);
        res.status(500).json({ error: err.response?.data?.error || err.message, stats });
    }
});

module.exports = router;
