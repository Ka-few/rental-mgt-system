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

        // Total Revenue (Payments collected + Deposits)
        const revenue = db.prepare(`SELECT SUM(amount) as total FROM transactions WHERE type IN ('Payment', 'Deposit') ${dateFilter}`).get(...params);

        // Total Penalties Charged ('Adjustment')
        const penalties = db.prepare(`SELECT SUM(amount) as total FROM transactions WHERE type = 'Adjustment' ${dateFilter}`).get(...params);

        // Total MRI Tax
        let mriDateFilter = "";
        let mriParams = [];
        if (startDate && endDate) {
            mriDateFilter = "AND reference_date BETWEEN ? AND ?";
            mriParams = [startDate, endDate];
        }
        const mriTax = db.prepare(`SELECT SUM(tax_payable) as total FROM mri_records WHERE status != 'NIL' ${mriDateFilter}`).get(...mriParams);

        // Total Expenses (Maintenance)
        let maintDateFilter = "";
        let maintParams = [];
        if (startDate && endDate) {
            maintDateFilter = "AND completed_date BETWEEN ? AND ?";
            maintParams = [startDate, endDate];
        }
        const expenses = db.prepare(`SELECT SUM(cost) as total FROM maintenance_requests WHERE status = 'Closed' ${maintDateFilter}`).get(...maintParams);

        const totalRevenue = revenue.total || 0;
        const totalExpenses = expenses.total || 0;
        const totalTax = mriTax.total || 0;
        const totalPenalties = penalties.total || 0;

        res.json({
            totalRevenue: totalRevenue,
            totalExpenses: totalExpenses,
            mriTax: totalTax,
            totalPenalties: totalPenalties,
            netIncome: totalRevenue - totalExpenses - totalTax
        });
    } catch (err) {
        console.error('FINANCIAL REPORT ERROR:', err);
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
        console.error('OCCUPANCY REPORT ERROR:', err);
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
                SUM(CASE WHEN tr.type = 'Payment' THEN tr.amount ELSE -tr.amount END) as balance,
                COALESCE(SUM(CASE WHEN tr.type = 'Adjustment' THEN tr.amount ELSE 0 END), 0) as total_penalties
            FROM tenants t
            LEFT JOIN transactions tr ON t.id = tr.tenant_id
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
        console.error('ARREARS REPORT ERROR:', err);
        res.status(500).json({ error: err.message });
    }
});

// Detailed Transactions Report (for Export)
router.get('/transactions', (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        let query = `
            SELECT 
                tr.date, 
                tr.type, 
                tr.amount, 
                tr.description, 
                tr.payment_method, 
                tr.reference_code,
                t.full_name as tenant_name,
                h.house_number,
                p.name as property_name
            FROM transactions tr
            JOIN tenants t ON tr.tenant_id = t.id
            LEFT JOIN houses h ON t.house_id = h.id
            LEFT JOIN properties p ON h.property_id = p.id
            WHERE 1=1
        `;
        let params = [];

        if (startDate && endDate) {
            query += " AND tr.date BETWEEN ? AND ?";
            params = [startDate, endDate];
        }

        query += " ORDER BY tr.date DESC";

        const transactions = db.prepare(query).all(...params);
        res.json(transactions);
    } catch (err) {
        console.error('DETAILED TRANSACTIONS ERROR:', err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
