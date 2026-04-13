/**
 * server/routes/ai.js
 * Mounts AI chat endpoint at /api/ai/chat
 */

const express = require('express');
const router = express.Router();
const { chatHandler } = require('../controllers/ai');

// POST /api/ai/chat – main AI chat endpoint
router.post('/chat', chatHandler);

module.exports = router;
