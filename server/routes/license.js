const express = require('express');
const router = express.Router();
const { db } = require('../db/init');

// Hardcoded valid product key for demonstration purposes
// In a real system, this would be cryptographically verified
const VALID_PRODUCT_KEY = 'RENTAL-2026-KEY-X9Z1';

/**
 * GET /api/license/status
 * Returns the current license status: TRIAL, ACTIVE, or EXPIRED.
 * Includes days remaining if in trial.
 */
router.get('/status', (req, res) => {
    try {
        const installDateSetting = db.prepare("SELECT value FROM settings WHERE key = 'installation_date'").get();
        const licenseKeySetting = db.prepare("SELECT value FROM settings WHERE key = 'license_key'").get();

        const installDate = new Date(installDateSetting ? installDateSetting.value : new Date().toISOString());
        const licenseKey = licenseKeySetting ? licenseKeySetting.value : '';

        // Check if fully activated
        if (licenseKey === VALID_PRODUCT_KEY) {
            return res.json({
                status: 'ACTIVE',
                message: 'Product is fully activated.',
                daysRemaining: null
            });
        }

        // Calculate trial status
        const now = new Date();
        const diffTime = Math.abs(now - installDate);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        const trialLength = 7;
        const daysRemaining = trialLength - diffDays;

        if (daysRemaining < 0) {
            return res.json({
                status: 'EXPIRED',
                message: 'Trial period has expired. Please activate your product.',
                daysRemaining: 0
            });
        }

        return res.json({
            status: 'TRIAL',
            message: `Trial version. ${daysRemaining} days remaining.`,
            daysRemaining: daysRemaining
        });

    } catch (err) {
        console.error('License Status Error:', err);
        res.status(500).json({ error: 'Failed to check license status' });
    }
});

/**
 * POST /api/license/activate
 * Validates the product key and activates the system.
 */
router.post('/activate', (req, res) => {
    const { productKey } = req.body;

    if (!productKey) {
        return res.status(400).json({ error: 'Product key is required' });
    }

    if (productKey === VALID_PRODUCT_KEY) {
        try {
            db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('license_key', ?)").run(productKey);
            return res.json({ success: true, message: 'Product activated successfully!' });
        } catch (err) {
            console.error('Activation Error:', err);
            return res.status(500).json({ error: 'Failed to save activation' });
        }
    } else {
        return res.status(401).json({ error: 'Invalid product key' });
    }
});

module.exports = router;
