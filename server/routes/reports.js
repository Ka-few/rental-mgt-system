const express = require('express');
const router = express.Router();
const { db } = require('../db/init');

// Financial Report
router.get('/financial', (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        let dateFilter = "";
        let params = [];

        if (startDate && endDate) {
            dateFilter = "AND date BETWEEN ? AND ?";
            params = [startDate, endDate];
        }

        // Total Revenue
        const revenue = db.prepare(`SELECT SUM(amount) as total FROM transactions WHERE type = 'Payment' ${dateFilter}`).get(...params);

        // Total Expenses (Maintenance)
        // Adjust date filter for maintenance (using completed_date)
        let maintDateFilter = "";
        if (startDate && endDate) {
            maintDateFilter = "AND completed_date BETWEEN ? AND ?";
        }
        const expenses = db.prepare(`SELECT SUM(cost) as total FROM maintenance_requests WHERE status = 'Closed' ${maintDateFilter}`).get(...params);

        res.json({
            totalRevenue: revenue.total || 0,
            totalExpenses: expenses.total || 0,
            netIncome: (revenue.total || 0) - (expenses.total || 0)
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Occupancy Report
router.get('/occupancy', (req, res) => {
    try {
        const properties = db.prepare('SELECT * FROM properties').all();

        const report = properties.map(p => {
            const houses = db.prepare(`
                SELECT h.*, 
                CASE WHEN COUNT(t.id) > 0 THEN 'Occupied' ELSE h.status END as calculated_status 
                FROM houses h 
                LEFT JOIN tenants t ON h.id = t.house_id AND t.status = 'Active' 
                WHERE h.property_id = ? 
                GROUP BY h.id
            `).all(p.id);

            const total = houses.length;
            const occupied = houses.filter(h => h.calculated_status === 'Occupied').length;

            return {
                property_id: p.id,
                name: p.name,
                total_units: total,
                occupied_units: occupied,
                vacant_units: total - occupied,
                occupancy_rate: total > 0 ? Math.round((occupied / total) * 100) : 0
            };
        });

        res.json(report);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Arrears Report
router.get('/arrears', (req, res) => {
    try {
        // Calculate balance for each tenant: Payments - Charges
        // Charges are negative balance, Payments add to it. 
        // Logic: Balance = Sum(Payment) - Sum(Charges) 
        // If Balance < 0, they owe money. 

        const tenants = db.prepare(`
            SELECT 
                t.id, t.full_name, t.phone, t.house_id,
                SUM(CASE WHEN tr.type = 'Payment' THEN tr.amount ELSE -tr.amount END) as balance
            FROM tenants t
            JOIN transactions tr ON t.id = tr.tenant_id
            GROUP BY t.id
            HAVING balance < 0
            ORDER BY balance ASC
        `).all();

        // Enhance with House info
        const result = tenants.map(t => {
            let houseDetails = null;
            if (t.house_id) {
                houseDetails = db.prepare('SELECT h.house_number, p.name as property_name FROM houses h JOIN properties p ON h.property_id = p.id WHERE h.id = ?').get(t.house_id);
            }
            return {
                ...t,
                house: houseDetails ? `${houseDetails.property_name} - ${houseDetails.house_number}` : 'No House',
                arrears: Math.abs(t.balance)
            };
        });

        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
