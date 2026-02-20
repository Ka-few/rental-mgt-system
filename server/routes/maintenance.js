const express = require('express');
const router = express.Router();
const { db, generateUUID } = require('../db/init');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Configure Multer Storage
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const baseUploadDir = process.env.UPLOADS_PATH || path.join(__dirname, '../uploads');
        let subDir = 'maintenance/issues';

        if (file.fieldname === 'receipt') {
            subDir = 'maintenance/receipts';
        }

        const uploadDir = path.join(baseUploadDir, subDir);
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Only image files are allowed!'), false);
        }
    }
});

// Helper to log maintenance actions
const logAction = (maintenanceId, action, performedBy) => {
    db.prepare(`
        INSERT INTO maintenance_logs (id, maintenance_id, action, performed_by)
        VALUES (?, ?, ?, ?)
    `).run(generateUUID(), maintenanceId, action, performedBy);
};

// Get all maintenance requests
router.get('/', (req, res) => {
    try {
        const { property_id, status } = req.query;
        let query = `
            SELECT mr.*, p.name as property_name, h.house_number, u.username as approved_by_name
            FROM maintenance_requests mr
            LEFT JOIN properties p ON mr.property_id = p.id
            LEFT JOIN houses h ON mr.house_id = h.id
            LEFT JOIN users u ON mr.approved_by_user_id = u.id
        `;
        let params = [];
        let conditions = [];

        if (property_id) {
            conditions.push("mr.property_id = ?");
            params.push(property_id);
        }
        if (status) {
            conditions.push("mr.status = ?");
            params.push(status);
        }

        if (conditions.length > 0) {
            query += " WHERE " + conditions.join(" AND ");
        }

        query += " ORDER BY mr.reported_date DESC";

        const requests = db.prepare(query).all(...params);
        res.json(requests);
    } catch (err) {
        console.error('GET MAINTENANCE ERROR:', err);
        res.status(500).json({ error: err.message });
    }
});

