const express = require('express');
const router = express.Router();
const { db } = require('../db/init');

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
    try {
        const stmt = db.prepare(`
        INSERT INTO transactions (tenant_id, type, amount, description, payment_method, reference_code, date)
        VALUES (?, 'Payment', ?, ?, ?, ?, ?)
    `);
        const info = stmt.run(tenant_id, amount, description, payment_method, reference_code, date || new Date().toISOString());
        res.json({ id: info.lastInsertRowid, success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Add a Charge (Rent, Water, etc)
router.post('/charge', (req, res) => {
    const { tenant_id, type, amount, description } = req.body;
    try {
        const stmt = db.prepare(`
            INSERT INTO transactions (tenant_id, type, amount, description)
            VALUES (?, ?, ?, ?)
        `);
        const info = stmt.run(tenant_id, type, amount, description);
        res.json({ id: info.lastInsertRowid, success: true });
    } catch (err) {
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
                SUM(CASE WHEN type = 'Payment' THEN amount ELSE -amount END) as balance
            FROM tenants t
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

module.exports = router;
