const { db, generateUUID } = require('../db/init');

// --- HELPER FUNCTIONS ---

const buildReportQuery = (accountTypes) => {
    const placeholders = accountTypes.map(() => '?').join(',');
    return `
    SELECT a.id, a.name, a.type, SUM(
      CASE 
        WHEN jl.type = 'debit' THEN jl.amount 
        WHEN jl.type = 'credit' THEN -jl.amount 
        ELSE 0 
      END
    ) as balance
    FROM accounts a
    LEFT JOIN journal_lines jl ON a.id = jl.account_id
    WHERE a.type IN (${placeholders})
    GROUP BY a.id, a.name, a.type
  `;
};

// Normalize balances according to account type
// Debits increase Assets/Expenses, Credits increase Liability/Equity/Revenue
const normalizeBalance = (balance, type) => {
    if (['Asset', 'Expense'].includes(type)) return balance || 0;
    return -(balance || 0);
};

// --- CORE ENGINE: CREATE JOURNAL ENTRY ---
// lines: [{ account_id, type: 'debit'|'credit', amount: Number }]
const recordJournalEntry = (date, memo, reference_id, lines) => {
    // Validate double entry
    let totalDebits = 0;
    let totalCredits = 0;

    lines.forEach(line => {
        if (line.type === 'debit') totalDebits += line.amount;
        if (line.type === 'credit') totalCredits += line.amount;
    });

    if (Math.abs(totalDebits - totalCredits) > 0.01) {
        throw new Error(`Double-entry validation failed: Debits (${totalDebits}) != Credits (${totalCredits})`);
    }

    const entryId = generateUUID();
    const entryDate = date || new Date().toISOString();

    // Execute transactionally
    db.transaction(() => {
        db.prepare('INSERT INTO journal_entries (id, date, memo, reference_id) VALUES (?, ?, ?, ?)').run(
            entryId, entryDate, memo, reference_id
        );

        const insertLine = db.prepare('INSERT INTO journal_lines (id, journal_entry_id, account_id, type, amount) VALUES (?, ?, ?, ?, ?)');

        lines.forEach(line => {
            insertLine.run(generateUUID(), entryId, line.account_id, line.type, line.amount);
        });
    })();

    return entryId;
};

// --- API ENDPOINTS ---

const getChartOfAccounts = (req, res) => {
    try {
        const accounts = db.prepare('SELECT * FROM accounts ORDER BY type, name').all();
        res.json(accounts);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

const getProfitAndLoss = (req, res) => {
    try {
        const rawData = db.prepare(buildReportQuery(['Revenue', 'Expense'])).all('Revenue', 'Expense');

        let totalRevenue = 0;
        let totalExpense = 0;

        const report = rawData.map(row => {
            const normalized = normalizeBalance(row.balance, row.type);
            if (row.type === 'Revenue') totalRevenue += normalized;
            if (row.type === 'Expense') totalExpense += normalized;
            return { ...row, balance: normalized };
        });

        const netIncome = totalRevenue - totalExpense;

        res.json({ accounts: report, totalRevenue, totalExpense, netIncome });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

const getBalanceSheet = (req, res) => {
    try {
        const rawData = db.prepare(buildReportQuery(['Asset', 'Liability', 'Equity'])).all('Asset', 'Liability', 'Equity');

        let totalAssets = 0;
        let totalLiabilities = 0;
        let totalEquity = 0;

        const report = rawData.map(row => {
            const normalized = normalizeBalance(row.balance, row.type);
            if (row.type === 'Asset') totalAssets += normalized;
            if (row.type === 'Liability') totalLiabilities += normalized;
            if (row.type === 'Equity') totalEquity += normalized;
            return { ...row, balance: normalized };
        });

        // True Equity calculation requires adding Net Income
        const plRaw = db.prepare(buildReportQuery(['Revenue', 'Expense'])).all('Revenue', 'Expense');
        let netIncome = 0;
        plRaw.forEach(row => {
            const normalized = normalizeBalance(row.balance, row.type);
            if (row.type === 'Revenue') netIncome += normalized;
            if (row.type === 'Expense') netIncome -= normalized;
        });

        res.json({ accounts: report, totalAssets, totalLiabilities, totalEquity, netIncome });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

const getJournalEntries = (req, res) => {
    try {
        const limit = req.query.limit || 50;
        const entries = db.prepare('SELECT * FROM journal_entries ORDER BY date DESC LIMIT ?').all(limit);

        // Attach lines to entries
        const linesStmt = db.prepare(`
      SELECT jl.*, a.name as account_name 
      FROM journal_lines jl 
      JOIN accounts a ON jl.account_id = a.id 
      WHERE jl.journal_entry_id = ?
    `);

        entries.forEach(entry => {
            entry.lines = linesStmt.all(entry.id);
        });

        res.json(entries);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Internal API helpers to get common accounts
const getAccountByName = (name) => {
    return db.prepare('SELECT * FROM accounts WHERE name = ?').get(name);
};

module.exports = {
    recordJournalEntry,
    getAccountByName,
    getChartOfAccounts,
    getProfitAndLoss,
    getBalanceSheet,
    getJournalEntries
};
