# Supabase Setup - Visual Step-by-Step Guide

## 🎯 Goal
Set up Supabase database for ZIMRA FDMS system in 10 minutes.

---

## Step 1: Create Supabase Account

### 1.1 Go to Supabase
- Open browser
- Navigate to: **https://supabase.com**
- Click **"Start your project"** button (green button, top right)

### 1.2 Sign Up
**Option A: GitHub (Recommended)**
- Click "Continue with GitHub"
- Authorize Supabase
- Done!

**Option B: Email**
- Enter email address
- Create password
- Verify email
- Done!

---

## Step 2: Create New Project

### 2.1 Create Organization (First Time Only)
- You'll see "Create a new organization"
- Enter organization name: `Rapid Roots` or `Your Company`
- Click "Create organization"

### 2.2 Create Project
You'll see a form with these fields:

**Project Name**
```
zimra-fdms-bridge
```

**Database Password**
- Click "Generate a password" button
- **IMPORTANT**: Copy and save this password!
- You'll need it if you ever need direct database access

**Region**
Select closest to Zimbabwe:
- `Europe West (Ireland)` - **RECOMMENDED**
- `Southeast Asia (Singapore)` - Alternative
- `US East (N. Virginia)` - Alternative

**Pricing Plan**
- Select "Free" (sufficient for testing and small production)
- Or "Pro" if you need more resources

**Click "Create new project"**

### 2.3 Wait for Provisioning
- You'll see a progress screen
- Takes 2-3 minutes
- Coffee break! ☕

---

## Step 3: Get Your API Credentials

### 3.1 Navigate to Settings
Once project is ready:
- Look at left sidebar (bottom)
- Click **⚙️ Settings** (gear icon)

### 3.2 Go to API Settings
- In Settings menu, click **"API"**
- You'll see "Project API keys" section

### 3.3 Copy Your Credentials

You'll see two important values:

**1. Project URL**
```
URL: https://xxxxxxxxxxxxx.supabase.co
```
- Copy this entire URL
- Save it as `SUPABASE_URL`

**2. API Keys**

There are TWO keys shown:

**anon public** (First key)
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6...
```
- This is for **FRONTEND** (Dashboard)
- Copy and save as `SUPABASE_ANON_KEY`
- Safe to expose in browser

**service_role** (Second key - Click "Reveal" to see)
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6...
```
- This is for **BACKEND** (Bridge)
- Copy and save as `SUPABASE_SERVICE_KEY`
- **KEEP SECRET!** Never expose in frontend

### 3.4 Save Credentials
Create a text file with:
```
Project URL: https://xxxxxxxxxxxxx.supabase.co
Anon Key: eyJhbGc... (for dashboard)
Service Key: eyJhbGc... (for bridge)
Database Password: [your generated password]
```

---

## Step 4: Run Database Migration

### 4.1 Open SQL Editor
- Look at left sidebar
- Click **"SQL Editor"** icon (looks like </> )

### 4.2 Create New Query
- Click **"New Query"** button (top right)
- You'll see an empty SQL editor

### 4.3 Paste Migration SQL
- Open file: `fdms-bridge/src/db/migrations/001_initial_schema.sql`
- Select ALL content (Ctrl+A)
- Copy (Ctrl+C)
- Go back to Supabase SQL Editor
- Paste (Ctrl+V)

You should see ~400 lines of SQL starting with:
```sql
-- ZIMRA FDMS Bridge - Complete Database Schema
-- Run this in Supabase SQL Editor
...
```

### 4.4 Run the Migration
- Click **"Run"** button (bottom right)
- Or press **Ctrl+Enter**
- Wait 5-10 seconds

### 4.5 Verify Success
You should see:
```
Success. No rows returned
```

If you see an error, check:
- Did you paste the entire file?
- Is there a syntax error message?
- Try running again

---

## Step 5: Verify Tables Created

### 5.1 Open Table Editor
- Look at left sidebar
- Click **"Table Editor"** icon (looks like a table grid)

### 5.2 Check Tables
You should see **8 tables** in the left panel:

1. ✅ **applicable_taxes**
2. ✅ **fdms_error_log**
3. ✅ **fdms_ping_log**
4. ✅ **fiscal_day_counters**
5. ✅ **fiscal_days**
6. ✅ **fiscal_devices**
7. ✅ **fiscal_receipts**
8. ✅ **sage_invoice_sync**

### 5.3 Inspect Tables
Click on each table to see:
- **Columns** - Field names and types
- **Rows** - Currently empty (no data yet)
- **Indexes** - Performance indexes created

Example - Click "fiscal_devices":
- You'll see columns: id, device_id, device_serial_no, etc.
- Currently 0 rows
- This is correct!

---

## Step 6: Configure Environment Files

### 6.1 Backend (.env)
Navigate to: `fdms-bridge/.env`

