require('dotenv').config();
const { initDb, db } = require('./server/db/init');

async function run() {
    console.log('--- SYNC DB VERIFICATION ---');

    // Initialize DB (this should trigger migrateToUUID)
    await initDb();

    // Wait a bit for the async initializeDatabase to complete
    await new Promise(resolve => setTimeout(resolve, 2000));

    try {
        // 1. Check if properties has sync_status
        const columns = db.prepare("PRAGMA table_info(properties)").all();
        const hasSyncStatus = columns.some(c => c.name === 'sync_status');
        console.log('Properties has sync_status:', hasSyncStatus);

        // 2. Check if id is TEXT
        const idCol = columns.find(c => c.name === 'id');
        console.log('Properties id type:', idCol ? idCol.type : 'N/A');

        // 3. Verify authorized_devices table exists
        try {
            const devices = db.prepare("SELECT COUNT(*) as count FROM authorized_devices").get();
            console.log('authorized_devices table exists and has rows:', devices.count);
        } catch (e) {
            console.log('authorized_devices table does NOT exist or error:', e.message);
        }

        // 4. Check device_id in settings
        const deviceId = db.prepare("SELECT value FROM settings WHERE key = 'device_id'").get();
        console.log('Device ID in settings:', deviceId ? deviceId.value : 'MISSING');

        // 5. Verify UUID format for some IDs
        const prop = db.prepare("SELECT id FROM properties LIMIT 1").get();
        if (prop) {
            const isUUID = /^[0-9a-f-]{36}$/i.test(prop.id) || /^[0-9a-f]{32}$/i.test(prop.id);
            console.log('Property ID format check:', prop.id, 'isUUID:', isUUID);
        } else {
            console.log('No properties found to check ID format.');
        }

    } catch (err) {
        console.error('Verification Error:', err);
    }

    process.exit(0);
}

run();
