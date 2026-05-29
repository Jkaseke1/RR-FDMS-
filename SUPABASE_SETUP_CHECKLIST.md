# Supabase Setup Checklist

## ✅ Complete This Checklist Step-by-Step

---

## Step 1: Create Supabase Account

- [ ] Go to https://supabase.com
- [ ] Click "Start your project"
- [ ] Sign up with GitHub (recommended) OR email
- [ ] Verify email if required

**Time**: 2 minutes

---

## Step 2: Create Project

- [ ] Click "New Project"
- [ ] Enter project name: `zimra-fdms-bridge`
- [ ] Click "Generate a password" button
- [ ] **COPY AND SAVE** the password to `SUPABASE_CREDENTIALS.txt`
- [ ] Select region: **Europe West (Ireland)** (closest to Zimbabwe)
- [ ] Select plan: **Free** (sufficient for testing)
- [ ] Click "Create new project"
- [ ] Wait 2-3 minutes for provisioning ☕

**Time**: 3 minutes

---

## Step 3: Copy API Credentials

- [ ] Once project is ready, click **Settings** (⚙️ icon, bottom left)
- [ ] Click **API** in the left menu
- [ ] Copy **Project URL** to `SUPABASE_CREDENTIALS.txt`
- [ ] Copy **anon public** key to `SUPABASE_CREDENTIALS.txt`
- [ ] Click "Reveal" next to **service_role**
- [ ] Copy **service_role** key to `SUPABASE_CREDENTIALS.txt`

**Time**: 2 minutes

---

## Step 4: Run Database Migration

- [ ] Click **SQL Editor** (left sidebar, looks like </>)
- [ ] Click **"New Query"** button
- [ ] Open file: `fdms-bridge/src/db/migrations/001_initial_schema.sql`
- [ ] Select ALL content (Ctrl+A)
- [ ] Copy (Ctrl+C)
- [ ] Paste into Supabase SQL Editor (Ctrl+V)
- [ ] Click **"Run"** button (or press Ctrl+Enter)
- [ ] Wait 5-10 seconds
- [ ] Verify you see: **"Success. No rows returned"**

**Time**: 2 minutes

**Troubleshooting**:
- If error, check you copied the ENTIRE file
- Try running again
- Check for syntax errors in the output

---

## Step 5: Verify Tables Created

- [ ] Click **Table Editor** (left sidebar, grid icon)
- [ ] Verify you see **8 tables**:
  - [ ] applicable_taxes
  - [ ] fdms_error_log
  - [ ] fdms_ping_log
  - [ ] fiscal_day_counters
  - [ ] fiscal_days
  - [ ] fiscal_devices
  - [ ] fiscal_receipts
  - [ ] sage_invoice_sync

- [ ] Click on `fiscal_devices` table
- [ ] Verify columns exist (id, device_id, device_serial_no, etc.)
- [ ] Verify 0 rows (empty - this is correct!)

**Time**: 1 minute

---

## Step 6: Update Backend Environment File

- [ ] Open: `C:\Users\Joseph Kaseke\CascadeProjects\fdms-bridge\.env`
- [ ] If file doesn't exist, copy from `.env.example`
- [ ] Update these lines:

```env
SUPABASE_URL=https://[your-project-id].supabase.co
SUPABASE_SERVICE_KEY=eyJhbGc[your-service-role-key]
```

- [ ] **IMPORTANT**: Use **service_role** key (NOT anon key!)
- [ ] Save file

**Time**: 1 minute

---

## Step 7: Update Dashboard Environment File

- [ ] Open: `C:\Users\Joseph Kaseke\CascadeProjects\fdms-dashboard\.env`
- [ ] If file doesn't exist, copy from `.env.example`
- [ ] Update these lines:

```env
VITE_SUPABASE_URL=https://[your-project-id].supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGc[your-anon-public-key]
```

- [ ] **IMPORTANT**: Use **anon public** key (NOT service_role key!)
- [ ] Save file

**Time**: 1 minute

---

## Step 8: Test Backend Connection

- [ ] Open terminal
- [ ] Navigate to bridge folder:
  ```bash
  cd C:\Users\Joseph Kaseke\CascadeProjects\fdms-bridge
  ```
- [ ] Run test:
  ```bash
  npm run test-connection
  ```
- [ ] Verify output shows:
  ```
  ✅ All required environment variables present
  ✅ Supabase connection successful
  ✅ FDMS API connection successful
  ```

**Time**: 1 minute

**Troubleshooting**:
- If "Missing environment variables": Check `.env` file exists
- If "Supabase connection failed": Check URL and service_role key
- If "Invalid API key": Make sure you copied the entire key

---

## Step 9: Test Dashboard

- [ ] Open new terminal
- [ ] Navigate to dashboard folder:
  ```bash
  cd C:\Users\Joseph Kaseke\CascadeProjects\fdms-dashboard
  ```
- [ ] Start dashboard:
  ```bash
  npm run dev
  ```
- [ ] Browser should open to: http://localhost:3000
- [ ] Verify dashboard loads (will be empty - this is correct!)
- [ ] Check browser console for errors (F12)
- [ ] Should see no errors

**Time**: 2 minutes

**Troubleshooting**:
- If "Missing Supabase environment variables": Check `.env` file
- If "Invalid API key": Check you used anon key (not service_role)
- If tables not found: Re-run database migration

---

## ✅ Verification Checklist

- [ ] Supabase account created
- [ ] Project "zimra-fdms-bridge" created
- [ ] All credentials saved to `SUPABASE_CREDENTIALS.txt`
- [ ] Database migration run successfully
- [ ] 8 tables visible in Table Editor
- [ ] Backend `.env` configured with service_role key
- [ ] Dashboard `.env` configured with anon key
- [ ] Backend connection test passed
- [ ] Dashboard loads without errors

---

## 🎉 Success!

**Total Time**: ~15 minutes

Your Supabase database is now ready!

---

## Next Steps

1. **Wait for Device ID from ZIMRA**
2. **Register device**:
   ```bash
   cd fdms-bridge
   npm run setup [deviceID] [activationKey]
   ```
3. **Start the system**:
   ```bash
   npm start
   ```

---

## Common Issues

### "Invalid API key"
- Check you copied the entire key (very long string)
- Backend uses service_role key
- Dashboard uses anon public key

### "Tables not found"
- Re-run database migration in SQL Editor
- Verify all 8 tables exist in Table Editor

### "Connection timeout"
- Check internet connection
- Verify Supabase project is active (not paused)

---

## Support

- **Supabase Docs**: https://supabase.com/docs
- **Dashboard**: https://app.supabase.com
- **SQL Migration File**: `fdms-bridge/src/db/migrations/001_initial_schema.sql`
