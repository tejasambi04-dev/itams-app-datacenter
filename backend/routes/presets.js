// ============================================================
// Presets Route — Dropdown options management
// ============================================================

const express = require('express');
const router = express.Router();
const db = require('../db');

// GET /api/presets?category=cpu — get options for a category
router.get('/', async (req, res) => {
  try {
    const { category } = req.query;
    let sql = 'SELECT * FROM dropdown_presets WHERE is_active = 1';
    let params = [];
    if (category) { sql += ' AND category = ?'; params.push(category); }
    sql += ' ORDER BY category, sort_order, value';

    const [rows] = await db.execute(sql, params);

    // Group by category
    const grouped = {};
    rows.forEach(r => {
      if (!grouped[r.category]) grouped[r.category] = [];
      grouped[r.category].push(r.value);
    });

    res.json({ success: true, data: grouped });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/presets — add new preset option
router.post('/', async (req, res) => {
  try {
    const { category, value } = req.body;
    if (!category || !value) {
      return res.status(400).json({ success: false, error: 'category and value required' });
    }
    const [result] = await db.execute(
      'INSERT INTO dropdown_presets (category, value) VALUES (?,?)',
      [category, value]
    );
    res.status(201).json({ success: true, id: result.insertId });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/presets/:id
router.delete('/:id', async (req, res) => {
  try {
    await db.execute('UPDATE dropdown_presets SET is_active = 0 WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