```env
# Supabase
SUPABASE_URL=https://xxxxxxxxxxxxx.supabase.co
SUPABASE_SERVICE_KEY=eyJhbGc...  # Use service_role key!

# Rest of config...
```

**IMPORTANT**: Use `service_role` key for backend!

### 6.2 Dashboard (.env)
Navigate to: `fdms-dashboard/.env`

```env
# Supabase
VITE_SUPABASE_URL=https://xxxxxxxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGc...  # Use anon public key!

# Rest of config...
```

**IMPORTANT**: Use `anon public` key for dashboard!

---

## Step 7: Test Connection

### 7.1 Test Backend
```bash
cd C:\Users\Joseph Kaseke\CascadeProjects\fdms-bridge
npm run test-connection
```

Expected output:
```
✅ All required environment variables present
✅ Supabase connection successful
✅ FDMS API connection successful
```

### 7.2 Test Dashboard
```bash
cd C:\Users\Joseph Kaseke\CascadeProjects\fdms-dashboard
npm run dev
```

- Dashboard opens at http://localhost:3000
- You should see empty dashboard (no data yet)
- No errors in console
- This is correct!

---

## Common Issues & Solutions

### Issue: "Invalid API key"
**Solution**:
- Check you copied the entire key (very long string)
- Verify no extra spaces before/after
- Make sure you're using correct key:
  - Backend → service_role
  - Dashboard → anon public

### Issue: "Project URL not found"
**Solution**:
- Check URL format: `https://xxxxx.supabase.co`
- No trailing slash
- Verify project is active in Supabase dashboard

### Issue: "Tables not found"
**Solution**:
- Go back to SQL Editor
- Re-run the migration
- Check for SQL errors
- Verify in Table Editor

### Issue: "Connection timeout"
**Solution**:
- Check internet connection
- Verify Supabase project is running (not paused)
- Check firewall settings

---

## Optional: Enable Row Level Security (Production)

### When to Enable
- **Development**: Skip this (easier testing)
- **Production**: Enable for security

### How to Enable

1. Go to SQL Editor
2. Run this SQL:

```sql
-- Enable RLS
ALTER TABLE fiscal_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE fiscal_days ENABLE ROW LEVEL SECURITY;
ALTER TABLE fdms_error_log ENABLE ROW LEVEL SECURITY;

-- Allow read access
CREATE POLICY "Allow read access" ON fiscal_receipts
  FOR SELECT USING (true);

CREATE POLICY "Allow read access" ON fiscal_days
  FOR SELECT USING (true);

CREATE POLICY "Allow read access" ON fdms_error_log
  FOR SELECT USING (true);

-- Allow updates for retry functionality
CREATE POLICY "Allow update receipts" ON fiscal_receipts
  FOR UPDATE USING (true);

CREATE POLICY "Allow update errors" ON fdms_error_log
  FOR UPDATE USING (true);
```

3. Click Run

---

## Optional: Enable Real-time (Live Updates)

### When to Enable
- For live dashboard updates
- See receipts appear in real-time
- Watch status changes live

### How to Enable

1. Go to **Database** → **Replication** (left sidebar)
2. Find these tables:
   - fiscal_receipts
   - fiscal_days
   - fdms_error_log
3. Toggle **"Enable Replication"** for each
4. Save changes

Now dashboard will update in real-time!

---

## Verification Checklist

- [ ] Supabase account created
- [ ] Project created and running
- [ ] Project URL copied
- [ ] Anon key copied
- [ ] Service key copied
- [ ] Database password saved
- [ ] Migration SQL run successfully
- [ ] 8 tables visible in Table Editor
- [ ] Backend .env configured with service_role key
- [ ] Dashboard .env configured with anon key
- [ ] Backend connection test passed
- [ ] Dashboard loads without errors

---

## Next Steps

✅ **Supabase is ready!**

Now you can:

1. **Register device** (when you get Device ID from ZIMRA):
   ```bash
   cd fdms-bridge
   npm run setup [deviceID] [activationKey]
   ```

2. **Start backend**:
   ```bash
   npm start
   ```

3. **View dashboard**:
   ```bash
   cd fdms-dashboard
   npm run dev
   ```

4. **Open fiscal day** and start processing receipts!

---

## Quick Reference

### Supabase Dashboard URLs

**Main Dashboard**
```
https://app.supabase.com
```

**Your Project**
```
https://app.supabase.com/project/[your-project-id]
```

**SQL Editor**
```
https://app.supabase.com/project/[your-project-id]/sql
```

**Table Editor**
```
https://app.supabase.com/project/[your-project-id]/editor
```

**API Settings**
```
https://app.supabase.com/project/[your-project-id]/settings/api
```

---

**Setup Complete! 🎉**

Your Supabase database is configured and ready for the ZIMRA FDMS system.
