// ============================================================
// ITAMS API Test Script — verifies all key endpoints work
// Run AFTER starting the server: node server.js
// Then in another terminal: node test-api.js
// ============================================================

const BASE = 'http://localhost:3000/api';

let passed = 0;
let failed = 0;
const results = [];

async function test(label, fn) {
  try {
    const result = await fn();
    if (result === true || (result && result.success !== false)) {
      console.log(`  ✅ ${label}`);
      passed++;
      results.push({ label, status: 'PASS', data: result });
    } else {
      console.log(`  ❌ ${label} — unexpected result:`, JSON.stringify(result).slice(0, 120));
      failed++;
      results.push({ label, status: 'FAIL', data: result });
    }
  } catch (err) {
    console.log(`  ❌ ${label} — ${err.message}`);
    failed++;
    results.push({ label, status: 'ERROR', error: err.message });
  }
}

async function req(method, path, body) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' }
  };
  if (body) opts.body = JSON.stringify(body);
  const r = await fetch(`${BASE}${path}`, opts);
  return r.json();
}

// ── Created IDs (for chained tests) ──────────────────────────
let createdAssetId  = null;
let createdServerId = null;
let createdSchedId  = null;

async function runTests() {
  console.log('\n══════════════════════════════════════════════════');
  console.log(' ITAMS API Test Suite');
  console.log('══════════════════════════════════════════════════\n');

  // ── PRESETS ────────────────────────────────────────────────
  console.log('📦 Presets API');
  await test('GET /presets — returns preset categories', async () => {
    const r = await req('GET', '/presets');
    return r.success && r.data && typeof r.data === 'object';
  });

  // ── TECHNICIANS ────────────────────────────────────────────
  console.log('\n👤 Technicians API');
  let techId = null;
  await test('GET /technicians — list technicians', async () => {
    const r = await req('GET', '/technicians');
    if (r.success && r.data.length > 0) {
      techId = r.data[0].id; // grab first tech for later tests
    }
    return r.success;
  });

  // ── ASSETS ─────────────────────────────────────────────────
  console.log('\n🖥  Assets API (Desktop)');
  await test('POST /assets — create desktop asset', async () => {
    const r = await req('POST', '/assets', {
      asset_type:     'desktop',
      pc_username:    'test.user',
      pc_name:        'TEST-DESK-001',
      pc_location:    'Server Room',
      department:     'IT Department',
      os_version:     'Windows 11 Pro',
      technician_id:  techId,
      status:         'active',
      cpu:            'Intel Core i7-13700',
      ram:            '16GB DDR5',
      motherboard:    'ASUS Prime Z790',
      power_supply:   'Corsair 750W',
      ssd:            '512GB NVMe',
      hdd:            null,
      gfx_card:       'NVIDIA RTX 3060',
      monitor:        '24" Dell UltraSharp',
      keyboard:       'Logitech MK550',
      mouse:          'Logitech MX Master 3',
      headphones:     null,
      ups:            'APC Back-UPS 1500VA',
      webcam:         'Logitech C920',
      other_peripherals: null,
      network_ip:     '192.168.1.101',
      network_mac:    'AA:BB:CC:DD:EE:01',
      purchase_date:  '2024-01-15',
      warranty_expiry:'2027-01-15',
      next_service_date: new Date(Date.now() + 7*24*60*60*1000).toISOString().split('T')[0],
      service_interval_months: 3,
      tags:           'test,desktop,it-dept',
      notes:          'Test entry created by API test script'
    });
    if (r.success) createdAssetId = r.id;
    return r.success && r.id;
  });

  await test('POST /assets — create laptop asset', async () => {
    const r = await req('POST', '/assets', {
      asset_type:     'laptop',
      pc_username:    'jane.smith',
      pc_name:        'TEST-LTOP-001',
      pc_location:    'Finance Floor 2',
      department:     'Finance',
      os_version:     'Windows 11 Pro',
      technician_id:  techId,
      status:         'active',
      make:           'Dell',
      model_no:       'Latitude 5540',
      service_tag:    'SVC-TEST-12345',
      l_ram:          '16GB DDR5',
      l_ssd:          '256GB NVMe',
      battery_health: 'Good',
      power_adapter:  '65W USB-C',
      l_mouse:        'Logitech M235',
      l_headphones:   'Plantronics Voyager',
      docking_station:'Dell WD22TB4',
      network_ip:     '192.168.1.102',
      network_mac:    'AA:BB:CC:DD:EE:02',
      purchase_date:  '2024-03-10',
      warranty_expiry:'2027-03-10',
      notes:          'Test laptop entry'
    });
    return r.success && r.id;
  });

  await test('GET /assets — list returns new assets', async () => {
    const r = await req('GET', '/assets');
    return r.success && r.data.length >= 2;
  });

  await test('GET /assets?q=TEST-DESK — search works', async () => {
    const r = await req('GET', '/assets?q=TEST-DESK');
    return r.success && r.data.some(a => a.pc_name === 'TEST-DESK-001');
  });

  if (createdAssetId) {
    await test(`GET /assets/${createdAssetId} — single asset`, async () => {
      const r = await req('GET', `/assets/${createdAssetId}`);
      return r.success && r.data.id === createdAssetId;
    });
  }

  // ── SERVERS ─────────────────────────────────────────────────
  console.log('\n🖧  Servers API');
  await test('POST /servers — create Linux server', async () => {
    const r = await req('POST', '/servers', {
      server_name:    'TEST-SRV-LINUX-01',
      os_type:        'Linux',
      os_version:     'Ubuntu Server 24.04 LTS',
      make:           'Dell',
      model:          'PowerEdge R740',
      service_tag:    'DELL-TEST-SRV-001',
      location:       'Server Room A',
      department:     'IT Department',
      ip_address:     '192.168.1.10',
      mac_address:    'AA:BB:CC:DD:EE:10',
      cpu:            'Intel Xeon Gold 6230',
      ram:            '64GB ECC',
      storage:        '2x 1TB SSD RAID 1',
      raid_config:    'RAID 1',
      roles_services: 'Web Server,Application Server',
      remote_access:  'AnyDesk #123456789',
      technician_id:  techId,
      status:         'online',
      last_patch_date:'2026-06-01',
      notes:          'Test server entry',
      next_service_date: new Date(Date.now() + 30*24*60*60*1000).toISOString().split('T')[0],
      service_interval_months: 6
    });
    if (r.success) createdServerId = r.id;
    return r.success && r.id;
  });

  await test('GET /servers — list returns new server', async () => {
    const r = await req('GET', '/servers');
    return r.success && r.data.some(s => s.server_name === 'TEST-SRV-LINUX-01');
  });

  // ── SCHEDULES ───────────────────────────────────────────────
  console.log('\n📅 Schedules API');
  await test('POST /schedules — create schedule', async () => {
    if (!createdAssetId) return false;
    const r = await req('POST', '/schedules', {
      asset_id:       createdAssetId,
      asset_type:     'desktop',
      asset_name:     'TEST-DESK-001',
      service_type:   'OS Patch Update',
      scheduled_date: new Date(Date.now() + 5*24*60*60*1000).toISOString().split('T')[0],
      next_interval_months: 1,
      notes:          'Monthly Windows Update check'
    });
    if (r.success) createdSchedId = r.id;
    return r.success;
  });

  await test('GET /schedules — list schedules', async () => {
    const r = await req('GET', '/schedules');
    return r.success && Array.isArray(r.data);
  });

  if (createdSchedId) {
    await test('PUT /schedules/:id — mark service done', async () => {
      const r = await req('PUT', `/schedules/${createdSchedId}`, {
        status: 'done',
        completed_date: new Date().toISOString().split('T')[0],
        service_type: 'OS Patch Update',
        scheduled_date: new Date().toISOString().split('T')[0],
        next_interval_months: 1,
        notes: 'Completed during test run'
      });
      return r.success;
    });
  }

  // ── REPORTS ─────────────────────────────────────────────────
  console.log('\n📈 Reports API');
  await test('GET /reports/stats — dashboard stats', async () => {
    const r = await req('GET', '/reports/stats');
    return r.success && typeof r.data.total_assets === 'number';
  });

  await test('GET /reports — search all', async () => {
    const r = await req('GET', '/reports?q=TEST');
    return r.success && r.data;
  });

  await test('GET /reports/export-csv — CSV download (assets)', async () => {
    const r = await fetch(`${BASE}/reports/export-csv?section=assets`);
    const contentType = r.headers.get('content-type');
    return contentType && contentType.includes('text/csv');
  });

  // ── NOTIFICATIONS ────────────────────────────────────────────
  console.log('\n🔔 Notifications API');
  await test('GET /notifications — list notifications', async () => {
    const r = await req('GET', '/notifications');
    return r.success !== undefined;
  });

  // ── Summary ──────────────────────────────────────────────────
  console.log('\n══════════════════════════════════════════════════');
  console.log(` Test Results: ${passed} passed, ${failed} failed`);
  console.log('══════════════════════════════════════════════════');

  if (createdAssetId)  console.log(` ✏  Created Desktop Asset ID : ${createdAssetId}`);
  if (createdServerId) console.log(` ✏  Created Server ID        : ${createdServerId}`);

  if (failed === 0) {
    console.log('\n 🎉 All tests passed! The app is working correctly.\n');
  } else {
    console.log(`\n ⚠  ${failed} test(s) failed. Check that:\n`);
    console.log('   1. MySQL is running and schema is loaded');
    console.log('   2. .env has correct DB credentials');
    console.log('   3. server.js is running (node server.js)\n');
  }

  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch(err => {
  console.error('\n💥 Test runner failed:', err.message);
  console.error('   Make sure the server is running: node server.js');
  process.exit(1);
});
