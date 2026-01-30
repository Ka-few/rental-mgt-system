const Database = require('better-sqlite3');
const path = require('path');

const bcrypt = require('bcryptjs');

const dbPath = process.env.DB_PATH || path.join(__dirname, '../rental.db');
console.log('SQLITE DATABASE PATH:', dbPath);
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
    house_id INTEGER NOT NULL,
    description TEXT NOT NULL,
    priority TEXT DEFAULT 'Normal' CHECK(priority IN ('Low', 'Normal', 'High', 'Critical')),
    status TEXT DEFAULT 'Open' CHECK(status IN ('Open', 'In Progress', 'Closed')),
    cost REAL DEFAULT 0,
    reported_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    completed_date DATETIME,
    FOREIGN KEY (house_id) REFERENCES houses(id) ON DELETE CASCADE
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
`;

function seedSettings() {
  const defaultSettings = [
    { key: 'company_name', value: 'Rental Management System' },
    { key: 'company_address', value: '123 Main St, City' },
    { key: 'company_phone', value: '0700 000 000' },
    { key: 'mri_enabled', value: 'false' },
    { key: 'penalty_enabled', value: 'false' },
    { key: 'penalty_type', value: 'Fixed' }, // Fixed or Percentage
    { key: 'penalty_amount', value: '0' }
  ];

  const stmt = db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)');
  defaultSettings.forEach(s => stmt.run(s.key, s.value));
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
    // Note: reference_date is already in the main schema string now
    // Only add if it's an old DB that hasn't been updated
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
      // Use a transaction for safety
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
        db.prepare("INSERT INTO transactions SELECT * FROM transactions_old").run();
        db.prepare("DROP TABLE transactions_old").run();
      });
      migrateTransactions();
      console.log("Transactions table migrated.");
    }

    console.log('Migrations checked/applied.');
  } catch (err) {
    console.error('Migration error:', err);
  }
}

function initDb() {
  console.log('Initializing Database...');
  try {
    db.exec(schema);
    migrate();
    seedSettings();
    seedAdminUser();
    seedHelpContent();
    console.log('Database Schema Applied & Default Settings Seeded Successfully.');
  } catch (err) {
    console.error('Error initializing database:', err);
  }
}

if (require.main === module) {
  initDb();
}

module.exports = { initDb, db };
