// ============================================================
// Notifications Route
// ============================================================

const express = require('express');
const router = express.Router();
const db = require('../db');

// GET /api/notifications — get unread notifications
router.get('/', async (req, res) => {
  try {
    const [rows] = await db.execute(
      `SELECT * FROM notifications WHERE is_read = 0 ORDER BY created_at DESC LIMIT 50`
    );
    res.json({ success: true, count: rows.length, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/notifications/all — all notifications
router.get('/all', async (req, res) => {
  try {
    const [rows] = await db.execute(
      `SELECT * FROM notifications ORDER BY created_at DESC LIMIT 100`
    );
    res.json({ success: true, count: rows.length, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/notifications/:id/read — mark single as read
router.put('/:id/read', async (req, res) => {
  try {
    await db.execute('UPDATE notifications SET is_read = 1 WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/notifications/read-all — mark all as read
router.put('/read-all', async (req, res) => {
  try {
    await db.execute('UPDATE notifications SET is_read = 1 WHERE is_read = 0');
    res.json({ success: true, message: 'All notifications marked as read' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
