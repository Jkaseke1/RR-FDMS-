# How to Run the Complete ZIMRA FDMS System

## ✅ Prerequisites Complete

- [x] Supabase setup
- [x] Database migrated
- [x] Environment files configured
- [x] Backend tested

---

## 🚀 Running the System

You need to run **2 terminals**:

### Terminal 1: API Server (Backend Control)

```powershell
cd C:\Users\Joseph Kaseke\CascadeProjects\fdms-bridge
npm run api
```

**This starts**: REST API on port 3001 for dashboard to control backend

**You'll see**:
```
ZIMRA FDMS API Server
Server running on http://localhost:3001
Available endpoints:
  POST /api/openDay
  POST /api/closeDay
  POST /api/getConfig
  ...
```

### Terminal 2: Dashboard (Frontend)

```powershell
cd C:\Users\Joseph Kaseke\CascadeProjects\fdms-bridge\dashboard
npm run dev
```

**This starts**: Dashboard on port 3000

**Browser opens**: http://localhost:3000

---

## 🎯 What You Can Do Now

### In Dashboard:

1. **Dashboard Page** - View stats
2. **Receipts Page** - View all receipts
3. **Fiscal Days Page** - View fiscal day history
4. **Errors Page** - View error logs
5. **Admin Page** ← **NEW! Control backend operations**

### Admin Page Features:

**Fiscal Day Operations**:
- ✅ Open Fiscal Day
- ✅ Close Fiscal Day

**Device Operations**:
- ✅ Fetch Config
- ✅ Get Status
- ✅ Ping ZIMRA

**Certificate Management**:
- ✅ Renew Certificate
- ✅ Get Server Certificate

**Queue Operations**:
- ✅ Process Queue
- ✅ Retry Failed Receipts

**Database Operations**:
- ✅ Run Reconciliation
- ✅ Reset Counters

---

## 🔧 Fix Supabase 406 Errors

Run this SQL in Supabase SQL Editor:

```sql
-- Enable API access
ALTER TABLE fiscal_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE fiscal_days ENABLE ROW LEVEL SECURITY;
ALTER TABLE fiscal_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE fdms_error_log ENABLE ROW LEVEL SECURITY;

-- Allow read access
CREATE POLICY "Allow read" ON fiscal_devices FOR SELECT USING (true);
CREATE POLICY "Allow read" ON fiscal_days FOR SELECT USING (true);
CREATE POLICY "Allow read" ON fiscal_receipts FOR SELECT USING (true);
CREATE POLICY "Allow read" ON fdms_error_log FOR SELECT USING (true);

-- Allow updates
CREATE POLICY "Allow update" ON fiscal_receipts FOR UPDATE USING (true);
CREATE POLICY "Allow update" ON fdms_error_log FOR UPDATE USING (true);
```

---

## 📊 System Architecture

```
┌─────────────────────────────────────┐
│  Dashboard (Port 3000)              │
│  • View data                        │
│  • Control backend via API          │
└────────────┬────────────────────────┘
             │
             ▼
┌─────────────────────────────────────┐
│  API Server (Port 3001)             │
│  • Expose backend functions         │
│  • Handle admin actions             │
└────────────┬────────────────────────┘
             │
             ▼
┌─────────────────────────────────────┐
│  Supabase Database                  │
│  • Store all data                   │
└────────────┬────────────────────────┘
             │
             ▼
┌─────────────────────────────────────┐
│  ZIMRA FDMS API                     │
│  • Receipt validation               │
└─────────────────────────────────────┘
```

---

## 🎯 Quick Commands

### Start API Server
```powershell
cd C:\Users\Joseph Kaseke\CascadeProjects\fdms-bridge
npm run api
```

### Start Dashboard
```powershell
cd C:\Users\Joseph Kaseke\CascadeProjects\fdms-bridge\dashboard
npm run dev
```

### Start Full Backend (with schedulers)
```powershell
cd C:\Users\Joseph Kaseke\CascadeProjects\fdms-bridge
npm start
```

---

## ✅ You're Ready!

1. **Start API server** (Terminal 1)
2. **Start dashboard** (Terminal 2)
3. **Go to Admin page** in dashboard
4. **Control backend operations** with buttons!

No more command line needed - everything is in the dashboard! 🎉
