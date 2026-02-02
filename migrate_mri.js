const initSqlJs = require('sql.js');
const path = require('path');
require('dotenv').config();
const fs = require('fs');

const dbPath = process.env.DB_PATH || path.join(__dirname, '../server/rental.db');

async function runMigration() {
    const SQL = await initSqlJs();
    let fileBuffer;
    if (fs.existsSync(dbPath)) {
        fileBuffer = fs.readFileSync(dbPath);
    }
    const db = fileBuffer ? new SQL.Database(fileBuffer) : new SQL.Database();

    function save() {
        const data = db.export();
        const buffer = Buffer.from(data);
        fs.writeFileSync(dbPath, buffer);
    }

    try {
        const columns = db.prepare("PRAGMA table_info(properties)");
        const results = [];
        while (columns.step()) {
            results.push(columns.getAsObject());
        }
        columns.free();
        const columnNames = results.map(c => c.name);

        if (!columnNames.includes('type')) {
            console.log("Adding 'type' column to properties...");
            db.run("ALTER TABLE properties ADD COLUMN type TEXT DEFAULT 'Residential' CHECK(type IN ('Residential', 'Commercial'))");
        }

        if (!columnNames.includes('annual_income_estimate')) {
            console.log("Adding 'annual_income_estimate' column to properties...");
            db.run("ALTER TABLE properties ADD COLUMN annual_income_estimate REAL DEFAULT 0");
        }

        if (!columnNames.includes('kra_pin')) {
            console.log("Adding 'kra_pin' column to properties...");
            db.run("ALTER TABLE properties ADD COLUMN kra_pin TEXT");
        }

        db.run(`
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

        save();
        console.log("Migration completed successfully.");
    } catch (err) {
        console.error("Migration failed:", err);
    } finally {
        db.close();
    }
}

runMigration();
