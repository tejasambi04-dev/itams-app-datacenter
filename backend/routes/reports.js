// ============================================================
// Reports Route — Search + CSV Export
// ============================================================

const express = require('express');
const router = express.Router();
const db = require('../db');

// ✅ Built-in RFC 4180 CSV serializer — no external dependency needed
function toCSV(rows) {
  if (!rows || !rows.length) return '';
  const escape = (v) => {
    const s = v == null ? '' : String(v);
    return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const headers = Object.keys(rows[0]);
  const lines = [
    headers.map(escape).join(','),
    ...rows.map(row => headers.map(h => escape(row[h])).join(','))
  ];
  return lines.join('\r\n');
}

// ── GET /api/reports — search everything ─────────────────────
router.get('/', async (req, res) => {
  try {
    const {
      q, asset_type, department, status, technician_id,
      created_from, created_to, section // 'assets', 'servers', 'all'
    } = req.query;

    const sec = section || 'all';
    const results = { assets: [], servers: [] };

    // ── ASSETS search ─────────────────────────────────────────
    if (sec === 'all' || sec === 'assets') {
      let where = ['1=1'];
      let params = [];

      if (q) {
        where.push(`(a.id LIKE ? OR a.pc_username LIKE ? OR a.pc_name LIKE ? 
                     OR a.pc_location LIKE ? OR a.department LIKE ? OR a.tags LIKE ?
                     OR a.network_ip LIKE ? OR a.os_version LIKE ?)`);
        const like = `%${q}%`;
        params.push(like, like, like, like, like, like, like, like);
      }
      if (asset_type)    { where.push('a.asset_type = ?');    params.push(asset_type); }
      if (department)    { where.push('a.department = ?');    params.push(department); }
      if (status)        { where.push('a.status = ?');        params.push(status); }
      if (technician_id) { where.push('a.technician_id = ?'); params.push(technician_id); }
      if (created_from)  { where.push('DATE(a.created_at) >= ?'); params.push(created_from); }
      if (created_to)    { where.push('DATE(a.created_at) <= ?'); params.push(created_to); }

      const [rows] = await db.execute(
        `SELECT a.id, a.asset_type, a.pc_username, a.pc_name, a.pc_location, a.department,
                a.os_version, a.status, a.network_ip, a.network_mac, a.purchase_date, a.warranty_expiry,
                a.next_service_date, a.service_interval_months, a.tags, a.notes,
                a.created_at, a.updated_at, t.name as technician_name,
                COALESCE(dh.cpu, lh.make) as hardware_make,
                COALESCE(dh.ram, lh.ram) as ram,
                COALESCE(dh.ssd, lh.ssd) as ssd,
                lh.model_no, lh.service_tag
         FROM assets a
         LEFT JOIN technicians t ON a.technician_id = t.id
         LEFT JOIN desktop_hardware dh ON a.id = dh.asset_id AND a.asset_type = 'desktop'
         LEFT JOIN laptop_hardware lh ON a.id = lh.asset_id AND a.asset_type = 'laptop'
         WHERE ${where.join(' AND ')}
         ORDER BY a.created_at DESC`,
        params
      );
      results.assets = rows;
    }

    // ── SERVERS search ────────────────────────────────────────
    if (sec === 'all' || sec === 'servers') {
      let where = ['1=1'];
      let params = [];

      if (q) {
        where.push(`(s.id LIKE ? OR s.server_name LIKE ? OR s.ip_address LIKE ?
                     OR s.department LIKE ? OR s.location LIKE ? OR s.service_tag LIKE ?
                     OR s.roles_services LIKE ? OR s.os_version LIKE ?)`);
        const like = `%${q}%`;
        params.push(like, like, like, like, like, like, like, like);
      }
      if (department)    { where.push('s.department = ?');    params.push(department); }
      if (status)        { where.push('s.status = ?');        params.push(status); }
      if (technician_id) { where.push('s.technician_id = ?'); params.push(technician_id); }
      if (created_from)  { where.push('DATE(s.created_at) >= ?'); params.push(created_from); }
      if (created_to)    { where.push('DATE(s.created_at) <= ?'); params.push(created_to); }

      const [rows] = await db.execute(
        `SELECT s.*, t.name as technician_name
         FROM servers s LEFT JOIN technicians t ON s.technician_id = t.id
         WHERE ${where.join(' AND ')} ORDER BY s.created_at DESC`,
        params
      );
      results.servers = rows;
    }

    res.json({
      success: true,
      counts: { assets: results.assets.length, servers: results.servers.length },
      data: results
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── GET /api/reports/export-csv — download CSV ───────────────
router.get('/export-csv', async (req, res) => {
  try {
    const { section = 'assets', ...filters } = req.query;

    // Reuse the search logic
    let rows = [];
    if (section === 'assets' || section === 'all') {
      const [assets] = await db.execute(
        `SELECT a.id, a.asset_type, a.pc_username, a.pc_name, a.pc_location, a.department,
                a.os_version, a.status, a.network_ip, a.network_mac, a.purchase_date, a.warranty_expiry,
                a.next_service_date, a.tags, a.notes, a.created_at, t.name as technician_name,
                COALESCE(dh.cpu, lh.make) as cpu_make, COALESCE(dh.ram, lh.ram) as ram,
                COALESCE(dh.ssd, lh.ssd) as ssd, lh.model_no, lh.service_tag,
                dh.motherboard, dh.hdd, dh.monitor, dh.keyboard, dh.mouse, dh.headphones
         FROM assets a
         LEFT JOIN technicians t ON a.technician_id = t.id
         LEFT JOIN desktop_hardware dh ON a.id = dh.asset_id AND a.asset_type = 'desktop'
         LEFT JOIN laptop_hardware lh ON a.id = lh.asset_id AND a.asset_type = 'laptop'
         ORDER BY a.created_at DESC`
      );
      rows = assets;
    } else if (section === 'servers') {
      const [servers] = await db.execute(
        `SELECT s.*, t.name as technician_name FROM servers s
         LEFT JOIN technicians t ON s.technician_id = t.id ORDER BY s.created_at DESC`
      );
      rows = servers;
    }

    if (!rows.length) {
      return res.status(404).json({ success: false, error: 'No data to export' });
    }

    const csv = toCSV(rows);
    const filename = `itams_${section}_export_${new Date().toISOString().slice(0, 10)}.csv`;

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── GET /api/reports/stats — dashboard KPIs ──────────────────
router.get('/stats', async (req, res) => {
  try {
    const [[totalAssets]]   = await db.execute('SELECT COUNT(*) as count FROM assets WHERE status != "retired"');
    const [[desktops]]      = await db.execute('SELECT COUNT(*) as count FROM assets WHERE asset_type = "desktop" AND status = "active"');
    const [[laptops]]       = await db.execute('SELECT COUNT(*) as count FROM assets WHERE asset_type = "laptop" AND status = "active"');
    const [[servers]]       = await db.execute('SELECT COUNT(*) as count FROM servers WHERE status = "online"');
    const [[overdue]]       = await db.execute('SELECT COUNT(*) as count FROM service_schedules WHERE status = "overdue"');
    const [[dueSoon]]       = await db.execute('SELECT COUNT(*) as count FROM service_schedules WHERE status = "pending" AND scheduled_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 7 DAY)');
    const [[totalAudits]]   = await db.execute('SELECT COUNT(*) as count FROM software_audits');
    const [[unreadNotifs]]  = await db.execute('SELECT COUNT(*) as count FROM notifications WHERE is_read = 0');

    res.json({
      success: true,
      data: {
        total_assets: totalAssets.count,
        desktops: desktops.count,
        laptops: laptops.count,
        servers: servers.count,
        overdue_services: overdue.count,
        due_soon: dueSoon.count,
        total_audits: totalAudits.count,
        unread_notifications: unreadNotifs.count
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
