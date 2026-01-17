const Database = require('better-sqlite3');
const path = require('path');

const dbPath = process.env.DB_PATH || path.join(__dirname, '../rental.db');
const db = new Database(dbPath, { verbose: console.log });

const schema = `
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT DEFAULT 'staff' CHECK(role IN ('admin', 'staff')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS properties (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    address TEXT,
    total_units INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS houses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    property_id INTEGER NOT NULL,
    house_number TEXT NOT NULL,
    type TEXT,
    rent_amount REAL NOT NULL,
    status TEXT DEFAULT 'Vacant' CHECK(status IN ('Vacant', 'Occupied', 'Maintenance')),
    amenities TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS tenants (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    full_name TEXT NOT NULL,
    national_id TEXT UNIQUE NOT NULL CHECK(length(national_id) = 8),
    phone TEXT NOT NULL,
    email TEXT,
    house_id INTEGER,
    status TEXT DEFAULT 'Active' CHECK(status IN ('Active', 'Vacated', 'Arrears')),
    move_in_date DATE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (house_id) REFERENCES houses(id) ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id INTEGER NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('Rent Charge', 'Water Bill', 'Garbage', 'Security', 'Payment', 'Adjustment')),
    amount REAL NOT NULL,
    date DATETIME DEFAULT CURRENT_TIMESTAMP,
    description TEXT,
    payment_method TEXT,
    reference_code TEXT,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS maintenance_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    house_id INTEGER NOT NULL,
    description TEXT NOT NULL,
    priority TEXT DEFAULT 'Normal' CHECK(priority IN ('Low', 'Normal', 'High', 'Critical')),
    status TEXT DEFAULT 'Open' CHECK(status IN ('Open', 'In Progress', 'Closed')),
    cost REAL DEFAULT 0,
    reported_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    completed_date DATETIME,
    FOREIGN KEY (house_id) REFERENCES houses(id) ON DELETE CASCADE
  );
`;

function initDb() {
    console.log('Initializing Database...');
    try {
        db.exec(schema);
        console.log('Database Schema Applied Successfully.');
    } catch (err) {
        console.error('Error initializing database:', err);
    }
}

if (require.main === module) {
    initDb();
}

module.exports = { initDb, db };