// Get a single request details including logs and expenses
router.get('/:id', (req, res) => {
    try {
        const request = db.prepare(`
            SELECT mr.*, p.name as property_name, h.house_number
            FROM maintenance_requests mr
            LEFT JOIN properties p ON mr.property_id = p.id
            LEFT JOIN houses h ON mr.house_id = h.id
            WHERE mr.id = ?
        `).get(req.params.id);

        if (!request) return res.status(404).json({ error: 'Maintenance request not found' });

        const logs = db.prepare(`
            SELECT ml.*, u.username as performed_by_name
            FROM maintenance_logs ml
            JOIN users u ON ml.performed_by = u.id
            WHERE ml.maintenance_id = ?
            ORDER BY ml.timestamp DESC
        `).all(req.params.id);

        const expenses = db.prepare(`
            SELECT * FROM maintenance_expenses WHERE maintenance_id = ? ORDER BY created_at DESC
        `).all(req.params.id);

        res.json({ ...request, logs, expenses });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Create new maintenance request
router.post('/', upload.single('issue_image'), (req, res) => {
    const { house_id, title, description, priority } = req.body;
    const issue_image_path = req.file ? `maintenance/issues/${req.file.filename}` : null;
    const performed_by = req.user.id;

    if (!house_id || !title || !description) {
        return res.status(400).json({ error: 'House, title and description are required' });
    }

    try {
        const insertTransaction = db.transaction(() => {
            // Get property_id from house
            const house = db.prepare('SELECT property_id FROM houses WHERE id = ?').get(house_id);
            if (!house) throw new Error('House not found');

            const maintenanceId = generateUUID();
            const stmt = db.prepare(`
                INSERT INTO maintenance_requests (id, property_id, house_id, title, description, priority, issue_image_path, status)
                VALUES (?, ?, ?, ?, ?, ?, ?, 'Open')
            `);
            stmt.run(maintenanceId, house.property_id, house_id, title, description, priority || 'Normal', issue_image_path);

            logAction(maintenanceId, 'Created Request', performed_by);
            return maintenanceId;
        });

        const id = insertTransaction();
        res.json({ id, message: 'Maintenance request created successfully' });
    } catch (err) {
        console.error('CREATE MAINTENANCE ERROR:', err);
        res.status(500).json({ error: err.message });
    }
});

// Update status (e.g., to In Progress)
router.put('/:id/status', (req, res) => {
    const { status } = req.body;
    const { id } = req.params;
    const performed_by = req.user.id;

    if (!['Open', 'In Progress', 'Rejected'].includes(status)) {
        return res.status(400).json({ error: 'Invalid status update' });
    }

    try {
        db.prepare('UPDATE maintenance_requests SET status = ? WHERE id = ?').run(status, id);
        logAction(id, `Status changed to ${status}`, performed_by);
        res.json({ message: 'Status updated successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Log expense and upload receipt
router.post('/:id/expense', upload.single('receipt'), (req, res) => {
    const { amount, description } = req.body;
    const { id } = req.params;
    const performed_by = req.user.id;
    const receipt_path = req.file ? `maintenance/receipts/${req.file.filename}` : null;

    if (!amount || !req.file) {
        return res.status(400).json({ error: 'Amount and receipt image are required' });
    }

    try {
        const logExpenseTransaction = db.transaction(() => {
            // Insert into maintenance_expenses
            db.prepare(`
                INSERT INTO maintenance_expenses (id, maintenance_id, amount, description, receipt_path)
                VALUES (?, ?, ?, ?, ?)
            `).run(generateUUID(), id, amount, description, receipt_path);

            // Update maintenance_requests status and receipt path
            db.prepare(`
                UPDATE maintenance_requests 
                SET status = 'Pending Approval', receipt_image_path = ?, cost = ? 
                WHERE id = ?
            `).run(receipt_path, amount, id);

            logAction(id, `Expense of ${amount} added. Pending approval.`, performed_by);
        });

        logExpenseTransaction();
        res.json({ message: 'Expense logged. Awaiting owner approval.' });
    } catch (err) {
        console.error('LOG EXPENSE ERROR:', err);
        res.status(500).json({ error: err.message });
    }
});

// Owner Approval
router.post('/:id/approve', (req, res) => {
    const { id } = req.params;
    const approved_by = req.user.id;

    if (req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Only owners can approve maintenance expenses' });
    }

    try {
        const approveTransaction = db.transaction(() => {
            const request = db.prepare('SELECT * FROM maintenance_requests WHERE id = ?').get(id);
            if (!request) throw new Error('Request not found');
            if (request.status !== 'Pending Approval') throw new Error('Request is not pending approval');

            // 1. Update status to Completed
            db.prepare(`
                UPDATE maintenance_requests 
                SET status = 'Completed', approved_by_user_id = ?, approved_at = CURRENT_TIMESTAMP, completed_date = CURRENT_TIMESTAMP
                WHERE id = ?
            `).run(approved_by, id);

            // 2. Integration: Insert into Finance expenses table
            db.prepare(`
                INSERT INTO expenses (id, property_id, category, amount, reference_id, description, date)
                VALUES (?, ?, 'Maintenance', ?, ?, ?, date('now'))
            `).run(generateUUID(), request.property_id, request.cost, id, `Maintenance: ${request.title}`);

            logAction(id, 'Approved and finalized', approved_by);
        });

        approveTransaction();
        res.json({ message: 'Maintenance request approved and finalized' });
    } catch (err) {
        console.error('APPROVE MAINTENANCE ERROR:', err);
        res.status(500).json({ error: err.message });
    }
});

// Owner Rejection
router.post('/:id/reject', (req, res) => {
    const { id } = req.params;
    const { rejection_note } = req.body;
    const performed_by = req.user.id;

    if (req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Only owners can reject maintenance expenses' });
    }

    try {
        db.prepare(`
            UPDATE maintenance_requests 
            SET status = 'In Progress', rejection_note = ? 
            WHERE id = ?
        `).run(rejection_note, id);

        logAction(id, 'Rejected. Status returned to In Progress.', performed_by);
        res.json({ message: 'Request rejected. Returned to caretaker.' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
