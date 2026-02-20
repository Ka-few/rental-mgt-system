const initSqlJs = require('sql.js');
const path = require('path');
const bcrypt = require('bcryptjs');
const fs = require('fs');

const dbPath = process.env.DB_PATH || path.join(__dirname, '../rental.db');
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

console.log('SQLITE DATABASE PATH:', dbPath);

class DatabaseWrapper {
  constructor(dbPath) {
    this.db = null;
    this.dbPath = dbPath;
    this.transactionLevel = 0;
    this.saveTimeout = null;
  }

  setWasmDb(wasmDb) {
    this.db = wasmDb;
  }

  save() {
    if (!this.db || this.transactionLevel > 0) return;

    // Clear existing timeout if any
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
    }

    // Set a new timeout to save after 1000ms of inactivity
    this.saveTimeout = setTimeout(() => {
      this.saveImmediately();
    }, 1000);
  }

  saveImmediately() {
    if (!this.db) return;
    try {
      const data = this.db.export();
      const buffer = Buffer.from(data);
      // Async write to disk to prevent blocking the event loop
      fs.writeFile(this.dbPath, buffer, (err) => {
        if (err) {
          console.error('CRITICAL: Failed to save database to disk:', err);
        } else {
          console.log('Database saved to disk.');
        }
      });
      this.saveTimeout = null;
    } catch (err) {
      console.error('CRITICAL: Failed to export database:', err);
    }
  }

  prepare(sql) {
    const self = this;
    return {
      run(...params) {
        if (!self.db) throw new Error('Database not initialized');
        try {
          // Convert undefined to null for SQLite compatibility
          const sanitizedParams = params.map(p => p === undefined ? null : p);
          self.db.run(sql, sanitizedParams);

          let lastInsertRowid = 0;
          try {
            const res = self.db.exec("SELECT last_insert_rowid()");
            if (res && res[0] && res[0].values && res[0].values[0]) {
              lastInsertRowid = res[0].values[0][0];
            }
          } catch (e) { }

          self.save();
          return {
            changes: self.db.getRowsModified(),
            lastInsertRowid: lastInsertRowid
          };
        } catch (err) {
          console.error('DB RUN ERROR:', err.message);
          console.error('SQL:', sql);
          console.error('PARAMS:', params);
          if (self.transactionLevel > 0) {
            // Re-throw so transaction wrapper can catch and rollback
          }
          throw err;
        }
      },
      get(...params) {
        if (!self.db) throw new Error('Database not initialized');
        try {
          const sanitizedParams = params.map(p => p === undefined ? null : p);
          const stmt = self.db.prepare(sql);
          stmt.bind(sanitizedParams);
          const hasResult = stmt.step();
          const result = hasResult ? stmt.getAsObject() : undefined;
          stmt.free();
          return result;
        } catch (err) {
          console.error('DB GET ERROR:', err.message);
          console.error('SQL:', sql);
          console.error('PARAMS:', params);
          throw err;
        }
      },
      all(...params) {
        if (!self.db) throw new Error('Database not initialized');
        try {
          const sanitizedParams = params.map(p => p === undefined ? null : p);
          const stmt = self.db.prepare(sql);
          stmt.bind(sanitizedParams);
          const results = [];
          while (stmt.step()) {
            results.push(stmt.getAsObject());
          }
          stmt.free();
          return results;
        } catch (err) {
          console.error('DB ALL ERROR:', err.message);
          console.error('SQL:', sql);
          console.error('PARAMS:', params);
          throw err;
        }
      }
    };
  }

  exec(sql) {
    if (!this.db) throw new Error('Database not initialized');
    try {
      this.db.run(sql);
      this.save();
    } catch (err) {
      console.error('DB EXEC ERROR:', err.message);
      console.error('SQL:', sql);
      throw err;
    }
  }

  transaction(fn) {
    return (...args) => {
      const isNested = this.transactionLevel > 0;
      const savepointName = `sp_${this.transactionLevel}`;

      try {
        if (isNested) {
          this.db.run(`SAVEPOINT ${savepointName}`);
        } else {
          this.db.run('BEGIN TRANSACTION');
        }

        this.transactionLevel++;

        const result = fn(...args);

        this.transactionLevel--;

        if (isNested) {
          this.db.run(`RELEASE SAVEPOINT ${savepointName}`);
        } else {
          this.db.run('COMMIT');
          this.saveImmediately(); // Critical data: Save immediately to disk
        }

        return result;
      } catch (err) {
        this.transactionLevel--;
        try {
          if (isNested) {
            this.db.run(`ROLLBACK TO SAVEPOINT ${savepointName}`);
          } else {
            this.db.run('ROLLBACK');
          }
        } catch (rollbackErr) {
          console.error('CRITICAL: Transaction rollback failed:', rollbackErr.message);
        }
        throw err;
      }
    };
  }
}

