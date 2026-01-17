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

        res.json({
            totalTenants: tenants.count,
            occupiedUnits: occupiedCount,
            vacantUnits: vacantCount,
            totalArrears: arrearsData.totalArrears || 0,
            totalRevenue: revenue.total || 0
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
