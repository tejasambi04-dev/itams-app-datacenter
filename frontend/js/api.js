// ============================================================
// ITAMS — API Wrapper (fetch helper)
// ============================================================

const API_BASE = '/api';

const api = {
  async request(method, path, body, isFormData = false) {
    const opts = {
      method,
      headers: isFormData ? {} : { 'Content-Type': 'application/json' },
      body: body ? (isFormData ? body : JSON.stringify(body)) : undefined
    };
    try {
      const res = await fetch(API_BASE + path, opts);
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Request failed' }));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      // Handle CSV downloads
      const ct = res.headers.get('content-type');
      if (ct && ct.includes('text/csv')) return res.blob();
      return res.json();
    } catch (err) {
      console.error(`[API] ${method} ${path}:`, err.message);
      throw err;
    }
  },
  get:    (path)        => api.request('GET', path),
  post:   (path, body)  => api.request('POST', path, body),
  put:    (path, body)  => api.request('PUT', path, body),
  delete: (path)        => api.request('DELETE', path),
  upload: (path, form)  => api.request('POST', path, form, true),

  // Convenience
  assets:    {
    list:   (params = {}) => api.get('/assets?' + new URLSearchParams(params)),
    get:    (id)          => api.get('/assets/' + id),
    create: (data)        => api.post('/assets', data),
    update: (id, data)    => api.put('/assets/' + id, data),
    delete: (id)          => api.delete('/assets/' + id)
  },
  servers:   {
    list:   (params = {}) => api.get('/servers?' + new URLSearchParams(params)),
    get:    (id)          => api.get('/servers/' + id),
    create: (data)        => api.post('/servers', data),
    update: (id, data)    => api.put('/servers/' + id, data),
    delete: (id)          => api.delete('/servers/' + id)
  },
  audits:    {
    list:   (params = {}) => api.get('/audits?' + new URLSearchParams(params)),
    upload: (form)        => api.upload('/audits/upload', form),
    download: (id)        => fetch(API_BASE + '/audits/' + id + '/download'),
    delete: (id)          => api.delete('/audits/' + id)
  },
  reports:   {
    search:    (params) => api.get('/reports?' + new URLSearchParams(params)),
    exportCsv: (params, section) => fetch(API_BASE + '/reports/export-csv?' + new URLSearchParams({ ...params, section })),
    stats:     ()       => api.get('/reports/stats')
  },
  schedules: {
    list:   (params = {}) => api.get('/schedules?' + new URLSearchParams(params)),
    create: (data)        => api.post('/schedules', data),
    update: (id, data)    => api.put('/schedules/' + id, data),
    delete: (id)          => api.delete('/schedules/' + id)
  },
  notifications: {
    getUnread: () => api.get('/notifications'),
    markRead:  (id) => api.put('/notifications/' + id + '/read', {}),
    readAll:   () => api.put('/notifications/read-all', {})
  },
  technicians: {
    list: () => api.get('/technicians')
  },
  presets: {
    all: () => api.get('/presets')
  }
};

