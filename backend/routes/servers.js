// ============================================================
// Servers Route — Linux & Windows Server CRUD
// ============================================================

const express = require('express');
const router = express.Router();
const db = require('../db');

// Helper: generate server ID
async function generateServerId() {
  const now = new Date();
  const dateStr = now.toISOString().replace(/[-T:]/g, '').slice(0, 8);
  const timeStr = now.toISOString().replace(/[-T:]/g, '').slice(8, 14);
  const [rows] = await db.execute(
    `SELECT COUNT(*) as cnt FROM servers WHERE DATE(created_at) = CURDATE()`
  );
  const seq = String((rows[0].cnt || 0) + 1).padStart(3, '0');
  return `SV-${dateStr}-${timeStr}-${seq}`;
}

// ── GET /api/servers ──────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const { q, os_type, status, department } = req.query;
    let where = ['1=1'];
    let params = [];

    if (q) {
      where.push(`(s.server_name LIKE ? OR s.ip_address LIKE ? OR s.location LIKE ? 
                   OR s.department LIKE ? OR s.id LIKE ? OR s.service_tag LIKE ? OR s.roles_services LIKE ?)`);
      const like = `%${q}%`;
      params.push(like, like, like, like, like, like, like);
    }
    if (os_type)    { where.push('s.os_type = ?'); params.push(os_type); }
    if (status)     { where.push('s.status = ?'); params.push(status); }
    if (department) { where.push('s.department = ?'); params.push(department); }

    const [rows] = await db.execute(
      `SELECT s.*, t.name as technician_name 
       FROM servers s LEFT JOIN technicians t ON s.technician_id = t.id
       WHERE ${where.join(' AND ')} ORDER BY s.created_at DESC`,
      params
    );
    res.json({ success: true, count: rows.length, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── GET /api/servers/:id ──────────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const [rows] = await db.execute(
      `SELECT s.*, t.name as technician_name 
       FROM servers s LEFT JOIN technicians t ON s.technician_id = t.id 
       WHERE s.id = ?`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ success: false, error: 'Server not found' });

    const server = rows[0];

    // Fetch software audits
    const [audits] = await db.execute(
      `SELECT sa.*, t.name as tech_name FROM software_audits sa
       LEFT JOIN technicians t ON sa.technician_id = t.id
       WHERE sa.server_id = ? ORDER BY sa.audit_date DESC`,
      [req.params.id]
    );
    server.software_audits = audits;

    // Fetch schedules
    const [schedules] = await db.execute(
      `SELECT * FROM service_schedules WHERE server_id = ? ORDER BY scheduled_date DESC`,
      [req.params.id]
    );
    server.schedules = schedules;

    res.json({ success: true, data: server });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── POST /api/servers ─────────────────────────────────────────
router.post('/', async (req, res) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const {
      server_name, os_type, os_version, make, model, service_tag, location, department,
      ip_address, mac_address, cpu, ram, storage, raid_config, roles_services,
      remote_access, last_patch_date, last_os_upgrade, technician_id, notes,
      next_service_date, service_interval_months, status, purchase_date, warranty_expiry
    } = req.body;

    // ✅ Null-sanitizer: converts undefined and empty strings to SQL NULL
    const n = (v) => (v === undefined || v === null || v === '') ? null : v;

    const id = await generateServerId();

    await conn.execute(
      `INSERT INTO servers (id, server_name, os_type, os_version, make, model, service_tag,
         location, department, ip_address, mac_address, cpu, ram, storage, raid_config,
         roles_services, remote_access, last_patch_date, last_os_upgrade, technician_id,
         notes, next_service_date, service_interval_months, status, purchase_date, warranty_expiry)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        id, n(server_name), n(os_type), n(os_version), n(make), n(model), n(service_tag),
        n(location), n(department), n(ip_address), n(mac_address), n(cpu), n(ram),
        n(storage), n(raid_config), n(roles_services), n(remote_access),
        n(last_patch_date), n(last_os_upgrade), n(technician_id), n(notes),
        n(next_service_date), n(service_interval_months) || 1, n(status) || 'online',
        n(purchase_date), n(warranty_expiry)
      ]
    );

    if (n(next_service_date)) {
      await conn.execute(
        `INSERT INTO service_schedules (server_id, asset_type, asset_name, scheduled_date, service_type, next_interval_months)
         VALUES (?,?,?,?,'Full Server Audit',?)`,
        [id, 'server', n(server_name) || id, next_service_date, n(service_interval_months) || 1]
      );
    }

    await conn.execute(
      `INSERT INTO audit_log (table_name, record_id, action, technician_id, new_values)
       VALUES ('servers', ?, 'INSERT', ?, ?)`,
      [id, n(technician_id), JSON.stringify(req.body)]
    );

    await conn.commit();
    res.status(201).json({ success: true, id, message: 'Server created successfully' });
  } catch (err) {
    await conn.rollback();
    res.status(500).json({ success: false, error: err.message });
  } finally {
    conn.release();
  }
});

// ── PUT /api/servers/:id ──────────────────────────────────────
router.put('/:id', async (req, res) => {
  try {
    const [old] = await db.execute('SELECT * FROM servers WHERE id = ?', [req.params.id]);
    if (!old.length) return res.status(404).json({ success: false, error: 'Server not found' });

    const {
      server_name, os_type, os_version, make, model, service_tag, location, department,
      ip_address, mac_address, cpu, ram, storage, raid_config, roles_services,
      remote_access, last_patch_date, last_os_upgrade, technician_id, notes,
      next_service_date, service_interval_months, status, purchase_date, warranty_expiry
    } = req.body;

    await db.execute(
      `UPDATE servers SET server_name=?, os_type=?, os_version=?, make=?, model=?, service_tag=?,
         location=?, department=?, ip_address=?, mac_address=?, cpu=?, ram=?, storage=?, raid_config=?,
         roles_services=?, remote_access=?, last_patch_date=?, last_os_upgrade=?, technician_id=?,
         notes=?, next_service_date=?, service_interval_months=?, status=?, purchase_date=?, warranty_expiry=?
       WHERE id=?`,
      [server_name, os_type, os_version, make, model, service_tag, location, department,
       ip_address, mac_address, cpu, ram, storage, raid_config, roles_services, remote_access,
       last_patch_date || null, last_os_upgrade || null, technician_id || null, notes,
       next_service_date || null, service_interval_months, status, purchase_date || null, warranty_expiry || null,
       req.params.id]
    );

    await db.execute(
      `INSERT INTO audit_log (table_name, record_id, action, technician_id, old_values, new_values)
       VALUES ('servers', ?, 'UPDATE', ?, ?, ?)`,
      [req.params.id, technician_id || null, JSON.stringify(old[0]), JSON.stringify(req.body)]
    );

    res.json({ success: true, message: 'Server updated successfully' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── DELETE /api/servers/:id — soft delete ────────────────────
router.delete('/:id', async (req, res) => {
  try {
    await db.execute(`UPDATE servers SET status = 'decommissioned' WHERE id = ?`, [req.params.id]);
    res.json({ success: true, message: 'Server decommissioned' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
