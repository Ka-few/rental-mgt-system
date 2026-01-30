const express = require('express');
const router = express.Router();
const { db } = require('../db/init');

// Get all MRI records
router.get('/', (req, res) => {
    try {
        const records = db.prepare('SELECT * FROM mri_records ORDER BY created_at DESC').all();
        res.json(records);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// Get transactions breakdown for a month (Validation)
router.post('/transactions', (req, res) => {
    const { month, year } = req.body;
    try {
        const startDate = `${year}-${String(month).padStart(2, '0')}-01 00:00:00`;
        const endDate = new Date(year, month, 0).toISOString().split('T')[0] + ' 23:59:59';

        const transactions = db.prepare(`
            SELECT tr.*, t.full_name, h.house_number, p.name as property_name
            FROM transactions tr
            JOIN tenants t ON tr.tenant_id = t.id
            JOIN houses h ON t.house_id = h.id
            JOIN properties p ON h.property_id = p.id
            WHERE tr.type = 'Payment'
            AND tr.date BETWEEN ? AND ?
            AND p.type = 'Residential'
            AND tr.description NOT LIKE '%Deposit%'
            AND tr.description NOT LIKE '%Water%'
            AND tr.description NOT LIKE '%Garbage%'
            AND tr.description NOT LIKE '%Security%'
            AND tr.description NOT LIKE '%Utility%'
            AND tr.description NOT LIKE '%Penalty%'
            ORDER BY tr.date DESC
        `).all(startDate, endDate);

        res.json(transactions);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Calculate MRI for a month
router.post('/calculate', (req, res) => {
    const { month, year } = req.body; // e.g., month = 1 (Jan), year = 2026
    const monthLabel = new Date(year, month - 1).toLocaleString('default', { month: 'long', year: 'numeric' });

    try {
        // Check if MRI is enabled in settings
        const mriEnabled = db.prepare('SELECT value FROM settings WHERE key = ?').get('mri_enabled')?.value === 'true';
        if (!mriEnabled) {
            return res.status(400).json({ error: 'MRI tracking is disabled in settings.' });
        }

        // Get total rent collected (Payment type) for Residential properties in this month
        // We filter by date range for the month
        const startDate = `${year}-${String(month).padStart(2, '0')}-01 00:00:00`;
        const endDate = new Date(year, month, 0).toISOString().split('T')[0] + ' 23:59:59';

        const totalCollected = db.prepare(`
            SELECT SUM(tr.amount) as total
            FROM transactions tr
            JOIN tenants t ON tr.tenant_id = t.id
            JOIN houses h ON t.house_id = h.id
            JOIN properties p ON h.property_id = p.id
            WHERE tr.type = 'Payment'
            AND tr.date BETWEEN ? AND ?
            AND p.type = 'Residential'
            AND tr.description NOT LIKE '%Deposit%'
            AND tr.description NOT LIKE '%Water%'
            AND tr.description NOT LIKE '%Garbage%'
            AND tr.description NOT LIKE '%Security%'
            AND tr.description NOT LIKE '%Utility%'
            AND tr.description NOT LIKE '%Penalty%'
        `).get(startDate, endDate).total || 0;

        // Check eligibility via annual income estimate in settings (or aggregate properties)
        // User requirements: Allow landlord to configure "Annual rental income estimate"
        // But also check per property? 
        // "Annual rental income estimate (used for eligibility validation)" is a setting or property field?
        // My schema has it in 'properties'. Let's sum it for all residential properties.
        const annualEstimate = db.prepare("SELECT SUM(annual_income_estimate) as total FROM properties WHERE type = 'Residential'").get().total || 0;

        let status = 'Pending';
        let taxPayable = 0;

        if (annualEstimate < 288000 || annualEstimate > 15000000) {
            // MRI not applicable based on annual threshold
            // However, the user says prepared record should reflect calculation if within threshold
            // Actually "The system must block MRI calculations if income is below or above the allowed thresholds"
            return res.status(400).json({
                error: `MRI not applicable. Total annual estimate (${annualEstimate.toLocaleString()} KES) is outside the threshold (288,000 - 15,000,000 KES).`,
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

        // Save record (INSERT OR REPLACE if we want to allow re-calculation for pending months)
        // Check if record for this month already exists
        const existing = db.prepare('SELECT id, status FROM mri_records WHERE month = ?').get(monthLabel);
        if (existing) {
            if (existing.status === 'Filed') {
                return res.status(403).json({ error: 'Record for this month is already filed and locked.' });
            }
            db.prepare(`
                UPDATE mri_records 
                SET gross_rent = ?, tax_payable = ?, net_income = ?, status = ?, reference_date = ?
                WHERE id = ?
            `).run(totalCollected, taxPayable, netIncome, status, referenceDate, existing.id);
        } else {
            db.prepare(`
                INSERT INTO mri_records (month, reference_date, gross_rent, tax_payable, net_income, status)
                VALUES (?, ?, ?, ?, ?, ?)
            `).run(monthLabel, referenceDate, totalCollected, taxPayable, netIncome, status);
        }

        res.json({ success: true, month: monthLabel, reference_date: referenceDate, gross_rent: totalCollected, tax_payable: taxPayable, status });
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