// ── CSV Download Helper ────────────────────────────────────────
async function downloadCsv(params, section = 'assets') {
  try {
    const res = await api.reports.exportCsv(params, section);
    if (!res.ok) throw new Error('Export failed');
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const date = new Date().toISOString().slice(0, 10);
    a.download = `itams_${section}_${date}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  } catch (err) {
    showError('CSV export failed: ' + err.message);
  }
}

// ── Global presets cache ───────────────────────────────────────
let _presetsCache = null;
async function getPresets() {
  if (_presetsCache) return _presetsCache;
  const res = await api.presets.all();
  _presetsCache = res.data;
  return _presetsCache;
}

// ── Populate a <select> from presets ──────────────────────────
async function populateSelect(selectEl, category, placeholder = '-- Select --') {
  const presets = await getPresets();
  const options = presets[category] || [];
  selectEl.innerHTML = `<option value="">${placeholder}</option>`;
  options.forEach(v => {
    const opt = document.createElement('option');
    opt.value = v;
    opt.textContent = v;
    selectEl.appendChild(opt);
  });
  // Add "Other / Custom" option
  const other = document.createElement('option');
  other.value = '__other__';
  other.textContent = '✎ Enter custom value…';
  selectEl.appendChild(other);

  // Handle custom entry
  selectEl.addEventListener('change', () => {
    if (selectEl.value === '__other__') {
      const custom = prompt(`Enter custom ${category}:`);
      if (custom) {
        const opt = document.createElement('option');
        opt.value = custom;
        opt.textContent = custom;
        selectEl.insertBefore(opt, other);
        selectEl.value = custom;
      } else {
        selectEl.value = '';
      }
    }
  });
}

// ── Populate a <datalist> ─────────────────────────────────────
async function populateDatalist(datalistEl, category) {
  const presets = await getPresets();
  const options = presets[category] || [];
  datalistEl.innerHTML = '';
  options.forEach(v => {
    const opt = document.createElement('option');
    opt.value = v;
    datalistEl.appendChild(opt);
  });
}

// ── Technician dropdown ────────────────────────────────────────
async function populateTechnicianSelect(selectEl) {
  const res = await api.technicians.list();
  selectEl.innerHTML = '<option value="">-- Select Technician --</option>';
  res.data.forEach(t => {
    const opt = document.createElement('option');
    opt.value = t.id;
    opt.textContent = t.name;
    selectEl.appendChild(opt);
  });
}

// ── Toast notifications (UI feedback) ────────────────────────
function showToast(message, type = 'info', duration = 4000) {
  const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
  const container = document.getElementById('toast-container') || createToastContainer();
  const toast = document.createElement('div');
  toast.className = `notif-bubble ${type}`;
  toast.innerHTML = `
    <span class="notif-icon">${icons[type]}</span>
    <div class="notif-content">
      <div class="notif-title">${message}</div>
    </div>
    <button class="notif-close" onclick="dismissBubble(this.parentElement)">✕</button>
  `;
  container.appendChild(toast);
  if (duration > 0) setTimeout(() => dismissBubble(toast), duration);
}

function showError(msg)   { showToast(msg, 'error'); }
function showSuccess(msg) { showToast(msg, 'success'); }

function createToastContainer() {
  const c = document.createElement('div');
  c.id = 'toast-container';
  c.className = 'notif-container';
  document.body.appendChild(c);
  return c;
}

function dismissBubble(el) {
  if (!el || el.classList.contains('exiting')) return;
  el.classList.add('exiting');
  setTimeout(() => el.remove(), 300);
}

// ── Format helpers ─────────────────────────────────────────────
function formatDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatDateTime(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function formatBytes(bytes) {
  if (!bytes) return '—';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1048576).toFixed(1) + ' MB';
}

// ── Badge HTML ─────────────────────────────────────────────────
function statusBadge(status) {
  const map = {
    active: 'active', online: 'active', done: 'done',
    pending: 'pending', overdue: 'overdue', danger: 'danger',
    repair: 'warning', warning: 'warning',
    retired: 'retired', decommissioned: 'retired', offline: 'retired',
    desktop: 'desktop', laptop: 'laptop', server: 'server'
  };
  const cls = map[status] || 'pending';
  const icons = {
    active:'🟢', online:'🟢', done:'✓', pending:'🔵', overdue:'🔴',
    repair:'🟡', retired:'⚫', decommissioned:'⚫', offline:'⚫',
    desktop:'🖥', laptop:'💻', server:'🖧'
  };
  return `<span class="badge badge-${cls}">${icons[status] || ''} ${status}</span>`;
}

// ── Set active nav link ────────────────────────────────────────
function setActiveNav() {
  const current = window.location.pathname.split('/').pop().replace('.html', '') || 'dashboard';
  document.querySelectorAll('.nav-link').forEach(a => {
    const href = a.getAttribute('href') || '';
    if (href.includes(current)) a.classList.add('active');
    else a.classList.remove('active');
  });
}

document.addEventListener('DOMContentLoaded', setActiveNav);
