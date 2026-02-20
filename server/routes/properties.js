const express = require('express');
const router = express.Router();
const { db, generateUUID } = require('../db/init');

// Get all properties with unit count
router.get('/', (req, res) => {
    try {
        const properties = db.prepare('SELECT * FROM properties').all();
        res.json(properties);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Create property
router.post('/', (req, res) => {
    const { name, address, total_units, type, annual_income_estimate, kra_pin } = req.body;
    try {
        const id = generateUUID();
        const stmt = db.prepare('INSERT INTO properties (id, name, address, total_units, type, annual_income_estimate, kra_pin) VALUES (?, ?, ?, ?, ?, ?, ?)');
        stmt.run(id, name, address, total_units || 0, type || 'Residential', annual_income_estimate || 0, kra_pin || '');
        res.json({ id, ...req.body });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Update Property
router.put('/:id', (req, res) => {
    const { name, address, total_units, type, annual_income_estimate, kra_pin } = req.body;
    const { id } = req.params;
    try {
        const stmt = db.prepare(`
            UPDATE properties 
            SET name = ?, address = ?, total_units = ?, type = ?, annual_income_estimate = ?, kra_pin = ?
            WHERE id = ?
        `);
        stmt.run(name, address, total_units, type, annual_income_estimate, kra_pin, id);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get houses for a property
router.get('/:id/houses', (req, res) => {
    try {
        const houses = db.prepare(`
            SELECT h.*, 
            CASE WHEN COUNT(t.id) > 0 THEN 'Occupied' ELSE h.status END as status
            FROM houses h
            LEFT JOIN tenants t ON h.id = t.house_id AND t.status = 'Active'
            WHERE h.property_id = ?
            GROUP BY h.id
        `).all(req.params.id);
        res.json(houses);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Create house
router.post('/:id/houses', (req, res) => {
    const { house_number, type, rent_amount, amenities } = req.body;
    const property_id = req.params.id;
    try {
        const houseId = generateUUID();
        const stmt = db.prepare(`
      INSERT INTO houses (id, property_id, house_number, type, rent_amount, status, amenities)
      VALUES (?, ?, ?, ?, ?, 'Vacant', ?)
    `);
        stmt.run(houseId, property_id, house_number, type, rent_amount, JSON.stringify(amenities || {}));
        res.json({ id: houseId, ...req.body });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Update House
router.put('/houses/:id', (req, res) => {
    const { house_number, type, rent_amount, amenities, status } = req.body;
    const { id } = req.params;

    try {
        const updates = [];
        const params = [];

        if (house_number) { updates.push('house_number = ?'); params.push(house_number); }
        if (type) { updates.push('type = ?'); params.push(type); }
        if (rent_amount) { updates.push('rent_amount = ?'); params.push(rent_amount); }
        if (status) { updates.push('status = ?'); params.push(status); }
        if (amenities) { updates.push('amenities = ?'); params.push(JSON.stringify(amenities)); }

        if (updates.length === 0) return res.status(400).json({ error: 'No fields to update' });

        params.push(id);
        const stmt = db.prepare(`UPDATE houses SET ${updates.join(', ')} WHERE id = ?`);
        const info = stmt.run(...params);

        if (info.changes === 0) return res.status(404).json({ error: 'House not found' });

        res.json({ message: 'House updated' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
