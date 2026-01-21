const Database = require('better-sqlite3');
const path = require('path');
require('dotenv').config();

const dbPath = process.env.DB_PATH || path.join(__dirname, '../server/rental.db');
const db = new Database(dbPath, { verbose: console.log });

try {
    const columns = db.prepare("PRAGMA table_info(properties)").all();
    const columnNames = columns.map(c => c.name);

    if (!columnNames.includes('type')) {
        console.log("Adding 'type' column to properties...");
        db.prepare("ALTER TABLE properties ADD COLUMN type TEXT DEFAULT 'Residential' CHECK(type IN ('Residential', 'Commercial'))").run();
    }

    if (!columnNames.includes('annual_income_estimate')) {
        console.log("Adding 'annual_income_estimate' column to properties...");
        db.prepare("ALTER TABLE properties ADD COLUMN annual_income_estimate REAL DEFAULT 0").run();
    }

    if (!columnNames.includes('kra_pin')) {
        console.log("Adding 'kra_pin' column to properties...");
        db.prepare("ALTER TABLE properties ADD COLUMN kra_pin TEXT").run();
    }

    // Create mri_records table if not exists (init.js handles this on next run, but let's be sure)
    db.exec(`
        CREATE TABLE IF NOT EXISTS mri_records (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            month TEXT NOT NULL, 
            gross_rent REAL NOT NULL,
            tax_payable REAL NOT NULL,
            net_income REAL NOT NULL,
            status TEXT DEFAULT 'Pending' CHECK(status IN ('Pending', 'Filed', 'NIL')),
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
    `);

    console.log("Migration completed successfully.");
} catch (err) {
    console.error("Migration failed:", err);
} finally {
    db.close();
}
