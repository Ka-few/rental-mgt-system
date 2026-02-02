const express = require('express');
const router = express.Router();
const { db } = require('../db/init');
const path = require('path');
const fs = require('fs');

// Get all help articles (short version for list)
router.get('/', (req, res) => {
    try {
        const articles = db.prepare('SELECT id, category, title, slug FROM help_articles ORDER BY category, title').all();
        res.json(articles);
    } catch (err) {
        console.error('HELP FETCH ERROR:', err);
        res.status(500).json({ error: err.message });
    }
});

// Search help articles
router.get('/search', (req, res) => {
    const { q } = req.query;
    try {
        const results = db.prepare(`
            SELECT id, category, title, slug 
            FROM help_articles 
            WHERE title LIKE ? OR content LIKE ?
            ORDER BY category, title
        `).all(`%${q}%`, `%${q}%`);
        res.json(results);
    } catch (err) {
        console.error('HELP SEARCH ERROR:', err);
        res.status(500).json({ error: err.message });
    }
});

// Get specific article with steps
router.get('/article/:slug', (req, res) => {
    try {
        const article = db.prepare('SELECT * FROM help_articles WHERE slug = ?').get(req.params.slug);
        if (!article) return res.status(404).json({ error: 'Article not found' });

        const steps = db.prepare('SELECT * FROM help_steps WHERE article_id = ? ORDER BY step_number ASC').all(article.id);
        res.json({ ...article, steps });
    } catch (err) {
        console.error('HELP ARTICLE ERROR:', err);
        res.status(500).json({ error: err.message });
    }
});

// Get user progress
router.get('/progress/:userId', (req, res) => {
    try {
        const progress = db.prepare('SELECT * FROM user_help_progress WHERE user_id = ?').all(req.params.userId);
        res.json(progress);
    } catch (err) {
        console.error('HELP PROGRESS ERROR:', err);
        res.status(500).json({ error: err.message });
    }
});

// Update progress
router.post('/progress', (req, res) => {
    const { user_id, type, target_id, completed } = req.body;
    try {
        const existing = db.prepare('SELECT id FROM user_help_progress WHERE user_id = ? AND type = ? AND target_id = ?').get(user_id, type, target_id);

        if (existing) {
            db.prepare(`
                UPDATE user_help_progress 
                SET completed = ?, completed_at = ?
                WHERE id = ?
            `).run(completed ? 1 : 0, completed ? new Date().toISOString() : null, existing.id);
        } else {
            db.prepare(`
                INSERT INTO user_help_progress (user_id, type, target_id, completed, completed_at)
                VALUES (?, ?, ?, ?, ?)
            `).run(user_id, type, target_id, completed ? 1 : 0, completed ? new Date().toISOString() : null);
        }
        res.json({ success: true });
    } catch (err) {
        console.error('HELP PROGRESS UPDATE ERROR:', err);
        res.status(500).json({ error: err.message });
    }
});

// Get available guided walkthroughs (articles with steps)
router.get('/tours', (req, res) => {
    try {
        const tours = db.prepare(`
            SELECT DISTINCT a.id, a.category, a.title, a.slug 
            FROM help_articles a
            JOIN help_steps s ON a.id = s.article_id
            ORDER BY a.category, a.title
        `).all();
        res.json(tours);
    } catch (err) {
        console.error('HELP TOURS ERROR:', err);
        res.status(500).json({ error: err.message });
    }
});

const { exec } = require('child_process');

// Open Uploads Folder in Explorer
router.post('/open-uploads', (req, res) => {
    const uploadsPath = process.env.UPLOADS_PATH || path.join(__dirname, '../uploads');
    const folderPath = path.join(uploadsPath, 'agreements');

    if (!fs.existsSync(folderPath)) {
        fs.mkdirSync(folderPath, { recursive: true });
    }

    let command = '';
    switch (process.platform) {
        case 'win32': command = `start "" "${folderPath}"`; break;
        case 'darwin': command = `open "${folderPath}"`; break;
        default: command = `xdg-open "${folderPath}"`; break;
    }

    exec(command, (error) => {
        if (error) {
            console.error('OPEN FOLDER ERROR:', error);
            return res.status(500).json({ error: 'Could not open folder: ' + error.message });
        }
        res.json({ success: true, path: folderPath });
    });
});

module.exports = router;
