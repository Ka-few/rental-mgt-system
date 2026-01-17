const express = require('express');
const router = express.Router();
const { db } = require('../db/init');

// Get all requests
router.get('/', (req, res) => {
    try {
        const requests = db.prepare(`
        SELECT m.*, h.house_number, p.name as property_name
        FROM maintenance_requests m
        JOIN houses h ON m.house_id = h.id
        JOIN properties p ON h.property_id = p.id
        ORDER BY m.reported_date DESC
    `).all();
        res.json(requests);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Create Request
router.post('/', (req, res) => {
    const { house_id, description, priority } = req.body;
    try {
        const stmt = db.prepare(`
            INSERT INTO maintenance_requests (house_id, description, priority, status)
            VALUES (?, ?, ?, 'Open')
        `);
        const info = stmt.run(house_id, description, priority || 'Normal');
        res.json({ id: info.lastInsertRowid, success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Update Status
router.put('/:id', (req, res) => {
    const { status, cost, completed_date } = req.body;
    try {
        const stmt = db.prepare(`
            UPDATE maintenance_requests 
            SET status = COALESCE(?, status), 
                cost = COALESCE(?, cost),
                completed_date = COALESCE(?, completed_date)
            WHERE id = ?
        `);
        stmt.run(status, cost, completed_date, req.params.id);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Delete Request
router.delete('/:id', (req, res) => {
    try {
        const stmt = db.prepare('DELETE FROM maintenance_requests WHERE id = ?');
        const info = stmt.run(req.params.id);
        if (info.changes === 0) return res.status(404).json({ error: 'Request not found' });
        res.json({ message: 'Request deleted' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
