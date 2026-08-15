# ITAMS — IT Asset Management System
## Setup & Installation Guide

---

## What Is ITAMS?

A full-stack, browser-based IT Asset Management platform for your 100+ user organisation.  
Technicians fill smart Podio-style forms to log PC hardware, laptop inventory, server records, software audits, and schedule recurring maintenance — all stored in MySQL with search, CSV export, and pop-up service reminders.

---

## Prerequisites

Install these before starting:

| Software | Version | Download |
|---|---|---|
| **Node.js** | v18 or newer | https://nodejs.org |
| **MySQL** | v8.0 or newer | https://dev.mysql.com/downloads/mysql/ |
| **npm** | Included with Node.js | — |

Optional (for production):
- **Apache 2.4** — as reverse proxy in front of Node.js

---

## Step 1 — Set Up MySQL Database

Open MySQL command line or MySQL Workbench and run:

```sql
-- 1. Create the database and all tables
SOURCE C:/Users/indianoc/.gemini/antigravity/scratch/itams/db/schema.sql;

-- 2. Verify tables were created
USE itams_db;
SHOW TABLES;
```

Expected tables:
```
assets            desktop_hardware   laptop_hardware
servers           software_audits    service_schedules
technicians       dropdown_presets   audit_log
notifications
```

---

## Step 2 — Configure Environment

Edit the file `backend/.env` with your MySQL credentials:

```
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=YOUR_MYSQL_PASSWORD_HERE
DB_NAME=itams_db

PORT=3000
NODE_ENV=development

COMPANY_NAME=Your Company Name
```

---

## Step 3 — Start the Server

```powershell
# Navigate to backend folder
cd C:\Users\indianoc\.gemini\antigravity\scratch\itams\backend

# Start the server
node server.js
```

You should see:
```
[DB] MySQL connected successfully
[Scheduler] Daily service check scheduled at 08:00 AM

╔══════════════════════════════════════════╗
║  ITAMS Server running on port 3000       ║
║  http://localhost:3000                   ║
╚══════════════════════════════════════════╝
```

---

## Step 4 — Open the App

Open your browser and go to:

```
http://localhost:3000
```

Or from another computer on your LAN:
```
http://YOUR_SERVER_IP:3000
```

---

## Step 5 — (Optional) Run as Background Service on Windows

Install `pm2` to keep the server running after you close the terminal:

```powershell
npm install -g pm2
pm2 start server.js --name "itams"
pm2 startup
pm2 save
```

---

## Step 6 — (Optional) Apache Reverse Proxy

If you want to run on port 80 with Apache in front, add this to your Apache `httpd.conf`:

```apache
<VirtualHost *:80>
    ServerName itams.company.local
    ProxyPass        / http://localhost:3000/
    ProxyPassReverse / http://localhost:3000/
</VirtualHost>
```

Then restart Apache.  
Access via: `http://itams.company.local`

---

## Project File Structure

```
itams/
├── backend/
│   ├── server.js           ← Express app entry point
│   ├── db.js               ← MySQL connection pool
│   ├── .env                ← YOUR CONFIGURATION (edit this)
│   ├── package.json
│   ├── routes/
│   │   ├── assets.js       ← Desktop & Laptop CRUD API
│   │   ├── servers.js      ← Server CRUD API
│   │   ├── audits.js       ← Belarc file upload/download
│   │   ├── reports.js      ← Search + CSV export
│   │   ├── schedules.js    ← Service scheduler
│   │   ├── notifications.js← In-app alerts
│   │   ├── technicians.js  ← Staff management
│   │   └── presets.js      ← Dropdown options
│   ├── middleware/
│   │   └── upload.js       ← Secure Multer file handling
│   ├── jobs/
│   │   └── scheduler.js    ← Daily cron (8 AM overdue check)
│   └── uploads/
│       └── audits/         ← Belarc files stored here (not web-accessible)
├── frontend/
│   ├── index.html          ← Redirects to dashboard
│   ├── dashboard.html      ← KPI overview + notifications
│   ├── new-asset.html      ← Add Desktop or Laptop
│   ├── asset-list.html     ← Search/filter all assets
│   ├── asset-detail.html   ← View/edit single asset record
│   ├── new-server.html     ← Add Linux/Windows server
│   ├── server-list.html    ← Search/filter all servers
│   ├── software-audit.html ← Upload Belarc .html audit files
│   ├── reports.html        ← Advanced search + CSV export
│   ├── scheduler.html      ← Calendar-based service scheduler
│   ├── css/
│   │   └── main.css        ← Full design system (dark mode)
│   └── js/
│       ├── api.js          ← Fetch wrapper + utility functions
│       └── notifications.js← Pop-up alerts + sidebar renderer
└── db/
    └── schema.sql          ← Full database schema + seed data
```

---

## Features Summary

### 📋 Asset Forms (Desktop & Laptop)
- Technician name dropdown (pre-seeded, editable)
- Auto date/time capture on entry
- PC Username, PC Name, Location, Department (all with dropdowns)
- Desktop: CPU, RAM, Motherboard, PSU, SSD, HDD, GPU, Monitor, Keyboard, Mouse, Headphones, UPS, Webcam
- Laptop: Make, Model, Service Tag, RAM, SSD, Battery Health, Power Adapter, Mouse, Headphones
- OS Version, Network IP/MAC, Purchase Date, Warranty Expiry
- Status: Active / Repair / Retired / Lost
- Tags field, Notes field