const db = new DatabaseWrapper(dbPath);

async function initializeDatabase() {
  const SQL = await initSqlJs();
  let fileBuffer;
  if (fs.existsSync(dbPath)) {
    fileBuffer = fs.readFileSync(dbPath);
  }
  const wasmDb = fileBuffer ? new SQL.Database(fileBuffer) : new SQL.Database();
  db.setWasmDb(wasmDb);

  // Run schema and seeds
  db.exec(schema);
  migrate();
  seedSettings();
  seedAdminUser();
  seedHelpContent();
  migrateToUUID(); // Sync migration
  console.log('Database Schema Applied & Default Settings Seeded Successfully.');
}

async function migrateToUUID() {
  console.log('Starting UUID migration for sync module...');
  try {
    // Check if we already have the sync columns in a key table (e.g., properties)
    const columns = db.prepare("PRAGMA table_info(properties)").all();
    if (columns.some(c => c.name === 'sync_status')) {
      console.log('UUID migration already completed.');
      return;
    }

    db.exec("PRAGMA foreign_keys = OFF");

    db.transaction(() => {
      // 0. Clean up orphaned records to prevent NOT NULL constraint failures
      console.log('Cleaning up orphaned records...');
      db.exec("DELETE FROM transactions WHERE tenant_id NOT IN (SELECT id FROM tenants)");
      db.exec("DELETE FROM maintenance_requests WHERE property_id IS NOT NULL AND property_id NOT IN (SELECT id FROM properties)");
      db.exec("DELETE FROM maintenance_requests WHERE house_id NOT IN (SELECT id FROM houses)");
      db.exec("DELETE FROM maintenance_expenses WHERE maintenance_id NOT IN (SELECT id FROM maintenance_requests)");
      db.exec("DELETE FROM maintenance_logs WHERE maintenance_id NOT IN (SELECT id FROM maintenance_requests)");

      // 1. Create mapping table
      db.exec("CREATE TABLE IF NOT EXISTS _sync_mapping (table_name TEXT, old_id INTEGER, new_id TEXT, PRIMARY KEY (table_name, old_id))");

      const syncableTables = [
        'users', 'properties', 'houses', 'tenants', 'transactions',
        'maintenance_requests', 'maintenance_expenses', 'maintenance_logs',
        'mri_records', 'expenses'
      ];

      // 2. Generate UUIDs and populate mapping
      for (const table of syncableTables) {
        const rows = db.prepare(`SELECT id FROM ${table}`).all();
        const insertMapping = db.prepare("INSERT INTO _sync_mapping (table_name, old_id, new_id) VALUES (?, ?, ?)");
        for (const row of rows) {
          insertMapping.run(table, row.id, generateUUID());
        }
      }

      console.log('UUID mappings generated.');

      // 3. Migrate each table (this is the hard part)
      // We'll define the new schemas for each table here, referencing the mapping for FKs

      // I'll implement a helper to recreate each table with UUIDs
      migrateTable('users', `
        id TEXT PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT DEFAULT 'staff' CHECK(role IN ('admin', 'staff')),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        deleted_at DATETIME,
        sync_status TEXT DEFAULT 'synced',
        source_device_id TEXT
      `);

      migrateTable('properties', `
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        address TEXT,
        type TEXT DEFAULT 'Residential' CHECK(type IN ('Residential', 'Commercial')),
        annual_income_estimate REAL DEFAULT 0,
        kra_pin TEXT,
        total_units INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        deleted_at DATETIME,
        sync_status TEXT DEFAULT 'synced',
        source_device_id TEXT
      `);

      migrateTable('houses', `
        id TEXT PRIMARY KEY,
        property_id TEXT NOT NULL,
        house_number TEXT NOT NULL,
        type TEXT,
        rent_amount REAL NOT NULL,
        status TEXT DEFAULT 'Vacant' CHECK(status IN ('Vacant', 'Occupied', 'Maintenance')),
        amenities TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        deleted_at DATETIME,
        sync_status TEXT DEFAULT 'synced',
        source_device_id TEXT,
        FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE
      `, { property_id: 'properties' });

      migrateTable('tenants', `
        id TEXT PRIMARY KEY,
        full_name TEXT NOT NULL,
        national_id TEXT UNIQUE NOT NULL CHECK(length(national_id) = 8),
        phone TEXT NOT NULL,
        email TEXT,
        house_id TEXT,
        status TEXT DEFAULT 'Active' CHECK(status IN ('Active', 'Vacated', 'Arrears')),
        move_in_date DATE,
        agreement_path TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        deleted_at DATETIME,
        sync_status TEXT DEFAULT 'synced',
        source_device_id TEXT,
        FOREIGN KEY (house_id) REFERENCES houses(id) ON DELETE SET NULL
      `, { house_id: 'houses' });

      migrateTable('transactions', `
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        type TEXT NOT NULL CHECK(type IN ('Rent Charge', 'Water Bill', 'Garbage', 'Security', 'Payment', 'Adjustment', 'Deposit')),
        amount REAL NOT NULL,
        date DATETIME DEFAULT CURRENT_TIMESTAMP,
        description TEXT,
        payment_method TEXT,
        reference_code TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        deleted_at DATETIME,
        sync_status TEXT DEFAULT 'synced',
        source_device_id TEXT,
        FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
      `, { tenant_id: 'tenants' });

      migrateTable('maintenance_requests', `
        id TEXT PRIMARY KEY,
        property_id TEXT,
        house_id TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        priority TEXT DEFAULT 'Normal' CHECK(priority IN ('Low', 'Normal', 'High', 'Critical')),
        status TEXT DEFAULT 'Open' CHECK(status IN ('Open', 'In Progress', 'Pending Approval', 'Completed', 'Rejected')),
        issue_image_path TEXT,
        receipt_image_path TEXT,
        approved_by_user_id TEXT,
        approved_at DATETIME,
        rejection_note TEXT,
        cost REAL DEFAULT 0,
        reported_date DATETIME DEFAULT CURRENT_TIMESTAMP,
        completed_date DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        deleted_at DATETIME,
        sync_status TEXT DEFAULT 'synced',
        source_device_id TEXT,
        FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE SET NULL,
        FOREIGN KEY (house_id) REFERENCES houses(id) ON DELETE CASCADE,
        FOREIGN KEY (approved_by_user_id) REFERENCES users(id) ON DELETE SET NULL
      `, { property_id: 'properties', house_id: 'houses', approved_by_user_id: 'users' });

      migrateTable('maintenance_expenses', `
        id TEXT PRIMARY KEY,
        maintenance_id TEXT NOT NULL,
        amount REAL NOT NULL,
        description TEXT,
        receipt_path TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        deleted_at DATETIME,
        sync_status TEXT DEFAULT 'synced',
        source_device_id TEXT,
        FOREIGN KEY (maintenance_id) REFERENCES maintenance_requests(id) ON DELETE CASCADE
      `, { maintenance_id: 'maintenance_requests' });

      migrateTable('maintenance_logs', `
        id TEXT PRIMARY KEY,
        maintenance_id TEXT NOT NULL,
        action TEXT NOT NULL,
        performed_by TEXT NOT NULL,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        deleted_at DATETIME,
        sync_status TEXT DEFAULT 'synced',
        source_device_id TEXT,
        FOREIGN KEY (maintenance_id) REFERENCES maintenance_requests(id) ON DELETE CASCADE,
        FOREIGN KEY (performed_by) REFERENCES users(id) ON DELETE CASCADE
      `, { maintenance_id: 'maintenance_requests', performed_by: 'users' });

      migrateTable('mri_records', `
        id TEXT PRIMARY KEY,
        month TEXT NOT NULL,
        reference_date DATE NOT NULL,
        gross_rent REAL NOT NULL,
        tax_payable REAL NOT NULL,
        net_income REAL NOT NULL,
        status TEXT DEFAULT 'Pending' CHECK(status IN ('Pending', 'Filed', 'NIL')),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        deleted_at DATETIME,
        sync_status TEXT DEFAULT 'synced',
        source_device_id TEXT
      `);

      migrateTable('expenses', `
        id TEXT PRIMARY KEY,
        property_id TEXT,
        category TEXT NOT NULL CHECK(category IN ('Utilities', 'Security', 'Maintenance', 'Admin', 'Taxes', 'Other')),
        amount REAL NOT NULL,
        date DATE DEFAULT (date('now')),
        description TEXT,
        payment_method TEXT,
        reference_id TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        deleted_at DATETIME,
        sync_status TEXT DEFAULT 'synced',
        source_device_id TEXT,
        FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE SET NULL
      `, { property_id: 'properties', reference_id: 'maintenance_requests' });

      // 4. Cleanup mapping table
      db.exec("DROP TABLE _sync_mapping");
      db.exec("PRAGMA foreign_keys = ON");
      console.log('UUID migration completed successfully.');
    })();
  } catch (err) {
    console.error('UUID Migration failed:', err);
  }
}

