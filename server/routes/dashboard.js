const express = require('express');
const router = express.Router();
const { db } = require('../db/init');

router.get('/', (req, res) => {
    try {
        // 1. Total Active Tenants
        const tenants = db.prepare("SELECT count(*) as count FROM tenants WHERE status = 'Active'").get();

        // 2. Total Houses
        const totalHouses = db.prepare("SELECT count(*) as count FROM houses").get();

        // 3. Occupied Units (Count distinct active tenants who have a valid house_id)
        const occupied = db.prepare("SELECT count(DISTINCT house_id) as count FROM tenants WHERE status = 'Active' AND house_id IS NOT NULL").get();

        const occupiedCount = occupied.count;
        const totalHouseCount = totalHouses.count;
        const vacantCount = totalHouseCount - occupiedCount;

        // 4. Total Revenue (Sum of all payments)
        const revenue = db.prepare("SELECT SUM(amount) as total FROM transactions WHERE type = 'Payment'").get();

        // 5. Total Arrears (Sum of negative balances)
        const arrearsData = db.prepare(`
            SELECT SUM(ABS(balance)) as totalArrears FROM (
                SELECT SUM(CASE WHEN type = 'Payment' THEN amount ELSE -amount END) as balance
                FROM transactions
                GROUP BY tenant_id
            ) WHERE balance < 0
        `).get();

        // 6. Total Expenses (Consolidated)
        const genExp = db.prepare("SELECT SUM(amount) as total FROM expenses").get();
        const totalExp = genExp.total || 0;

        // 7. Maintenance Stats
        const openMaintenance = db.prepare("SELECT count(*) as count FROM maintenance_requests WHERE status NOT IN ('Completed', 'Rejected')").get();
        const urgentMaintenance = db.prepare("SELECT count(*) as count FROM maintenance_requests WHERE priority IN ('High', 'Critical') AND status NOT IN ('Completed', 'Rejected')").get();

        const currentMonth = new Date().toISOString().slice(0, 7);
        const maintenanceCost = db.prepare(`SELECT SUM(cost) as total FROM maintenance_requests WHERE status = 'Completed' AND strftime('%Y-%m', completed_date) = ?`).get(currentMonth);

        const avgResolution = db.prepare(`
            SELECT AVG(julianday(completed_date) - julianday(reported_date)) as avgDays 
            FROM maintenance_requests 
            WHERE status = 'Completed' AND completed_date IS NOT NULL
        `).get();

        res.json({
            totalTenants: tenants.count,
            occupiedUnits: occupiedCount,
            vacantUnits: vacantCount,
            totalArrears: arrearsData.totalArrears || 0,
            totalRevenue: revenue.total || 0,
            totalExpenses: totalExp,
            maintenance: {
                openIssues: openMaintenance.count,
                urgentIssues: urgentMaintenance.count,
                monthlyCost: maintenanceCost.total || 0,
                avgResolutionDays: Math.round((avgResolution.avgDays || 0) * 10) / 10
            }
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 6-Month Revenue & Occupancy Charts
router.get('/charts', (req, res) => {
    try {
        const months = [];
        for (let i = 5; i >= 0; i--) {
            const date = new Date();
            date.setMonth(date.getMonth() - i);
            months.push({
                label: date.toLocaleString('default', { month: 'short' }),
                yearMonth: date.toISOString().slice(0, 7) // YYYY-MM
            });
        }

        const chartData = months.map(m => {
            const revenue = db.prepare(`
                SELECT SUM(amount) as total 
                FROM transactions 
                WHERE type = 'Payment' AND strftime('%Y-%m', date) = ?
            `).get(m.yearMonth);

            return {
                month: m.label,
                revenue: revenue.total || 0
            };
        });

        res.json(chartData);
    } catch (err) {
        console.error('DASHBOARD CHARTS ERROR:', err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
