// ============================================================
// ITAMS — Notification Pop-up System
// Shows service due/overdue alerts on page load
// ============================================================

const Notifications = {
  container: null,
  bellBadge: null,
  count: 0,

  init() {
    this.container = document.getElementById('notif-container') || this._createContainer();
    this.bellBadge = document.querySelector('.bell-badge');
    this._loadAndShow();
  },

  _createContainer() {
    const c = document.createElement('div');
    c.id = 'notif-container';
    c.className = 'notif-container';
    document.body.appendChild(c);
    return c;
  },

  async _loadAndShow() {
    try {
      const res = await api.notifications.getUnread();
      if (!res.success || !res.data.length) return;

      this.count = res.data.length;
      this._updateBell(this.count);

      // Show up to 5 bubbles, staggered
      const toShow = res.data.slice(0, 5);
      toShow.forEach((n, i) => {
        setTimeout(() => this.showBubble(n), i * 400);
      });
    } catch (err) {
      console.warn('[Notifications] Could not load:', err.message);
    }
  },

  showBubble(notification) {
    const icons = {
      overdue: '⚠️',
      due_soon: '🔔',
      warning: '⚡',
      info: 'ℹ️'
    };

    const bubble = document.createElement('div');
    bubble.className = `notif-bubble ${notification.type}`;
    bubble.dataset.id = notification.id;

    bubble.innerHTML = `
      <span class="notif-icon">${icons[notification.type] || 'ℹ️'}</span>
      <div class="notif-content">
        <div class="notif-title">${this._escape(notification.title)}</div>
        <div class="notif-msg">${this._escape(notification.message || '')}</div>
      </div>
      <button class="notif-close" title="Dismiss">✕</button>
    `;

    bubble.querySelector('.notif-close').addEventListener('click', () => {
      this.dismiss(bubble, notification.id);
    });

    this.container.appendChild(bubble);

    // Auto-dismiss after 8 seconds for non-overdue
    if (notification.type !== 'overdue') {
      setTimeout(() => {
        if (bubble.parentNode) this.dismiss(bubble, notification.id);
      }, 8000);
    }
  },

  async dismiss(bubble, notifId) {
    if (bubble.classList.contains('exiting')) return;
    bubble.classList.add('exiting');
    setTimeout(() => bubble.remove(), 300);

    // Mark as read in DB
    try {
      await api.notifications.markRead(notifId);
    } catch (e) { /* silent */ }
  },

  showBubbleManual(type, title, message) {
    const fake = { id: null, type, title, message };
    this.showBubble(fake);
  },

  _updateBell(count) {
    if (!this.bellBadge) return;
    if (count > 0) {
      this.bellBadge.textContent = count > 99 ? '99+' : count;
      this.bellBadge.style.display = 'flex';
    } else {
      this.bellBadge.style.display = 'none';
    }
  },

  _escape(str) {
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  }
};

// ── Sidebar Shared HTML ────────────────────────────────────────
function renderSidebar() {
  const sidebarEl = document.getElementById('sidebar');
  if (!sidebarEl) return;

  sidebarEl.innerHTML = `
    <div class="sidebar-logo">
      <div class="logo-icon">🖥</div>
      <div>
        <div class="logo-text">ITAMS</div>
        <div class="logo-sub">Asset Manager</div>
      </div>
    </div>
    <nav class="sidebar-nav">
      <div class="nav-section-label">Overview</div>
      <a href="dashboard.html" class="nav-link" id="nav-dashboard">
        <span class="nav-icon">📊</span> Dashboard
      </a>

      <div class="nav-section-label">Inventory</div>
      <a href="new-asset.html" class="nav-link" id="nav-new-asset">
        <span class="nav-icon">➕</span> Add Asset
      </a>
      <a href="asset-list.html" class="nav-link" id="nav-asset-list">
        <span class="nav-icon">🖥</span> All Assets
      </a>
      <a href="new-server.html" class="nav-link" id="nav-new-server">
        <span class="nav-icon">🖧</span> Add Server
      </a>
      <a href="server-list.html" class="nav-link" id="nav-server-list">
        <span class="nav-icon">📡</span> All Servers
      </a>

      <div class="nav-section-label">Audit</div>
      <a href="software-audit.html" class="nav-link" id="nav-software-audit">
        <span class="nav-icon">📋</span> Software Audit
      </a>

      <div class="nav-section-label">Operations</div>
      <a href="scheduler.html" class="nav-link" id="nav-scheduler">
        <span class="nav-icon">📅</span> Service Scheduler
        <span class="nav-badge warning" id="nav-overdue-badge" style="display:none">0</span>
      </a>
      <a href="reports.html" class="nav-link" id="nav-reports">
        <span class="nav-icon">📈</span> Reports &amp; Export
      </a>
    </nav>
    <div class="sidebar-footer">
      <div style="font-size:11px; color: var(--text-muted)">ITAMS v1.0 • Internal Use</div>
    </div>
  `;

  setActiveNav();
  loadOverdueBadge();
}

async function loadOverdueBadge() {
  try {
    const res = await api.reports.stats();
    if (res.success) {
      const badge = document.getElementById('nav-overdue-badge');
      const count = res.data.overdue_services;
      if (badge && count > 0) {
        badge.textContent = count;
        badge.style.display = 'flex';
      }
    }
  } catch (e) { /* silent */ }
}

document.addEventListener('DOMContentLoaded', () => {
  renderSidebar();
  Notifications.init();
});
