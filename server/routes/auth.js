const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { db, getJwtSecret, generateUUID } = require('../db/init');
const { authenticate, authorizeAdmin } = require('../middleware/auth');

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

        const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, getJwtSecret(), { expiresIn: '24h' });

        res.json({ token, user: { id: user.id, username: user.username, role: user.role } });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

// Get Current User (Verify Token)
router.get('/me', authenticate, (req, res) => {
    res.json({ user: req.user });
});

// Change Password Route
router.post('/change-password', authenticate, (req, res) => {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
        return res.status(400).json({ message: 'Current and new passwords are required' });
    }

    if (newPassword.length < 6) {
        return res.status(400).json({ message: 'New password must be at least 6 characters long' });
    }

    const userId = req.user.id;

    try {
        const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        const validPassword = bcrypt.compareSync(currentPassword, user.password_hash);
        if (!validPassword) {
            return res.status(400).json({ message: `The current password you entered is incorrect.` });
        }

        const newHash = bcrypt.hashSync(newPassword, 10);
        db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(newHash, userId);

        res.json({ message: 'Password successfully updated' });
    } catch (err) {
        console.error('Password change error:', err);
        res.status(500).json({ message: 'Server error during password change' });
    }
});

// --- User Management (Admin Only) ---

// Get all users
router.get('/users', authenticate, authorizeAdmin, (req, res) => {
    try {
        const users = db.prepare('SELECT id, username, role, created_at FROM users').all();
        res.json(users);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Create new user
router.post('/register', authenticate, authorizeAdmin, (req, res) => {
    const { username, password, role } = req.body;
    if (!username || !password) {
        return res.status(400).json({ message: 'Username and password are required' });
    }

    if (password.length < 6) {
        return res.status(400).json({ message: 'Password must be at least 6 characters long' });
    }

    try {
        const hash = bcrypt.hashSync(password, 10);
        const newId = generateUUID();
        const stmt = db.prepare('INSERT INTO users (id, username, password_hash, role) VALUES (?, ?, ?, ?)');
        stmt.run(newId, username, hash, role || 'staff');
        res.json({ message: 'User created successfully', id: newId });
    } catch (err) {
        if (err.message.includes('UNIQUE')) {
            return res.status(400).json({ message: 'Username already exists' });
        }
        res.status(500).json({ message: err.message });
    }
});

// Update user (Admin only)
router.put('/users/:id', authenticate, authorizeAdmin, (req, res) => {
    const targetId = req.params.id;
    const { username, role, currentPassword, newPassword } = req.body;

    try {
        // If updating password
        if (newPassword) {
            // If the admin is updating THEMSELVES, require current password
            if (targetId === req.user.id) {
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

// Delete user
router.delete('/users/:id', authenticate, authorizeAdmin, (req, res) => {
    if (req.params.id === req.user.id) {
        return res.status(400).json({ message: 'You cannot delete your own account' });
    }

    try {
        db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
        res.json({ message: 'User deleted successfully' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;
