const express = require('express');
const router = express.Router();
const { db } = require('../db/init');
const { authorizeAdmin } = require('../middleware/auth');

router.use(authorizeAdmin);

// Financial Report
router.get('/financial', (req, res) => {
    try {
        const { startDate, endDate, property_id } = req.query;
        let dateFilter = "";
        let params = [];

        if (startDate && endDate) {
            dateFilter = "AND tr.date BETWEEN ? AND ?";
            params = [startDate, endDate];
        }

        let propertyFilter = "";
        if (property_id) {
            propertyFilter = "AND h.property_id = ?";
            params.push(property_id);
        }

        // Total Revenue (Payments collected + Deposits)
        const revenue = db.prepare(`
            SELECT SUM(tr.amount) as total 
            FROM transactions tr 
            JOIN tenants t ON tr.tenant_id = t.id
            JOIN houses h ON t.house_id = h.id
            WHERE tr.type IN ('Payment', 'Deposit') ${dateFilter} ${propertyFilter}
        `).get(...params);

        // Total Penalties Charged ('Adjustment')
        const penalties = db.prepare(`
            SELECT SUM(tr.amount) as total 
            FROM transactions tr 
            JOIN tenants t ON tr.tenant_id = t.id
            JOIN houses h ON t.house_id = h.id
            WHERE tr.type = 'Adjustment' ${dateFilter} ${propertyFilter}
        `).get(...params);

        // Total MRI Tax
        let mriFilter = "";
        let mriParams = [];
        if (startDate && endDate) {
            mriFilter += " AND reference_date BETWEEN ? AND ? ";
            mriParams.push(startDate, endDate);
        }
        if (property_id) {
            mriFilter += " AND property_id = ? ";
            mriParams.push(property_id);
        }
        const mriTax = db.prepare(`SELECT SUM(tax_payable) as total FROM mri_records WHERE status != 'NIL' ${mriFilter}`).get(...mriParams);

        // Total Expenses (Consolidated Expenses)
        let genFilter = "";
        let genParams = [];

        if (startDate && endDate) {
            genFilter += " AND date BETWEEN ? AND ? ";
            genParams.push(startDate, endDate);
        }
        if (property_id) {
            genFilter += " AND property_id = ? ";
            genParams.push(property_id);
        }

        const generalExpenses = db.prepare(`SELECT SUM(amount) as total FROM expenses WHERE 1=1 ${genFilter}`).get(...genParams);

        const totalRevenue = revenue.total || 0;
        const totalExpenses = generalExpenses.total || 0;
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

// Occupancy Report (Unchanged, already iterates properties)
router.get('/occupancy', (req, res) => {
    try {
        const { property_id } = req.query;
        let query = 'SELECT * FROM properties';
        let params = [];
        if (property_id) {
            query += ' WHERE id = ?';
            params.push(property_id);
        }
        const properties = db.prepare(query).all(...params);

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
        const { property_id } = req.query;
        let query = `
            SELECT 
                t.id, t.full_name, t.phone, t.house_id,
                SUM(CASE WHEN tr.type = 'Payment' THEN tr.amount ELSE -tr.amount END) as balance,
                COALESCE(SUM(CASE WHEN tr.type = 'Adjustment' THEN tr.amount ELSE 0 END), 0) as total_penalties
            FROM tenants t
            JOIN houses h ON t.house_id = h.id
            LEFT JOIN transactions tr ON t.id = tr.tenant_id
            WHERE 1=1
        `;
        const params = [];

        if (property_id) {
            query += " AND h.property_id = ? ";
            params.push(property_id);
        }

        query += `
            GROUP BY t.id
            HAVING balance < 0
            ORDER BY balance ASC
        `;

        const tenants = db.prepare(query).all(...params);

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

// Detailed Transactions Report (for Export & Paginated View)
router.get('/transactions', (req, res) => {
    try {
        const { startDate, endDate, property_id, page = 1, limit = 20 } = req.query;
        const offset = (page - 1) * limit;

        let queryBase = `
            FROM transactions tr
            JOIN tenants t ON tr.tenant_id = t.id
            LEFT JOIN houses h ON t.house_id = h.id
            LEFT JOIN properties p ON h.property_id = p.id
            WHERE 1=1
        `;
        let params = [];

        if (startDate && endDate) {
            queryBase += " AND tr.date BETWEEN ? AND ? ";
            params.push(startDate, endDate);
        }

        if (property_id && property_id !== 'all') {
            queryBase += " AND p.id = ? ";
            params.push(property_id);
        }

        // Get total count for pagination
        const countResult = db.prepare(`SELECT COUNT(*) as total ${queryBase}`).get(...params);
        const total = countResult.total || 0;

        // Get paginated data
        const transactions = db.prepare(`
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
            ${queryBase}
            ORDER BY tr.date DESC, tr.created_at DESC
            LIMIT ? OFFSET ?
        `).all(...params, Number(limit), Number(offset));

        res.json({
            data: transactions,
            pagination: {
                total,
                page: Number(page),
                limit: Number(limit),
                pages: Math.ceil(total / limit)
            }
        });
    } catch (err) {
        console.error('DETAILED TRANSACTIONS ERROR:', err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
