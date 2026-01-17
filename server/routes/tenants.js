const express = require('express');
const router = express.Router();
const { db } = require('../db/init');

// Get all tenants
router.get('/', (req, res) => {
    try {
        // Join with house details
        const tenants = db.prepare(`
      SELECT t.*, h.house_number, p.name as property_name, p.id as property_id 
      FROM tenants t
      LEFT JOIN houses h ON t.house_id = h.id
      LEFT JOIN properties p ON h.property_id = p.id
    `).all();
        res.json(tenants);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Register Tenant
router.post('/', (req, res) => {
    const { full_name, national_id, phone, email, house_id, move_in_date } = req.body;

    if (!national_id || national_id.length !== 8) {
        return res.status(400).json({ error: 'National ID must be 8 digits' });
    }

    const insert = db.transaction(() => {
        // Insert Tenant
        const stmt = db.prepare(`
      INSERT INTO tenants (full_name, national_id, phone, email, house_id, move_in_date, status)
      VALUES (?, ?, ?, ?, ?, ?, 'Active')
    `);
        const info = stmt.run(full_name, national_id, phone, email, house_id, move_in_date || new Date().toISOString());
        const tenantId = info.lastInsertRowid;

        // Update House Status to Occupied
        if (house_id) {
            db.prepare("UPDATE houses SET status = 'Occupied' WHERE id = ?").run(house_id);
        }
        return tenantId;
    });

    try {
        const tenantId = insert();
        res.json({ id: tenantId, ...req.body });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Update Tenant
router.put('/:id', (req, res) => {
    const { full_name, national_id, phone, email, house_id, status } = req.body;
    const { id } = req.params;

    try {
        const updates = [];
        const params = [];

        if (full_name) { updates.push('full_name = ?'); params.push(full_name); }
        if (national_id) { updates.push('national_id = ?'); params.push(national_id); }
        if (phone) { updates.push('phone = ?'); params.push(phone); }
        if (email) { updates.push('email = ?'); params.push(email); }
        if (house_id !== undefined) { updates.push('house_id = ?'); params.push(house_id); }
        if (status) { updates.push('status = ?'); params.push(status); }

        if (updates.length === 0) return res.status(400).json({ error: 'No fields to update' });

        if (updates.length === 0) return res.status(400).json({ error: 'No fields to update' });

        const updateTransaction = db.transaction(() => {
            // If house_id is changing, handle status updates
            if (house_id !== undefined) {
                const currentTenant = db.prepare('SELECT house_id FROM tenants WHERE id = ?').get(id);
                const oldHouseId = currentTenant ? currentTenant.house_id : null;

                // If staying in same house, do nothing regarding status (unless we want to enforce Occupied)
                if (oldHouseId != house_id) {
                    // Vacate old house
                    if (oldHouseId) {
                        db.prepare("UPDATE houses SET status = 'Vacant' WHERE id = ?").run(oldHouseId);
                    }
                    // Occupy new house
                    if (house_id) {
                        db.prepare("UPDATE houses SET status = 'Occupied' WHERE id = ?").run(house_id);
                    }
                }
            }

            // Execute Tenant Update
            params.push(id);
            const stmt = db.prepare(`UPDATE tenants SET ${updates.join(', ')} WHERE id = ?`);
            const info = stmt.run(...params);

            if (info.changes === 0) throw new Error('Tenant not found');
            return info;
        });

        updateTransaction();

        res.json({ message: 'Tenant updated' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Delete Tenant
router.delete('/:id', (req, res) => {
    try {
        const tenant = db.prepare('SELECT house_id FROM tenants WHERE id = ?').get(req.params.id);
        const stmt = db.prepare('DELETE FROM tenants WHERE id = ?');
        const info = stmt.run(req.params.id);

        if (info.changes === 0) return res.status(404).json({ error: 'Tenant not found' });

        if (tenant && tenant.house_id) {
            db.prepare("UPDATE houses SET status = 'Vacant' WHERE id = ?").run(tenant.house_id);
        }

        res.json({ message: 'Tenant deleted' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
