const express = require('express');
const router = express.Router();
const { db, generateUUID } = require('../db/init');
const { authorizeAdmin } = require('../middleware/auth');

router.use(authorizeAdmin);

// Get all expenses
router.get('/', (req, res) => {
    try {
        const { property_id } = req.query;
        let query = `
            SELECT e.*, p.name as property_name 
            FROM expenses e
            LEFT JOIN properties p ON e.property_id = p.id
        `;
        let params = [];

        if (property_id) {
            query += " WHERE e.property_id = ?";
            params.push(property_id);
        }

        query += " ORDER BY e.date DESC, e.created_at DESC";

        const expenses = db.prepare(query).all(...params);
        res.json(expenses);
    } catch (err) {
        console.error('GET EXPENSES ERROR:', err);
        res.status(500).json({ error: err.message });
    }
});

// Add new expense
router.post('/', (req, res) => {
    const { property_id, category, amount, date, description, payment_method } = req.body;

    if (!category || !amount) {
        return res.status(400).json({ error: 'Category and amount are required' });
    }

    try {
        const id = generateUUID();
        const stmt = db.prepare(`
            INSERT INTO expenses (id, property_id, category, amount, description, payment_method, date)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `);
        stmt.run(id, property_id || null, category, Number(amount), description || '', payment_method || 'Cash', date || new Date().toISOString().split('T')[0]);
        res.json({ id, message: 'Expense recorded successfully' });
    } catch (err) {
        console.error('ADD EXPENSE ERROR:', err);
        res.status(500).json({ error: err.message });
    }
});

// Delete expense
router.delete('/:id', (req, res) => {
    try {
        const stmt = db.prepare('DELETE FROM expenses WHERE id = ?');
        const info = stmt.run(req.params.id);
        if (info.changes === 0) {
            return res.status(404).json({ error: 'Expense not found' });
        }
        res.json({ message: 'Expense deleted successfully' });
    } catch (err) {
        console.error('DELETE EXPENSE ERROR:', err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
