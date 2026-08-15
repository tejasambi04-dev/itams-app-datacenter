// ============================================================
// Schedules Route — Service Scheduler
// ============================================================

const express = require('express');
const router = express.Router();
const db = require('../db');

// ── GET /api/schedules ────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const { asset_id, server_id, status, month, year, asset_type } = req.query;
    let where = ['1=1'];
    let params = [];

    if (asset_id)   { where.push('ss.asset_id = ?');   params.push(asset_id); }
    if (server_id)  { where.push('ss.server_id = ?');  params.push(server_id); }
    if (status)     { where.push('ss.status = ?');     params.push(status); }
    if (asset_type) { where.push('ss.asset_type = ?'); params.push(asset_type); }
    if (month && year) {
      where.push('MONTH(ss.scheduled_date) = ? AND YEAR(ss.scheduled_date) = ?');
      params.push(month, year);
    }

    const [rows] = await db.execute(
      `SELECT ss.*, t.name as technician_name 
       FROM service_schedules ss 
       LEFT JOIN technicians t ON ss.technician_id = t.id
       WHERE ${where.join(' AND ')} ORDER BY ss.scheduled_date ASC`,
      params
    );
    res.json({ success: true, count: rows.length, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── GET /api/schedules/:id ────────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const [rows] = await db.execute(
      `SELECT ss.*, t.name as technician_name 
       FROM service_schedules ss LEFT JOIN technicians t ON ss.technician_id = t.id
       WHERE ss.id = ?`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ success: false, error: 'Schedule not found' });
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── POST /api/schedules ───────────────────────────────────────
router.post('/', async (req, res) => {
  try {
    const {
      asset_id, server_id, asset_type, asset_name, scheduled_date,
      service_type, technician_id, next_interval_months, notes
    } = req.body;

    if (!scheduled_date || !service_type) {
      return res.status(400).json({ success: false, error: 'scheduled_date and service_type are required' });
    }

    const [result] = await db.execute(
      `INSERT INTO service_schedules 
       (asset_id, server_id, asset_type, asset_name, scheduled_date, service_type, technician_id, next_interval_months, notes)
       VALUES (?,?,?,?,?,?,?,?,?)`,
      [asset_id || null, server_id || null, asset_type, asset_name, scheduled_date,
       service_type, technician_id || null, next_interval_months || null, notes || null]
    );

    res.status(201).json({ success: true, id: result.insertId, message: 'Schedule created' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── PUT /api/schedules/:id — update / mark complete ──────────
router.put('/:id', async (req, res) => {
  try {
    const {
      scheduled_date, service_type, status, completed_date,
      technician_id, next_interval_months, notes
    } = req.body;

    await db.execute(
      `UPDATE service_schedules 
       SET scheduled_date=?, service_type=?, status=?, completed_date=?,
           technician_id=?, next_interval_months=?, notes=?
       WHERE id=?`,
      [scheduled_date, service_type, status || 'pending', completed_date || null,
       technician_id || null, next_interval_months || null, notes || null, req.params.id]
    );

    // If marking done + interval set, create next schedule
    if (status === 'done' && next_interval_months) {
      const [old] = await db.execute('SELECT * FROM service_schedules WHERE id = ?', [req.params.id]);
      if (old.length) {
        const s = old[0];
        const nextDate = new Date(completed_date || scheduled_date);
        nextDate.setMonth(nextDate.getMonth() + parseInt(next_interval_months));
        const nextDateStr = nextDate.toISOString().split('T')[0];

        await db.execute(
          `INSERT INTO service_schedules (asset_id, server_id, asset_type, asset_name, scheduled_date, service_type, next_interval_months, notes)
           VALUES (?,?,?,?,?,?,?,?)`,
          [s.asset_id, s.server_id, s.asset_type, s.asset_name, nextDateStr, s.service_type, next_interval_months, `Auto-scheduled after completion of #${s.id}`]
        );
      }
    }

    res.json({ success: true, message: 'Schedule updated' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── DELETE /api/schedules/:id ─────────────────────────────────
router.delete('/:id', async (req, res) => {
  try {
    await db.execute('DELETE FROM service_schedules WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Schedule deleted' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
