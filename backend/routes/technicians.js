// ============================================================
// Technicians Route
// ============================================================

const express = require('express');
const router = express.Router();
const db = require('../db');

router.get('/', async (req, res) => {
  try {
    const [rows] = await db.execute(
      'SELECT id, name, email, department FROM technicians WHERE is_active = 1 ORDER BY name'
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { name, email, department } = req.body;
    if (!name) return res.status(400).json({ success: false, error: 'Name is required' });
    const [result] = await db.execute(
      'INSERT INTO technicians (name, email, department) VALUES (?,?,?)',
      [name, email || null, department || null]
    );
    res.status(201).json({ success: true, id: result.insertId });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { name, email, department, is_active } = req.body;
    await db.execute(
      'UPDATE technicians SET name=?, email=?, department=?, is_active=? WHERE id=?',
      [name, email, department, is_active ?? 1, req.params.id]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
