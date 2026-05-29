# ZIMRA FDMS Project Structure

## 📂 Root Folder: `C:\Users\Joseph Kaseke\CascadeProjects\`

```
CascadeProjects/
│
├── 📁 Backend (FDMS Bridge)
│   ├── src/                    ← Backend source code
│   │   ├── auth/              ← Device registration & certificates
│   │   ├── device/            ← Device operations
│   │   ├── fiscalDay/         ← Fiscal day management
│   │   ├── receipts/          ← Receipt processing
│   │   ├── signatures/        ← Signature algorithms
│   │   ├── counters/          ← Fiscal counters
│   │   ├── schedulers/        ← Automated tasks
│   │   ├── errors/            ← Error handling
│   │   ├── http/              ← HTTP clients
│   │   └── db/                ← Database & migrations
│   │
│   ├── scripts/               ← Setup scripts
│   ├── tests/                 ← Unit tests
│   ├── certs/                 ← Certificates
│   ├── logs/                  ← Log files
│   │
│   ├── index.js               ← Main backend entry
│   ├── api-server.js          ← REST API for dashboard
│   ├── package.json           ← Backend dependencies
│   └── .env                   ← Backend configuration
│
├── 📁 dashboard/              ← Frontend Dashboard
│   ├── src/
│   │   ├── pages/            ← Dashboard pages
│   │   │   ├── Dashboard.jsx
│   │   │   ├── Receipts.jsx
│   │   │   ├── FiscalDays.jsx
│   │   │   ├── Errors.jsx
│   │   │   └── Admin.jsx     ← Backend control panel
│   │   ├── lib/
│   │   │   └── supabase.js
│   │   ├── App.jsx
│   │   └── main.jsx
│   │
│   ├── package.json          ← Dashboard dependencies
│   ├── vite.config.js
│   ├── tailwind.config.js
│   └── .env                  ← Dashboard configuration
│
├── 📄 Documentation
│   ├── README.md
│   ├── START_HERE.md
│   ├── QUICK_START.md
│   ├── COMPLETE_PROJECT_SUMMARY.md
│   ├── FINAL_STATUS.md
│   ├── DEPLOYMENT_CHECKLIST.md
│   ├── RUN_SYSTEM.md
│   ├── DEVICE_ACTIVATION_STATUS.md
│   ├── SUPABASE_SETUP_CHECKLIST.md
│   └── SUPABASE_VISUAL_GUIDE.md
│
├── 📄 Helper Scripts
│   ├── update-device-info.bat    ← Update device info
│   ├── test-backend.bat          ← Test connection
│   ├── start-dashboard.bat       ← Start dashboard
│   └── open-supabase.bat         ← Open Supabase
│
└── 📄 Configuration
    ├── SUPABASE_CREDENTIALS.txt  ← Saved credentials
    ├── .env                      ← Backend config
    └── .env.example              ← Backend template
```

---

## 🚀 Quick Commands

### Backend Operations

```powershell
# Navigate to root
cd C:\Users\Joseph Kaseke\CascadeProjects

# Test connection
npm run test-connection

# Update device info
.\update-device-info.bat

# Register device (after ZIMRA activation)
npm run setup 35224 00374693

# Start API server
npm run api

# Start full backend (with schedulers)
npm start
```

### Dashboard Operations

```powershell
# Navigate to dashboard
cd C:\Users\Joseph Kaseke\CascadeProjects\dashboard

# Start dashboard
npm run dev

# Or use helper script
cd C:\Users\Joseph Kaseke\CascadeProjects
.\start-dashboard.bat
```

---

## 📍 Important File Locations

### Backend Configuration
- **Main config**: `C:\Users\Joseph Kaseke\CascadeProjects\.env`
- **Certificates**: `C:\Users\Joseph Kaseke\CascadeProjects\certs\`
- **Logs**: `C:\Users\Joseph Kaseke\CascadeProjects\logs\`

### Dashboard Configuration
- **Main config**: `C:\Users\Joseph Kaseke\CascadeProjects\dashboard\.env`

### Database Migration
- **SQL file**: `C:\Users\Joseph Kaseke\CascadeProjects\src\db\migrations\001_initial_schema.sql`

---

## 🎯 Current Device Info

- **Device ID**: 35224
- **Serial No**: Rapi-IR-1
- **Activation Key**: 00374693
- **Status**: Approved, waiting for activation

---

## ✅ Everything is now in the root folder!

**Backend**: `C:\Users\Joseph Kaseke\CascadeProjects\`  
**Dashboard**: `C:\Users\Joseph Kaseke\CascadeProjects\dashboard\`

Much cleaner! 🎉
