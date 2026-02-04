const express = require('express');
const router = express.Router();
const { db } = require('../db/init');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Configure Multer Storage
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const baseUploadDir = process.env.UPLOADS_PATH || path.join(__dirname, '../uploads');
        const uploadDir = path.join(baseUploadDir, 'agreements');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'agreement-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
    fileFilter: (req, file, cb) => {
        if (file.mimetype === 'application/pdf' || file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Only PDF or Image files are allowed!'), false);
        }
    }
});

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
        console.error('GET TENANTS ERROR:', err);
        res.status(500).json({ error: err.message });
    }
});

// Register Tenant
router.post('/', upload.single('agreement'), (req, res) => {
    // Note: When using multer, req.body fields are text-only. 
    // We expect: full_name, national_id, phone, email, house_id, move_in_date
    // Plus: initial_deposit, first_month_rent

    //console.log("Req Body:", req.body);
    //console.log("Req File:", req.file);

    let { full_name, national_id, phone, email, house_id, move_in_date, initial_deposit, first_month_rent } = req.body;
    const agreementPath = req.file ? req.file.filename : null;

    // Sanitize house_id (forms often send empty strings or 'null' as strings)
    if (house_id === '' || house_id === 'null' || house_id === 'undefined') {
        house_id = null;
    }

    console.log(`Registering tenant: ${full_name} (${national_id}), House: ${house_id}`);

    if (!national_id || national_id.length !== 8) {
        return res.status(400).json({ error: 'National ID must be 8 digits' });
    }

    const insert = db.transaction(() => {
        // 1. Insert Tenant
        const stmt = db.prepare(`
      INSERT INTO tenants (full_name, national_id, phone, email, house_id, move_in_date, agreement_path, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'Active')
    `);
        const info = stmt.run(full_name, national_id, phone, email, house_id, move_in_date || new Date().toISOString(), agreementPath);
        const tenantId = info.lastInsertRowid;

        // 2. Update House Status to Occupied
        if (house_id) {
            db.prepare("UPDATE houses SET status = 'Occupied' WHERE id = ?").run(house_id);
        }

        // 3. Record Initial Deposit (if any)
        if (initial_deposit && Number(initial_deposit) > 0) {
            db.prepare(`
                INSERT INTO transactions (tenant_id, type, amount, description, payment_method)
                VALUES (?, 'Deposit', ?, 'Initial Rental Deposit', 'Cash/Transfer')
            `).run(tenantId, Number(initial_deposit));
        }

        // 4. Record First Month Rent (if any)
        if (first_month_rent && Number(first_month_rent) > 0) {
            // This uses 'Payment' type which IS subject to MRI (Revenue)
            // Or 'Rent Charge' if it's just the charge? User said "upload ... + monthly rent", implying payment.
            // If we record it as 'Payment', we assume it's paid.
            db.prepare(`
                INSERT INTO transactions (tenant_id, type, amount, description, payment_method)
                VALUES (?, 'Payment', ?, 'First Month Rent Payment', 'Cash/Transfer')
            `).run(tenantId, Number(first_month_rent));
        }

        return tenantId;
    });

    try {
        const tenantId = insert();
        res.json({ id: tenantId, ...req.body, agreement_path: agreementPath });
    } catch (err) {
        console.error('REGISTER TENANT ERROR:', err);
        if (req.file) {
            // Cleanup uploaded file on error
            fs.unlink(path.join(req.file.destination, req.file.filename), (e) => { if (e) console.error(e) });
        }
        res.status(500).json({ error: err.message });
    }
});

// Update Tenant
router.put('/:id', upload.single('agreement'), (req, res) => {
    // For now we don't support updating agreement via edit, or simple text updates only
    // If we want to support editing file, we need similar multer logic here

    // Because multer is used, req.body is parsed.

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
        if (req.file) { updates.push('agreement_path = ?'); params.push(req.file.filename); }

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
        console.error('UPDATE TENANT ERROR:', err);
        res.status(500).json({ error: err.message });
    }
});

// Delete Tenant
router.delete('/:id', (req, res) => {
    const { id } = req.params;
    console.log(`DELETE REQUEST: Attempting to delete tenant with ID: ${id}`);
    try {
        const tenant = db.prepare('SELECT id, full_name, house_id FROM tenants WHERE id = ?').get(id);

        if (!tenant) {
            console.error(`DELETE ERROR: Tenant with ID ${id} not found in database.`);
            return res.status(404).json({ error: 'Tenant not found' });
        }

        console.log(`DELETE: Found tenant ${tenant.full_name}. Proceeding with deletion...`);
        const stmt = db.prepare('DELETE FROM tenants WHERE id = ?');
        const info = stmt.run(id);

        if (info.changes === 0) {
            console.error(`DELETE ERROR: No changes made when deleting ID ${id}`);
            return res.status(404).json({ error: 'Tenant not found' });
        }

        if (tenant && tenant.house_id) {
            db.prepare("UPDATE houses SET status = 'Vacant' WHERE id = ?").run(tenant.house_id);
        }

        res.json({ message: 'Tenant deleted' });
    } catch (err) {
        console.error('DELETE TENANT ERROR:', err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
