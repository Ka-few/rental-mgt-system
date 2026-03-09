const express = require('express');
const router = express.Router();
const { db, generateUUID } = require('../db/init');

// Get transactions for a tenant
router.get('/tenant/:id', (req, res) => {
    try {
        const transactions = db.prepare('SELECT * FROM transactions WHERE tenant_id = ? ORDER BY date DESC').all(req.params.id);
        res.json(transactions);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Record a Payment
router.post('/payment', (req, res) => {
    const { tenant_id, amount, description, payment_method, reference_code, date } = req.body;
    if (!tenant_id || !amount || Number(amount) <= 0) {
        return res.status(400).json({ error: 'Tenant ID and a valid amount are required' });
    }
    try {
        const id = generateUUID();
        const stmt = db.prepare(`
            INSERT INTO transactions (id, tenant_id, type, amount, description, payment_method, reference_code, date)
            VALUES (?, ?, 'Payment', ?, ?, ?, ?, ?)
        `);
        stmt.run(id, tenant_id, amount, description, payment_method, reference_code, date || new Date().toISOString());
        res.json({ id, success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Add a Charge (Rent, Water, etc)
router.post('/charge', (req, res) => {
    const { tenant_id, type, amount, description } = req.body;
    if (!tenant_id || !type || !amount || Number(amount) <= 0) {
        return res.status(400).json({ error: 'Tenant ID, charge type, and a valid amount are required' });
    }
    try {
        const id = generateUUID();
        const stmt = db.prepare(`
            INSERT INTO transactions (id, tenant_id, type, amount, description)
            VALUES (?, ?, ?, ?, ?)
        `);
        stmt.run(id, tenant_id, type, amount, description);
        res.json({ id, success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Monthly Rent Run (Charge all active tenants)
router.post('/rent-run', (req, res) => {
    try {
        const month = new Date().toLocaleString('default', { month: 'long', year: 'numeric' });
        const description = `Monthly Rent - ${month}`;

        // ── Deduplication guard ───────────────────────────────────────────────
        // Check whether a Rent Charge for this month has already been run.
        const alreadyRun = db.prepare(`
            SELECT COUNT(*) as cnt FROM transactions
            WHERE type = 'Rent Charge' AND description = ?
        `).get(description);

        if (alreadyRun.cnt > 0) {
            return res.status(409).json({
                message: `Rent run for ${month} has already been posted. Running it again would double-charge all tenants.`,
                alreadyRun: true
            });
        }
        // ─────────────────────────────────────────────────────────────────────

        const activeTenants = db.prepare(`
            SELECT t.id, h.rent_amount 
            FROM tenants t 
            JOIN houses h ON t.house_id = h.id 
            WHERE t.status = 'Active' AND h.rent_amount > 0
        `).all();

        const insertStmt = db.prepare(`
            INSERT INTO transactions (id, tenant_id, type, amount, description, date)
            VALUES (?, ?, 'Rent Charge', ?, ?, ?)
        `);

        const date = new Date().toISOString();

        const transaction = db.transaction((tenants) => {
            for (const tenant of tenants) {
                insertStmt.run(generateUUID(), tenant.id, tenant.rent_amount, description, date);
            }
        });

        transaction(activeTenants);

        // --- NEW: Automatically apply penalties during rent run ---
        try {
            const settings = {};
            db.prepare("SELECT key, value FROM settings WHERE key IN ('penalty_enabled', 'penalty_type', 'penalty_amount')")
                .all().forEach(s => settings[s.key] = s.value);

            if (settings.penalty_enabled === 'true') {
                const lateTenants = db.prepare(`
                    SELECT t.id, h.rent_amount, SUM(CASE WHEN tr.type = 'Payment' THEN tr.amount ELSE -tr.amount END) as balance
                    FROM tenants t
                    JOIN houses h ON t.house_id = h.id
                    LEFT JOIN transactions tr ON t.id = tr.tenant_id
                    WHERE t.status = 'Active'
                    GROUP BY t.id, h.rent_amount
                    HAVING balance < (-2 * h.rent_amount)
                `).all();

                const penaltyStmt = db.prepare(`INSERT INTO transactions (id, tenant_id, type, amount, description, date) VALUES (?, ?, 'Adjustment', ?, ?, ?)`);
                const penaltyDate = new Date().toISOString();

                db.transaction(() => {
                    for (const tenant of lateTenants) {
                        const amount = settings.penalty_type === 'Fixed' ? parseFloat(settings.penalty_amount) : Math.abs(tenant.balance) * (parseFloat(settings.penalty_amount) / 100);
                        if (amount > 0) {
                            penaltyStmt.run(generateUUID(), tenant.id, amount, `Late Payment Penalty - ${new Date().toLocaleDateString('default', { month: 'long', year: 'numeric' })}`, penaltyDate);
                        }
                    }
                })();
            }
        } catch (pErr) {
            console.error('Penalty application during rent run failed:', pErr);
        }
        // --- END PENALTY LOGIC ---

        res.json({ success: true, count: activeTenants.length, message: `Generated rent for ${activeTenants.length} active tenants (and checked for penalties).` });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

// Get Balances (Dashboard/Report)
// Calculated on flight or stored? Calculated is safer for consistency.
router.get('/balances', (req, res) => {
    try {
        const balances = db.prepare(`
            SELECT 
                t.id as tenant_id, 
                t.full_name,
                h.house_number,
                p.name as property_name,
                SUM(CASE WHEN tr.type = 'Payment' THEN tr.amount ELSE -tr.amount END) as balance
            FROM tenants t
            LEFT JOIN houses h ON t.house_id = h.id
            LEFT JOIN properties p ON h.property_id = p.id
            LEFT JOIN transactions tr ON t.id = tr.tenant_id
            GROUP BY t.id
        `).all();
        res.json(balances);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Update Transaction
router.put('/transactions/:id', (req, res) => {
    const { amount, date, description, payment_method, reference_code } = req.body;
    const { id } = req.params;

    try {
        const updates = [];
        const params = [];

        if (amount) { updates.push('amount = ?'); params.push(amount); }
        if (date) { updates.push('date = ?'); params.push(date); }
        if (description) { updates.push('description = ?'); params.push(description); }
        if (payment_method) { updates.push('payment_method = ?'); params.push(payment_method); }
        if (reference_code !== undefined) { updates.push('reference_code = ?'); params.push(reference_code); }

        if (updates.length === 0) return res.status(400).json({ error: 'No fields to update' });

        params.push(id);
        const stmt = db.prepare(`UPDATE transactions SET ${updates.join(', ')} WHERE id = ?`);
        const info = stmt.run(...params);

        if (info.changes === 0) return res.status(404).json({ error: 'Transaction not found' });

        res.json({ message: 'Transaction updated' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Apply Penalties (Detect 2+ months default)
router.get('/apply-penalties', (req, res) => {
    res.status(405).json({
        error: 'Method Not Allowed',
        message: 'Please use the "Apply Penalties" button on the Finance page in the application to trigger this calculation.'
    });
});

router.post('/apply-penalties', (req, res) => {
    try {
        const settings = {};
        db.prepare("SELECT key, value FROM settings WHERE key IN ('penalty_enabled', 'penalty_type', 'penalty_amount')")
            .all().forEach(s => settings[s.key] = s.value);

        if (settings.penalty_enabled !== 'true') {
            return res.json({ success: false, message: 'Penalties are disabled.' });
        }

        const activeTenants = db.prepare(`
            SELECT 
                t.id, t.full_name, h.rent_amount,
                SUM(CASE WHEN tr.type = 'Payment' THEN tr.amount ELSE -tr.amount END) as balance
            FROM tenants t
            JOIN houses h ON t.house_id = h.id
            LEFT JOIN transactions tr ON t.id = tr.tenant_id
            WHERE t.status = 'Active'
            GROUP BY t.id, h.rent_amount
            HAVING balance < (-2 * h.rent_amount) -- Default: Balance is twice the monthly rent (approx 2 months unpaid)
        `).all();

        const insertStmt = db.prepare(`
            INSERT INTO transactions (id, tenant_id, type, amount, description, date)
            VALUES (?, ?, 'Adjustment', ?, ?, ?)
        `);

        let appliedCount = 0;
        const date = new Date().toISOString();

        db.transaction(() => {
            for (const tenant of activeTenants) {
                let amount = 0;
                const balanceVal = tenant.balance || 0;
                const arrears = Math.abs(balanceVal);

                if (settings.penalty_type === 'Fixed') {
                    amount = parseFloat(settings.penalty_amount || 0);
                } else {
                    amount = arrears * (parseFloat(settings.penalty_amount || 0) / 100);
                }

                if (amount > 0) {
                    insertStmt.run(generateUUID(), tenant.id, amount, `Late Payment Penalty - ${new Date().toLocaleDateString('default', { month: 'long', year: 'numeric' })}`, date);
                    appliedCount++;
                }
            }
        })();

        res.json({ success: true, count: appliedCount, message: `Applied penalties to ${appliedCount} tenants.` });
    } catch (err) {
        console.error('APPLY PENALTIES ERROR:', err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
