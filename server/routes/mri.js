const express = require('express');
const router = express.Router();
const { db, generateUUID } = require('../db/init');
const { authorizeAdmin } = require('../middleware/auth');

router.use(authorizeAdmin);

// Get all MRI records (with optional property filter)
router.get('/', (req, res) => {
    const { property_id } = req.query;
    try {
        let query = `
            SELECT m.*, p.name as property_name 
            FROM mri_records m 
            LEFT JOIN properties p ON m.property_id = p.id 
        `;
        const params = [];
        if (property_id) {
            query += ' WHERE m.property_id = ? ';
            params.push(property_id);
        }
        query += ' ORDER BY m.created_at DESC ';

        const records = db.prepare(query).all(...params);
        res.json(records);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// Get transactions breakdown for a month (Validation)
router.post('/transactions', (req, res) => {
    const { month, year, property_id } = req.body;
    try {
        const startDate = `${year}-${String(month).padStart(2, '0')}-01 00:00:00`;
        const lastDay = new Date(year, month, 0).getDate();
        const endDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')} 23:59:59`;

        let query = `
            SELECT tr.*, t.full_name, h.house_number, p.name as property_name
            FROM transactions tr
            JOIN tenants t ON tr.tenant_id = t.id
            JOIN houses h ON t.house_id = h.id
            JOIN properties p ON h.property_id = p.id
            WHERE tr.type = 'Payment'
            AND tr.date BETWEEN ? AND ?
            AND p.type = 'Residential'
        `;
        const params = [startDate, endDate];

        if (property_id) {
            query += ' AND p.id = ? ';
            params.push(property_id);
        }

        query += `
            AND tr.description NOT LIKE '%Deposit%'
            AND tr.description NOT LIKE '%Water%'
            AND tr.description NOT LIKE '%Garbage%'
            AND tr.description NOT LIKE '%Security%'
            AND tr.description NOT LIKE '%Utility%'
            AND tr.description NOT LIKE '%Penalty%'
            ORDER BY tr.date DESC
        `;

        const transactions = db.prepare(query).all(...params);
        res.json(transactions);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Calculate MRI for a month (Property-Specific)
router.post('/calculate', (req, res) => {
    const { month, year, property_id } = req.body; // e.g., month = 1 (Jan), year = 2026
    if (!property_id) {
        return res.status(400).json({ error: 'Property ID is required for independent calculation.' });
    }

    const monthLabel = new Date(year, month - 1).toLocaleString('default', { month: 'long', year: 'numeric' });

    try {
        // Check if MRI is enabled in settings
        const mriEnabled = db.prepare('SELECT value FROM settings WHERE key = ?').get('mri_enabled')?.value === 'true';
        if (!mriEnabled) {
            return res.status(400).json({ error: 'MRI tracking is disabled in settings.' });
        }

        // Get Property Name and Estimate
        const property = db.prepare("SELECT name, annual_income_estimate FROM properties WHERE id = ?").get(property_id);
        if (!property) return res.status(404).json({ error: 'Property not found' });

        // Get total rent collected for THIS property in this month
        const startDate = `${year}-${String(month).padStart(2, '0')}-01 00:00:00`;
        const lastDay = new Date(year, month, 0).getDate();
        const endDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')} 23:59:59`;

        const totalCollected = db.prepare(`
            SELECT SUM(tr.amount) as total
            FROM transactions tr
            JOIN tenants t ON tr.tenant_id = t.id
            JOIN houses h ON t.house_id = h.id
            WHERE tr.type = 'Payment'
            AND tr.date BETWEEN ? AND ?
            AND h.property_id = ?
            AND tr.description NOT LIKE '%Deposit%'
            AND tr.description NOT LIKE '%Water%'
            AND tr.description NOT LIKE '%Garbage%'
            AND tr.description NOT LIKE '%Security%'
            AND tr.description NOT LIKE '%Utility%'
            AND tr.description NOT LIKE '%Penalty%'
        `).get(startDate, endDate, property_id).total || 0;

        const annualEstimate = property.annual_income_estimate || 0;

        let status = 'Pending';
        let taxPayable = 0;

        if (annualEstimate < 288000 || annualEstimate > 15000000) {
            return res.status(400).json({
                error: `MRI not applicable for "${property.name}". Annual estimate (${annualEstimate.toLocaleString()} KES) is outside the threshold (288,000 - 15,000,000 KES).`,
                threshold: annualEstimate < 288000 ? 'Below' : 'Above'
            });
        }

        if (totalCollected === 0) {
            status = 'NIL';
            taxPayable = 0;
        } else {
            taxPayable = totalCollected * 0.075;
        }

        const netIncome = totalCollected - taxPayable;
        const referenceDate = `${year}-${String(month).padStart(2, '0')}-01`;

        // Check if record for this month AND property already exists
        const existing = db.prepare('SELECT id, status FROM mri_records WHERE month = ? AND property_id = ?').get(monthLabel, property_id);
        let recordId;

        if (existing) {
            if (existing.status === 'Filed') {
                return res.status(403).json({ error: 'Record for this month/property is already filed and locked.' });
            }
            db.prepare(`
                UPDATE mri_records 
                SET gross_rent = ?, tax_payable = ?, net_income = ?, status = ?, reference_date = ?
                WHERE id = ?
            `).run(totalCollected, taxPayable, netIncome, status, referenceDate, existing.id);
            recordId = existing.id;
        } else {
            const insertStmt = db.prepare(`
                INSERT INTO mri_records (id, property_id, month, reference_date, gross_rent, tax_payable, net_income, status)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `);
            recordId = generateUUID();
            insertStmt.run(recordId, property_id, monthLabel, referenceDate, totalCollected, taxPayable, netIncome, status);
        }

        res.json({ success: true, id: recordId, property_name: property.name, month: monthLabel, reference_date: referenceDate, gross_rent: totalCollected, tax_payable: taxPayable, status });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// File MRI record (Locks it)
router.post('/file/:id', (req, res) => {
    try {
        const info = db.prepare("UPDATE mri_records SET status = 'Filed' WHERE id = ?").run(req.params.id);
        if (info.changes === 0) return res.status(404).json({ error: 'Record not found' });
        res.json({ success: true, message: 'Record marked as Filed and locked.' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
