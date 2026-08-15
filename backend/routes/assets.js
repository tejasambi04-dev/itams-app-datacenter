// ============================================================
// Assets Route — Desktop & Laptop CRUD
// ============================================================

const express = require('express');
const router = express.Router();
const db = require('../db');

// Helper: generate unique asset ID
async function generateAssetId(type) {
  const prefix = type === 'desktop' ? 'PC' : 'LT';
  const now = new Date();
  const datePart = now.toISOString().replace(/[-T:]/g, '').slice(0, 15).replace('.', '');
  const dateStr = datePart.slice(0, 8);
  const timeStr = datePart.slice(8, 14);

  // Get sequence for today
  const [rows] = await db.execute(
    `SELECT COUNT(*) as cnt FROM assets WHERE DATE(created_at) = CURDATE() AND asset_type = ?`,
    [type]
  );
  const seq = String((rows[0].cnt || 0) + 1).padStart(3, '0');
  return `${prefix}-${dateStr}-${timeStr}-${seq}`;
}

// ── GET /api/assets — list all with optional search filters ──
router.get('/', async (req, res) => {
  try {
    const { q, department, type, status, technician_id } = req.query;
    let where = ['1=1'];
    let params = [];

    if (q) {
      where.push(`(a.pc_username LIKE ? OR a.pc_name LIKE ? OR a.pc_location LIKE ? 
                   OR a.department LIKE ? OR a.id LIKE ? OR a.tags LIKE ? OR a.network_ip LIKE ?)`);
      const like = `%${q}%`;
      params.push(like, like, like, like, like, like, like);
    }
    if (department) { where.push('a.department = ?'); params.push(department); }
    if (type)       { where.push('a.asset_type = ?'); params.push(type); }
    if (status)     { where.push('a.status = ?'); params.push(status); }
    if (technician_id) { where.push('a.technician_id = ?'); params.push(technician_id); }
    const sql = `
      SELECT a.*, t.name as technician_name,
             dh.cpu, dh.ram as d_ram, dh.motherboard, dh.power_supply, dh.ssd as d_ssd,
             dh.hdd, dh.gfx_card, dh.monitor, dh.keyboard, dh.mouse as d_mouse, dh.headphones as d_headphones,
             lh.make, lh.model_no, lh.service_tag, lh.ram as l_ram, lh.ssd as l_ssd,
             lh.power_adapter, lh.mouse as l_mouse, lh.headphones as l_headphones
      FROM assets a
      LEFT JOIN technicians t ON a.technician_id = t.id
      LEFT JOIN desktop_hardware dh ON a.id = dh.asset_id AND a.asset_type = 'desktop'
      LEFT JOIN laptop_hardware lh ON a.id = lh.asset_id AND a.asset_type = 'laptop'
      WHERE ${where.join(' AND ')}
      ORDER BY a.created_at DESC
    `;

    const [rows] = await db.execute(sql, params);
    res.json({ success: true, count: rows.length, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── GET /api/assets/:id — single asset ───────────────────────
router.get('/:id', async (req, res) => {
  try {
    const [assets] = await db.execute(
      `SELECT a.*, t.name as technician_name 
       FROM assets a LEFT JOIN technicians t ON a.technician_id = t.id 
       WHERE a.id = ?`,
      [req.params.id]
    );
    if (!assets.length) return res.status(404).json({ success: false, error: 'Asset not found' });

    const asset = assets[0];

    // Fetch hardware details
    if (asset.asset_type === 'desktop') {
      const [hw] = await db.execute('SELECT * FROM desktop_hardware WHERE asset_id = ?', [req.params.id]);
      asset.hardware = hw[0] || {};
    } else {
      const [hw] = await db.execute('SELECT * FROM laptop_hardware WHERE asset_id = ?', [req.params.id]);
      asset.hardware = hw[0] || {};
    }

    // Fetch software audits
    const [audits] = await db.execute(
      `SELECT sa.*, t.name as tech_name FROM software_audits sa
       LEFT JOIN technicians t ON sa.technician_id = t.id
       WHERE sa.asset_id = ? ORDER BY sa.audit_date DESC`,
      [req.params.id]
    );
    asset.software_audits = audits;

    // Fetch service schedules
    const [schedules] = await db.execute(
      `SELECT * FROM service_schedules WHERE asset_id = ? ORDER BY scheduled_date DESC`,
      [req.params.id]
    );
    asset.schedules = schedules;

    res.json({ success: true, data: asset });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── POST /api/assets — create new asset ──────────────────────
router.post('/', async (req, res) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const {
      asset_type, pc_username, pc_name, pc_location, department,
      os_version, technician_id, notes, next_service_date, service_interval_months,
      tags, network_ip, network_mac, status, purchase_date, warranty_expiry,
      // Desktop hardware
      cpu, ram, motherboard, power_supply, ssd, hdd, gfx_card, monitor,
      keyboard, mouse, headphones, ups, webcam, other_peripherals,
      // Laptop hardware
      make, model_no, service_tag, l_ram, l_ssd, battery_health,
      power_adapter, l_mouse, l_headphones, docking_station, l_other_peripherals
    } = req.body;

    // ✅ Null-sanitizer: converts undefined / empty string to SQL NULL
    const n = (v) => (v === undefined || v === null || v === '') ? null : v;

    const id = await generateAssetId(asset_type);

    // Insert main asset record
    await conn.execute(
      `INSERT INTO assets (id, asset_type, pc_username, pc_name, pc_location, department,
         os_version, technician_id, notes, next_service_date, service_interval_months,
         tags, network_ip, network_mac, status, purchase_date, warranty_expiry)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [id, n(asset_type), n(pc_username), n(pc_name), n(pc_location), n(department),
       n(os_version), n(technician_id), n(notes),
       n(next_service_date), n(service_interval_months) || 3,
       n(tags), n(network_ip), n(network_mac), n(status) || 'active',
       n(purchase_date), n(warranty_expiry)]
    );

    // Insert hardware details
    if (asset_type === 'desktop') {
      await conn.execute(
        `INSERT INTO desktop_hardware 
         (asset_id, cpu, ram, motherboard, power_supply, ssd, hdd, gfx_card, monitor, keyboard, mouse, headphones, ups, webcam, other_peripherals)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [id, n(cpu), n(ram), n(motherboard), n(power_supply), n(ssd), n(hdd), n(gfx_card), n(monitor), n(keyboard), n(mouse), n(headphones), n(ups), n(webcam), n(other_peripherals)]
      );
    } else {
      await conn.execute(
        `INSERT INTO laptop_hardware 
         (asset_id, make, model_no, service_tag, ram, ssd, battery_health, power_adapter, mouse, headphones, docking_station, other_peripherals)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
        [id, n(make), n(model_no), n(service_tag), n(l_ram) || n(ram), n(l_ssd) || n(ssd), n(battery_health), n(power_adapter), n(l_mouse) || n(mouse), n(l_headphones) || n(headphones), n(docking_station), n(l_other_peripherals) || n(other_peripherals)]
      );
    }

    // Auto-create first service schedule if interval set
    if (next_service_date && service_interval_months) {
      await conn.execute(
        `INSERT INTO service_schedules (asset_id, asset_type, asset_name, scheduled_date, service_type, next_interval_months)
         VALUES (?,?,?,?,'Full System Check',?)`,
        [id, asset_type, n(pc_name) || n(pc_username), next_service_date, service_interval_months]
      );
    }

    // Audit log
    await conn.execute(
      `INSERT INTO audit_log (table_name, record_id, action, technician_id, new_values)
       VALUES ('assets', ?, 'INSERT', ?, ?)`,
      [id, n(technician_id), JSON.stringify(req.body)]
    );

    await conn.commit();
    res.status(201).json({ success: true, id, message: 'Asset created successfully' });
  } catch (err) {
    await conn.rollback();
    res.status(500).json({ success: false, error: err.message });
  } finally {
    conn.release();
  }
});

// ── PUT /api/assets/:id — update asset ───────────────────────
router.put('/:id', async (req, res) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    // Get old values for audit log
    const [old] = await conn.execute('SELECT * FROM assets WHERE id = ?', [req.params.id]);
    if (!old.length) return res.status(404).json({ success: false, error: 'Asset not found' });

    const {
      pc_username, pc_name, pc_location, department, os_version, technician_id,
      notes, next_service_date, service_interval_months, tags, network_ip, network_mac,
      status, purchase_date, warranty_expiry,
      // Desktop
      cpu, ram, motherboard, power_supply, ssd, hdd, gfx_card, monitor, keyboard, mouse, headphones, ups, webcam, other_peripherals,
      // Laptop
      make, model_no, service_tag, l_ram, l_ssd, battery_health, power_adapter, l_mouse, l_headphones, docking_station, l_other_peripherals
    } = req.body;

    // ✅ Null-sanitizer
    const n = (v) => (v === undefined || v === null || v === '') ? null : v;

    await conn.execute(
      `UPDATE assets SET pc_username=?, pc_name=?, pc_location=?, department=?,
         os_version=?, technician_id=?, notes=?, next_service_date=?, service_interval_months=?,
         tags=?, network_ip=?, network_mac=?, status=?, purchase_date=?, warranty_expiry=?
       WHERE id=?`,
      [n(pc_username), n(pc_name), n(pc_location), n(department), n(os_version), n(technician_id),
       n(notes), n(next_service_date), n(service_interval_months),
       n(tags), n(network_ip), n(network_mac), n(status), n(purchase_date), n(warranty_expiry),
       req.params.id]
    );

    const assetType = old[0].asset_type;
    if (assetType === 'desktop') {
      await conn.execute(
        `UPDATE desktop_hardware SET cpu=?, ram=?, motherboard=?, power_supply=?, ssd=?, hdd=?,
          gfx_card=?, monitor=?, keyboard=?, mouse=?, headphones=?, ups=?, webcam=?, other_peripherals=?
         WHERE asset_id=?`,
        [cpu, ram, motherboard, power_supply, ssd, hdd, gfx_card, monitor, keyboard, mouse, headphones, ups, webcam, other_peripherals, req.params.id]
      );
    } else {
      await conn.execute(
        `UPDATE laptop_hardware SET make=?, model_no=?, service_tag=?, ram=?, ssd=?, battery_health=?,
          power_adapter=?, mouse=?, headphones=?, docking_station=?, other_peripherals=?
         WHERE asset_id=?`,
        [make, model_no, service_tag, l_ram || ram, l_ssd || ssd, battery_health, power_adapter, l_mouse || mouse, l_headphones || headphones, docking_station, l_other_peripherals || other_peripherals, req.params.id]
      );
    }

    await conn.execute(
      `INSERT INTO audit_log (table_name, record_id, action, technician_id, old_values, new_values)
       VALUES ('assets', ?, 'UPDATE', ?, ?, ?)`,
      [req.params.id, technician_id || null, JSON.stringify(old[0]), JSON.stringify(req.body)]
    );

    await conn.commit();
    res.json({ success: true, message: 'Asset updated successfully' });
  } catch (err) {
    await conn.rollback();
    res.status(500).json({ success: false, error: err.message });
  } finally {
    conn.release();
  }
});

// ── DELETE /api/assets/:id — soft delete ─────────────────────
router.delete('/:id', async (req, res) => {
  try {
    await db.execute(`UPDATE assets SET status = 'retired' WHERE id = ?`, [req.params.id]);
    res.json({ success: true, message: 'Asset retired' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;