### 🖧 Server Records (separate section)
- Linux 🐧 and Windows Server 🪟 entries
- Make, Model, Service Tag, CPU, RAM, Storage, RAID
- Server Roles (multi-select checkboxes)
- IP/MAC, Remote Access details
- Last Patch Date, Last OS Upgrade
- Status: Online / Offline / Maintenance / Decommissioned

### 📋 Software Audit (Belarc)
- Drag-and-drop .html file upload
- 6-layer security: type check, size limit, hash rename, outside web root, forced download, SHA-256 integrity
- Link audit to any asset or server
- Secure download with integrity re-verification

### 🔍 Search & Reports
- Search across ALL fields: name, username, department, IP, ID, model, tag, OS
- Filter by type, department, status, date range
- Results table with sortable columns
- **CSV Export** button — downloads full dataset as .csv

### 📅 Service Scheduler
- Interactive month calendar with colour-coded events
  - 🔴 Overdue | 🟡 Due within 7 days | 🔵 Scheduled | 🟢 Completed
- "Needs Attention" panel shows overdue + next 14 days
- Quick-add form: link any asset/server, pick type, set repeat interval (1–12 months)
- Mark service complete → auto-creates next schedule if interval set
- All schedules in sortable table with filter

### 🔔 Notifications
- Pop-up bubbles appear on every page load for overdue/due-soon services
- Notification bell icon with unread count badge
- Slide-out notification panel with full list
- "Mark All Read" button
- Daily background cron (8:00 AM) auto-flags overdue services

### 📊 Dashboard
- Live KPI cards: Total Assets, Desktops, Laptops, Servers, Overdue, Due This Week, Audits, Unread Alerts
- Recent assets table
- Upcoming services with urgency colour coding
- Server status overview
- Quick Action buttons for all major workflows

---

## Adding Your First Asset

1. Go to **Dashboard** → click **Add Asset**
2. Select **Technician** from dropdown
3. Date/time is captured automatically
4. Fill in PC Username, PC Name, Location, Department
5. Select **Desktop** or **Laptop**
6. Fill hardware specs from dropdowns
7. Set Next Service Date and interval
8. Click **Save Asset**
9. Asset gets a unique ID like `PC-20260618-093022-001`

---

## Customising Dropdown Options

All dropdown values (CPU list, RAM sizes, departments, locations, etc.) are stored in the `dropdown_presets` table.

**Via MySQL:**
```sql
USE itams_db;
-- Add a new CPU option
INSERT INTO dropdown_presets (category, value) VALUES ('cpu', 'Intel Core Ultra 7 265K');
-- Add a new department
INSERT INTO dropdown_presets (category, value) VALUES ('department', 'Cybersecurity');
```

**Via API:**
```
POST /api/presets
Body: { "category": "cpu", "value": "Intel Core Ultra 7 265K" }
```

Available categories: `cpu`, `ram`, `ssd`, `hdd`, `motherboard`, `power_supply`, `gfx_card`, `monitor`, `keyboard`, `mouse`, `headphones`, `laptop_make`, `department`, `location`, `os_version`, `server_os`, `service_type`, `server_role`

---

## Adding/Editing Technicians

**Via MySQL:**
```sql
USE itams_db;
INSERT INTO technicians (name, email, department) VALUES ('New Tech', 'tech@company.local', 'IT');
```

**Via API:**
```
POST /api/technicians
Body: { "name": "New Tech", "email": "tech@company.local", "department": "IT" }
```

---

## Unique Asset ID Format

| Prefix | Meaning | Example |
|---|---|---|
| `PC-` | Desktop | `PC-20260618-143022-001` |
| `LT-` | Laptop | `LT-20260618-143022-002` |
| `SV-` | Server | `SV-20260618-143022-001` |

Format: `PREFIX-YYYYMMDD-HHMMSS-SEQ`

---

## Security Notes for Uploaded Audit Files

Belarc `.html` audit files contain sensitive system information. ITAMS applies:

1. ✅ **Extension + MIME check** — only `.html` accepted
2. ✅ **5 MB size limit** — configurable via `.env`
3. ✅ **SHA-256 hash rename** — stored as hash, not original filename
4. ✅ **Outside web root** — `uploads/audits/` not accessible by URL
5. ✅ **Forced download** — `Content-Disposition: attachment` prevents browser execution
6. ✅ **Integrity check** — SHA-256 re-verified on every download

---

## Troubleshooting

| Problem | Fix |
|---|---|
| `[DB] MySQL connection failed` | Check `.env` DB credentials; ensure MySQL is running |
| Port 3000 in use | Change `PORT=3001` in `.env` |
| `Cannot find module` errors | Run `npm install` again in `backend/` folder |
| Dropdowns empty | Schema seed data may not have loaded — re-run `schema.sql` |
| Belarc upload rejected | Ensure file is saved as `.html` from Belarc Advisor |
| Cannot connect from other PC | Ensure Windows Firewall allows port 3000 inbound |

---

## Future Roadmap (Phase 2 Suggestions)

- [ ] Login system with role-based access (Admin / Technician / Read-only)
- [ ] Active Directory / LDAP authentication
- [ ] Bulk CSV import for existing spreadsheet data
- [ ] Email reminders via SMTP (Nodemailer)
- [ ] Photo attachment for hardware damage
- [ ] Software license tracking (seat count, expiry)
- [ ] Remote access session log (TeamViewer/AnyDesk IDs)
- [ ] Asset QR code labels for physical tracking
- [ ] Mobile-responsive improvements
- [ ] Barcode scanner support for serial numbers

---

*ITAMS v1.0 — Internal Use Only*
