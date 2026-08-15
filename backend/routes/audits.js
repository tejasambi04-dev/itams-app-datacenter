// ============================================================
// Audits Route — Belarc HTML file upload/download
// ============================================================

const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const db = require('../db');
const { upload, finalizeUpload } = require('../middleware/upload');

// ── POST /api/audits/upload ───────────────────────────────────
router.post('/upload', upload.single('auditFile'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, error: 'No file uploaded or invalid file type' });
  }

  try {
    // Finalize upload: compute hash and rename
    const { storedFilename, fileHash, filePath } = await finalizeUpload(req.file.path);
    const fileSize = fs.statSync(filePath).size;

    const { asset_id, server_id, technician_id, notes } = req.body;

    const [result] = await db.execute(
      `INSERT INTO software_audits 
       (asset_id, server_id, technician_id, original_filename, stored_filename, file_path, file_hash, file_size, notes)
       VALUES (?,?,?,?,?,?,?,?,?)`,
      [asset_id || null, server_id || null, technician_id || null,
       req.file.originalname, storedFilename, filePath, fileHash, fileSize, notes || null]
    );

    res.status(201).json({
      success: true,
      id: result.insertId,
      message: 'Audit file uploaded securely',
      fileHash,
      storedFilename
    });
  } catch (err) {
    // Clean up temp file if error
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── GET /api/audits — list audits ────────────────────────────
router.get('/', async (req, res) => {
  try {
    const { asset_id, server_id } = req.query;
    let where = ['1=1'];
    let params = [];
    if (asset_id)  { where.push('sa.asset_id = ?');  params.push(asset_id); }
    if (server_id) { where.push('sa.server_id = ?'); params.push(server_id); }

    const [rows] = await db.execute(
      `SELECT sa.id, sa.asset_id, sa.server_id, sa.audit_date, sa.original_filename,
              sa.file_hash, sa.file_size, sa.notes, t.name as technician_name
       FROM software_audits sa LEFT JOIN technicians t ON sa.technician_id = t.id
       WHERE ${where.join(' AND ')} ORDER BY sa.audit_date DESC`,
      params
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── GET /api/audits/:id/download — secure download ───────────
router.get('/:id/download', async (req, res) => {
  try {
    const [rows] = await db.execute(
      `SELECT * FROM software_audits WHERE id = ?`, [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ success: false, error: 'Audit not found' });

    const audit = rows[0];
    const filePath = audit.file_path;

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, error: 'File not found on server' });
    }

    // Verify file integrity
    const crypto = require('crypto');
    const hash = crypto.createHash('sha256');
    const data = fs.readFileSync(filePath);
    hash.update(data);
    const currentHash = hash.digest('hex');

    if (currentHash !== audit.file_hash) {
      return res.status(500).json({ success: false, error: 'File integrity check failed' });
    }

    // Force download — prevent browser execution
    res.setHeader('Content-Disposition', `attachment; filename="${audit.original_filename}"`);
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.sendFile(filePath);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── DELETE /api/audits/:id ────────────────────────────────────
router.delete('/:id', async (req, res) => {
  try {
    const [rows] = await db.execute('SELECT * FROM software_audits WHERE id = ?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ success: false, error: 'Not found' });

    // Delete file from disk
    if (fs.existsSync(rows[0].file_path)) {
      fs.unlinkSync(rows[0].file_path);
    }
    await db.execute('DELETE FROM software_audits WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Audit record deleted' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
