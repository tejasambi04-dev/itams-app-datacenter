// ============================================================
// node-cron Scheduler — checks for overdue/due services daily
// ============================================================

const cron = require('node-cron');
const db = require('../db');

// Helper: generate in-app notification
async function createNotification(type, title, message, assetId, serverId, scheduleId) {
  try {
    await db.execute(
      `INSERT INTO notifications (type, title, message, asset_id, server_id, schedule_id) VALUES (?, ?, ?, ?, ?, ?)`,
      [type, title, message, assetId || null, serverId || null, scheduleId || null]
    );
  } catch (e) {
    console.error('[Scheduler] Notification insert error:', e.message);
  }
}

// Run daily at 08:00 AM
cron.schedule('0 8 * * *', async () => {
  console.log('[Scheduler] Running daily service check...');

  const today = new Date().toISOString().split('T')[0];
  const sevenDaysLater = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  try {
    // 1. Mark overdue schedules
    const [overdue] = await db.execute(
      `SELECT id, asset_id, server_id, asset_type, asset_name, service_type 
       FROM service_schedules 
       WHERE status = 'pending' AND scheduled_date < ?`,
      [today]
    );

    for (const s of overdue) {
      await db.execute(
        `UPDATE service_schedules SET status = 'overdue', updated_at = NOW() WHERE id = ?`,
        [s.id]
      );
      await createNotification(
        'overdue',
        `⚠ Overdue: ${s.service_type}`,
        `Service for ${s.asset_name || s.asset_id || s.server_id} is overdue! Scheduled: Past due`,
        s.asset_id, s.server_id, s.id
      );
    }

    // 2. Notify for services due within next 7 days
    const [dueSoon] = await db.execute(
      `SELECT id, asset_id, server_id, asset_type, asset_name, service_type, scheduled_date 
       FROM service_schedules 
       WHERE status = 'pending' AND scheduled_date BETWEEN ? AND ?`,
      [today, sevenDaysLater]
    );

    for (const s of dueSoon) {
      // Only create if no similar notification exists today
      const [existing] = await db.execute(
        `SELECT id FROM notifications WHERE schedule_id = ? AND DATE(created_at) = ? AND type = 'due_soon'`,
        [s.id, today]
      );
      if (existing.length === 0) {
        await createNotification(
          'due_soon',
          `🔔 Due Soon: ${s.service_type}`,
          `Service for ${s.asset_name || s.asset_id || s.server_id} is due on ${s.scheduled_date}`,
          s.asset_id, s.server_id, s.id
        );
      }
    }

    console.log(`[Scheduler] Done. Overdue: ${overdue.length}, Due soon: ${dueSoon.length}`);
  } catch (err) {
    console.error('[Scheduler] Error:', err.message);
  }
});

console.log('[Scheduler] Daily service check scheduled at 08:00 AM');

module.exports = {};