function migrateTable(tableName, newSchema, fkMappings = {}) {
  console.log(`Migrating table ${tableName}...`);
  // Get old column names
  const oldColumns = db.prepare(`PRAGMA table_info(${tableName})`).all().map(c => c.name);

  // Recreate table
  db.exec(`ALTER TABLE ${tableName} RENAME TO ${tableName}_old`);
  db.exec(`CREATE TABLE ${tableName} (${newSchema})`);

  // Build INSERT query
  const newColumns = db.prepare(`PRAGMA table_info(${tableName})`).all().map(c => c.name);
  const commonColumns = oldColumns.filter(c => newColumns.includes(c) && c !== 'id');

  // Columns that need mapping as FKs
  const fkCols = Object.keys(fkMappings);

  let selectClause = commonColumns.map(c => {
    if (fkCols.includes(c)) {
      const referencedTable = fkMappings[c];
      return `(SELECT new_id FROM _sync_mapping WHERE table_name = '${referencedTable}' AND old_id = ${tableName}_old.${c})`;
    }
    return c;
  });

  // Add the new UUID ID from mapping
  const columnsToInsert = ['id', ...commonColumns];
  const selectQuery = `
    SELECT 
      m.new_id,
      ${selectClause.join(', ')}
    FROM ${tableName}_old
    JOIN _sync_mapping m ON m.table_name = '${tableName}' AND m.old_id = ${tableName}_old.id
  `;

  db.exec(`INSERT INTO ${tableName} (${columnsToInsert.join(', ')}) ${selectQuery}`);
  db.exec(`DROP TABLE ${tableName}_old`);
}

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
    type TEXT DEFAULT 'Residential' CHECK(type IN ('Residential', 'Commercial')),
    annual_income_estimate REAL DEFAULT 0,
    kra_pin TEXT,
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
    agreement_path TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (house_id) REFERENCES houses(id) ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id INTEGER NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('Rent Charge', 'Water Bill', 'Garbage', 'Security', 'Payment', 'Adjustment', 'Deposit')),
    amount REAL NOT NULL,
    date DATETIME DEFAULT CURRENT_TIMESTAMP,
    description TEXT,
    payment_method TEXT,
    reference_code TEXT,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS maintenance_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    property_id INTEGER,
    house_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    priority TEXT DEFAULT 'Normal' CHECK(priority IN ('Low', 'Normal', 'High', 'Critical')),
    status TEXT DEFAULT 'Open' CHECK(status IN ('Open', 'In Progress', 'Pending Approval', 'Completed', 'Rejected')),
    issue_image_path TEXT,
    receipt_image_path TEXT,
    approved_by_user_id INTEGER,
    approved_at DATETIME,
    rejection_note TEXT,
    cost REAL DEFAULT 0,
    reported_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    completed_date DATETIME,
    FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE SET NULL,
    FOREIGN KEY (house_id) REFERENCES houses(id) ON DELETE CASCADE,
    FOREIGN KEY (approved_by_user_id) REFERENCES users(id) ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS maintenance_expenses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    maintenance_id INTEGER NOT NULL,
    amount REAL NOT NULL,
    description TEXT,
    receipt_path TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (maintenance_id) REFERENCES maintenance_requests(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS maintenance_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    maintenance_id INTEGER NOT NULL,
    action TEXT NOT NULL,
    performed_by INTEGER NOT NULL,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (maintenance_id) REFERENCES maintenance_requests(id) ON DELETE CASCADE,
    FOREIGN KEY (performed_by) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    key TEXT UNIQUE NOT NULL,
    value TEXT
  );

  CREATE TABLE IF NOT EXISTS mri_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    month TEXT NOT NULL, -- e.g. "January 2026"
    reference_date DATE NOT NULL, -- e.g. "2026-01-01"
    gross_rent REAL NOT NULL,
    tax_payable REAL NOT NULL,
    net_income REAL NOT NULL,
    status TEXT DEFAULT 'Pending' CHECK(status IN ('Pending', 'Filed', 'NIL')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS expenses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    property_id INTEGER,
    category TEXT NOT NULL CHECK(category IN ('Utilities', 'Security', 'Maintenance', 'Admin', 'Taxes', 'Other')),
    amount REAL NOT NULL,
    date DATE DEFAULT (date('now')),
    description TEXT,
    payment_method TEXT,
    reference_id INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS help_articles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category TEXT NOT NULL, -- e.g. "Glossary", "FAQ", "Guides"
    title TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    content TEXT NOT NULL, -- Markdown content
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS help_steps (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    article_id INTEGER NOT NULL,
    step_number INTEGER NOT NULL,
    instruction TEXT NOT NULL,
    target_selector TEXT, -- CSS selector to highlight
    media_url TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (article_id) REFERENCES help_articles(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS user_help_progress (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('Article', 'Tour')),
    target_id TEXT NOT NULL, -- slug or article_id
    completed INTEGER DEFAULT 0,
    completed_at DATETIME,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  -- Sync Module Tables
  CREATE TABLE IF NOT EXISTS authorized_devices (
    id TEXT PRIMARY KEY,
    device_name TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('owner', 'branch')),
    api_token TEXT UNIQUE NOT NULL,
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS sync_logs (
    id TEXT PRIMARY KEY,
    device_id TEXT NOT NULL,
    records_received INTEGER DEFAULT 0,
    records_sent INTEGER DEFAULT 0,
    sync_started_at DATETIME NOT NULL,
    sync_completed_at DATETIME,
    status TEXT NOT NULL,
    error_message TEXT,
    FOREIGN KEY (device_id) REFERENCES authorized_devices(id) ON DELETE CASCADE
  );
`;

const crypto = require('crypto');

function generateUUID() {
  return crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(16).toString('hex');
}

// ... (existing code)

function seedSettings() {
  const defaultSettings = [
    { key: 'company_name', value: 'Rental Management System' },
    { key: 'company_address', value: '123 Main St, City' },
    { key: 'company_phone', value: '0700 000 000' },
    { key: 'mri_enabled', value: 'false' },
    { key: 'penalty_enabled', value: 'false' },
    { key: 'penalty_type', value: 'Fixed' }, // Fixed or Percentage
    { key: 'penalty_amount', value: '0' },
    { key: 'installation_date', value: new Date().toISOString() },
    { key: 'license_key', value: '' },
    { key: 'jwt_secret', value: crypto.randomBytes(64).toString('hex') },
    { key: 'device_id', value: generateUUID() },
    { key: 'last_sync_timestamp', value: '1970-01-01T00:00:00Z' }
  ];

  const stmt = db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)');
  defaultSettings.forEach(s => stmt.run(s.key, s.value));
}

function getJwtSecret() {
  try {
    const row = db.prepare("SELECT value FROM settings WHERE key = 'jwt_secret'").get();
    if (row) return row.value;

    // Fallback: If for some reason it's missing, generate and save one now
    const newSecret = crypto.randomBytes(64).toString('hex');
    db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('jwt_secret', ?)").run(newSecret);
    return newSecret;
  } catch (err) {
    console.error('CRITICAL: Failed to retrieve JWT secret from DB:', err);
    // Absolute last resort fallback to prevent crash, but should not happen if DB is up
    return process.env.JWT_SECRET || 'emergency-fallback-secret-DO-NOT-USE-IN-PROD';
  }
}

function seedHelpContent() {
  const articles = [
    {
      category: 'Glossary',
      title: 'Monthly Rental Income Tax (MRI)',
      slug: 'glossary-mri',
      content: 'Residential Rental Income Tax (MRI) is a simplified tax on rental income. It is applicable to residential property owners who earn between KES 288,000 and KES 15,000,000 per year. The rate is currently set at **7.5%** of the gross rent collected.'
    },
    {
      category: 'Glossary',
      title: 'Arrears & Default',
      slug: 'glossary-arrears',
      content: 'Arrears refers to the total unpaid balance a tenant owes. In this system, a **Default** is generally recognized when a tenant has unpaid rent exceeding two monthly rent cycles. This may trigger penalties if configured in Settings.'
    },
    {
      category: 'Glossary',
      title: 'Penalties (Late Fees)',
      slug: 'glossary-penalties',
      content: 'Penalties are additional charges applied to tenants who fail to pay their rent on time. They can be configured as a **Fixed Amount** (e.g., KES 500) or a **Percentage** (e.g., 5% of arrears).'
    },
    {
      category: 'Guides',
      title: 'How to Add a Tenant',
      slug: 'guide-add-tenant',
      content: 'To add a new tenant:\n\n1. Go to the **Tenants** page from the sidebar.\n2. Click the **"Add Tenant"** button.\n3. Fill in the full name, national ID (8 digits), phone number, and optional email.\n4. Select a vacant house from the list.\n5. Click **"Save Tenant"**.'
    },
    {
      category: 'Guides',
      title: 'How to Record a Payment',
      slug: 'guide-record-payment',
      content: 'To record a rent payment:\n\n1. Go to the **Finance & Payments** page.\n2. Click the green **"Record Payment"** button.\n3. Search for and select the tenant.\n4. Enter the amount paid, date, and payment method (e.g., MPESA).\n5. Click **"Record Payment"** to update their balance.'
    }
  ];

  const stmt = db.prepare('INSERT OR IGNORE INTO help_articles (category, title, slug, content) VALUES (?, ?, ?, ?)');
  articles.forEach(a => stmt.run(a.category, a.title, a.slug, a.content));

  // Seed guided tour steps for "Add Tenant"
  const addTenantArticle = db.prepare('SELECT id FROM help_articles WHERE slug = ?').get('guide-add-tenant');
  if (addTenantArticle) {
    const steps = [
      { step_number: 1, instruction: 'Navigate to the Tenants page using the sidebar link.', target_selector: 'nav a[href="/tenants"]' },
      { step_number: 2, instruction: 'Click the "Add Tenant" button to open the registration form.', target_selector: '#btn-add-tenant' },
      { step_number: 3, instruction: 'Complete the form with the tenant details.', target_selector: '#form-tenant' }
    ];
    const stepStmt = db.prepare('INSERT OR IGNORE INTO help_steps (article_id, step_number, instruction, target_selector) VALUES (?, ?, ?, ?)');
    steps.forEach(s => stepStmt.run(addTenantArticle.id, s.step_number, s.instruction, s.target_selector));
  }
}

function seedAdminUser() {
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get('admin');
  if (!user) {
    console.log('Seeding default admin user...');
    const hash = bcrypt.hashSync('admin123', 10);
    db.prepare('INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)').run('admin', hash, 'admin');
    console.log('Default admin user created: admin / admin123');
  }
}

function migrate() {
  console.log('Checking for migrations...');
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

    // Migration for mri_records
    const mriColumns = db.prepare("PRAGMA table_info(mri_records)").all();
    const mriColumnNames = mriColumns.map(c => c.name);
    if (!mriColumnNames.includes('reference_date')) {
      console.log("Adding 'reference_date' column to mri_records...");
      db.prepare("ALTER TABLE mri_records ADD COLUMN reference_date DATE").run();
      db.prepare("UPDATE mri_records SET reference_date = date('now')").run();
    }

    // Migration for tenants
    const tenantColumns = db.prepare("PRAGMA table_info(tenants)").all();
    const tenantColumnNames = tenantColumns.map(c => c.name);
    if (!tenantColumnNames.includes('agreement_path')) {
      console.log("Adding 'agreement_path' column to tenants...");
      db.prepare("ALTER TABLE tenants ADD COLUMN agreement_path TEXT").run();
    }

    // Migration for transactions Check Constraint (allow 'Deposit')
    const transactionsDef = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='transactions'").get();
    if (transactionsDef && !transactionsDef.sql.includes("'Deposit'")) {
      console.log("Migrating transactions table to include 'Deposit' type...");
      const migrateTransactions = db.transaction(() => {
        db.prepare("ALTER TABLE transactions RENAME TO transactions_old").run();
        db.prepare(`
              CREATE TABLE transactions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                tenant_id INTEGER NOT NULL,
                type TEXT NOT NULL CHECK(type IN ('Rent Charge', 'Water Bill', 'Garbage', 'Security', 'Payment', 'Adjustment', 'Deposit')),
                amount REAL NOT NULL,
                date DATETIME DEFAULT CURRENT_TIMESTAMP,
                description TEXT,
                payment_method TEXT,
                reference_code TEXT,
                FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
              )
            `).run();
        const oldData = db.prepare("SELECT * FROM transactions_old").all();
        const insertStmt = db.prepare("INSERT INTO transactions VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
        oldData.forEach(row => insertStmt.run(...Object.values(row)));
        db.prepare("DROP TABLE transactions_old").run();
      });
      migrateTransactions();
      console.log("Transactions table migrated.");
    }

    // Maintenance Module Migrations
    const maintenanceRequestColumns = db.prepare("PRAGMA table_info(maintenance_requests)").all();
    const mrColumnNames = maintenanceRequestColumns.map(c => c.name);

    if (!mrColumnNames.includes('property_id')) {
      console.log("Adding Maintenance columns...");
      db.prepare("ALTER TABLE maintenance_requests ADD COLUMN property_id INTEGER").run();
      db.prepare("ALTER TABLE maintenance_requests ADD COLUMN title TEXT").run();
      db.prepare("ALTER TABLE maintenance_requests ADD COLUMN issue_image_path TEXT").run();
      db.prepare("ALTER TABLE maintenance_requests ADD COLUMN receipt_image_path TEXT").run();
      db.prepare("ALTER TABLE maintenance_requests ADD COLUMN approved_by_user_id INTEGER").run();
      db.prepare("ALTER TABLE maintenance_requests ADD COLUMN approved_at DATETIME").run();
      db.prepare("ALTER TABLE maintenance_requests ADD COLUMN rejection_note TEXT").run();

      // Populate property_id for existing requests
      db.prepare(`
            UPDATE maintenance_requests 
            SET property_id = (SELECT property_id FROM houses WHERE houses.id = maintenance_requests.house_id)
        `).run();
    }

    // Check if status constraint needs expansion
    const mrTableInfo = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='maintenance_requests'").get();
    if (mrTableInfo && !mrTableInfo.sql.includes("'Pending Approval'")) {
      console.log("Updating maintenance_requests status constraints...");
      db.transaction(() => {
        db.prepare("ALTER TABLE maintenance_requests RENAME TO maintenance_requests_old").run();
        db.prepare(`
                CREATE TABLE maintenance_requests (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    property_id INTEGER,
                    house_id INTEGER NOT NULL,
                    title TEXT NOT NULL,
                    description TEXT NOT NULL,
                    priority TEXT DEFAULT 'Normal' CHECK(priority IN ('Low', 'Normal', 'High', 'Critical')),
                    status TEXT DEFAULT 'Open' CHECK(status IN ('Open', 'In Progress', 'Pending Approval', 'Completed', 'Rejected')),
                    issue_image_path TEXT,
                    receipt_image_path TEXT,
                    approved_by_user_id INTEGER,
                    approved_at DATETIME,
                    rejection_note TEXT,
                    cost REAL DEFAULT 0,
                    reported_date DATETIME DEFAULT CURRENT_TIMESTAMP,
                    completed_date DATETIME,
                    FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE SET NULL,
                    FOREIGN KEY (house_id) REFERENCES houses(id) ON DELETE CASCADE,
                    FOREIGN KEY (approved_by_user_id) REFERENCES users(id) ON DELETE SET NULL
                )
            `).run();

        // Map old columns to new
        const oldData = db.prepare("SELECT * FROM maintenance_requests_old").all();
        const insertStmt = db.prepare(`
                INSERT INTO maintenance_requests (
                    id, house_id, description, priority, status, cost, reported_date, completed_date, 
                    property_id, title, issue_image_path, receipt_image_path, approved_by_user_id, approved_at, rejection_note
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `);

        oldData.forEach(row => {
          insertStmt.run(
            row.id,
            row.house_id,
            row.description,
            row.priority,
            row.status,
            row.cost,
            row.reported_date,
            row.completed_date,
            row.property_id || null,
            row.title || 'Untitled Issue',
            row.issue_image_path || null,
            row.receipt_image_path || null,
            row.approved_by_user_id || null,
            row.approved_at || null,
            row.rejection_note || null
          );
        });
        db.prepare("DROP TABLE maintenance_requests_old").run();
      })();
    }

    // New Maintenance Tables
    db.exec(`
        CREATE TABLE IF NOT EXISTS maintenance_expenses (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            maintenance_id INTEGER NOT NULL,
            amount REAL NOT NULL,
            description TEXT,
            receipt_path TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (maintenance_id) REFERENCES maintenance_requests(id) ON DELETE CASCADE
        );
        CREATE TABLE IF NOT EXISTS maintenance_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            maintenance_id INTEGER NOT NULL,
            action TEXT NOT NULL,
            performed_by INTEGER NOT NULL,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (maintenance_id) REFERENCES maintenance_requests(id) ON DELETE CASCADE,
            FOREIGN KEY (performed_by) REFERENCES users(id) ON DELETE CASCADE
        );
    `);

    // Expenses table migration
    const expensesColumns = db.prepare("PRAGMA table_info(expenses)").all();
    if (!expensesColumns.map(c => c.name).includes('reference_id')) {
      console.log("Adding reference_id to expenses...");
      db.prepare("ALTER TABLE expenses ADD COLUMN reference_id INTEGER").run();
    }

    console.log('Migrations checked/applied.');
  } catch (err) {
    console.error('Migration error:', err);
  }
}

function initDb() {
  console.log('Initializing Database...');
  initializeDatabase().catch(err => {
    console.error('Error initializing database:', err);
  });
}

module.exports = { initDb, get db() { return db; }, initializeDatabase, getJwtSecret };
