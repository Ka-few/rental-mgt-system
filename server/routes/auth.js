const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { db } = require('../db/init');

const SECRET_KEY = process.env.JWT_SECRET || 'dev-only-secret-key-123-change-this';
if (!process.env.JWT_SECRET) {
    console.warn('WARNING: JWT_SECRET environment variable is not defined! Falling back to development key.');
    if (process.env.NODE_ENV === 'production') {
        console.error('FATAL: Running in production without JWT_SECRET!');
        process.exit(1);
    }
}

// Login Route
router.post('/login', (req, res) => {
    const { username, password } = req.body;

    try {
        const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);

        if (!user) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        const validPassword = bcrypt.compareSync(password, user.password_hash);
        if (!validPassword) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, SECRET_KEY, { expiresIn: '24h' });

        res.json({ token, user: { id: user.id, username: user.username, role: user.role } });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

// Get Current User (Verify Token)
router.get('/me', (req, res) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.status(401).json({ message: 'No token provided' });

    jwt.verify(token, SECRET_KEY, (err, user) => {
        if (err) return res.status(403).json({ message: 'Invalid token' });
        res.json({ user });
    });
});

// Change Password Route
router.post('/change-password', (req, res) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.status(401).json({ message: 'Unauthorized' });

    jwt.verify(token, SECRET_KEY, (err, decoded) => {
        if (err) {
            console.error('JWT Verification failed:', err.message);
            return res.status(403).json({ message: 'Invalid token' });
        }

        const { currentPassword, newPassword } = req.body;

        if (!currentPassword || !newPassword) {
            return res.status(400).json({ message: 'Current and new passwords are required' });
        }

        const userId = decoded.id;

        console.log('Password change attempt for user ID:', userId);

        try {
            const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
            if (!user) {
                console.error('User not found ID:', userId);
                return res.status(404).json({ message: 'User not found' });
            }

            const validPassword = bcrypt.compareSync(currentPassword, user.password_hash);
            if (!validPassword) {
                console.error('Password mismatch for user:', user.username);
                return res.status(400).json({ message: `The current password you entered is incorrect. (User: ${user.username})` });
            }

            const newHash = bcrypt.hashSync(newPassword, 10);
            const result = db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(newHash, userId);

            if (result.changes === 0) {
                console.error('PASSWORD UPDATE FAILED: No rows changed for user ID:', userId);
                return res.status(500).json({ message: 'Password update failed - user record not updated' });
            }

            console.log('Password successfully changed for:', user.username);
            res.json({ message: 'Password successfully updated' });
        } catch (err) {
            console.error('SERVER ERROR during password change:', err);
            res.status(500).json({ message: `Server database error during update: ${err.message}` });
        }
    });
});

// --- User Management (Admin Only) ---

// Get all users
router.get('/users', (req, res) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.status(401).json({ message: 'Unauthorized' });

    jwt.verify(token, SECRET_KEY, (err, decoded) => {
        if (err || decoded.role !== 'admin') {
            return res.status(403).json({ message: 'Admin access required' });
        }

        try {
            const users = db.prepare('SELECT id, username, role, created_at FROM users').all();
            res.json(users);
        } catch (err) {
            res.status(500).json({ message: err.message });
        }
    });
});

// Create new user
router.post('/register', (req, res) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.status(401).json({ message: 'Unauthorized' });

    jwt.verify(token, SECRET_KEY, (err, decoded) => {
        if (err || decoded.role !== 'admin') {
            return res.status(403).json({ message: 'Admin access required' });
        }

        const { username, password, role } = req.body;
        if (!username || !password) {
            return res.status(400).json({ message: 'Username and password are required' });
        }

        try {
            const hash = bcrypt.hashSync(password, 10);
            db.prepare('INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)').run(username, hash, role || 'staff');
            res.json({ message: 'User created successfully' });
        } catch (err) {
            if (err.message.includes('UNIQUE')) {
                return res.status(400).json({ message: 'Username already exists' });
            }
            res.status(500).json({ message: err.message });
        }
    });
});

// Update user (Admin only)
router.put('/users/:id', (req, res) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.status(401).json({ message: 'Unauthorized' });

    jwt.verify(token, SECRET_KEY, (err, decoded) => {
        if (err || decoded.role !== 'admin') {
            return res.status(403).json({ message: 'Admin access required' });
        }

        const targetId = parseInt(req.params.id);
        const { username, role, currentPassword, newPassword } = req.body;

        try {
            // If updating password
            if (newPassword) {
                // If the admin is updating THEMSELVES, require current password
                if (targetId === decoded.id) {
                    const self = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(targetId);
                    if (!currentPassword || !bcrypt.compareSync(currentPassword, self.password_hash)) {
                        return res.status(400).json({ message: 'Incorrect current password' });
                    }
                }
                const newHash = bcrypt.hashSync(newPassword, 10);
                db.prepare('UPDATE users SET username = ?, role = ?, password_hash = ? WHERE id = ?').run(username, role, newHash, targetId);
            } else {
                db.prepare('UPDATE users SET username = ?, role = ? WHERE id = ?').run(username, role, targetId);
            }

            res.json({ message: 'User updated successfully' });
        } catch (err) {
            if (err.message.includes('UNIQUE')) {
                return res.status(400).json({ message: 'Username already exists' });
            }
            res.status(500).json({ message: err.message });
        }
    });
});

// Delete user
router.delete('/users/:id', (req, res) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.status(401).json({ message: 'Unauthorized' });

    jwt.verify(token, SECRET_KEY, (err, decoded) => {
        if (err || decoded.role !== 'admin') {
            return res.status(403).json({ message: 'Admin access required' });
        }

        if (parseInt(req.params.id) === decoded.id) {
            return res.status(400).json({ message: 'You cannot delete your own account' });
        }

        try {
            db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
            res.json({ message: 'User deleted successfully' });
        } catch (err) {
            res.status(500).json({ message: err.message });
        }
    });
});

module.exports = router;
