# ZIMRA FDMS Dashboard

Modern React dashboard for monitoring and managing the ZIMRA FDMS Bridge.

## Features

### 📊 Dashboard
- Real-time receipt statistics
- Fiscal day status
- Certificate expiry warnings
- Failed receipt alerts
- Last receipt details

### 🧾 Receipts
- View all submitted receipts
- Search by invoice number or global number
- Filter by status (submitted, pending, failed)
- View QR codes
- Retry failed receipts
- Real-time status updates

### 📅 Fiscal Days
- Current fiscal day status
- Open/Close day controls
- Receipt counter tracking
- Fiscal day history
- Status monitoring

### ⚠️ Error Log
- View all system errors
- Filter by resolved/unresolved
- Mark errors as resolved
- Detailed error information
- Operation tracking

## Tech Stack

- **React 18** - UI framework
- **Vite** - Build tool
- **TailwindCSS** - Styling
- **Supabase** - Database & real-time
- **React Router** - Navigation
- **Lucide React** - Icons
- **date-fns** - Date formatting

## Quick Start

### 1. Install Dependencies

```bash
cd fdms-dashboard
npm install
```

### 2. Configure Environment

```bash
copy .env.example .env
```

Edit `.env` and add your Supabase credentials:

```env
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGc...
VITE_DEVICE_ID=12345
```

### 3. Start Development Server

```bash
npm run dev
```

Dashboard will open at `http://localhost:3000`

### 4. Build for Production

```bash
npm run build
```

Output will be in `dist/` folder.

## Deployment

### Option 1: Netlify (Recommended)

1. Push to GitHub
2. Connect to Netlify
3. Build command: `npm run build`
4. Publish directory: `dist`
5. Add environment variables in Netlify dashboard

### Option 2: Vercel

1. Push to GitHub
2. Import to Vercel
3. Framework preset: Vite
4. Add environment variables

### Option 3: Static Hosting

1. Run `npm run build`
2. Upload `dist/` folder to any static host
3. Ensure environment variables are set

## Supabase Setup

### Row Level Security (RLS)

For production, enable RLS on tables:

```sql
-- Enable RLS
ALTER TABLE fiscal_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE fiscal_days ENABLE ROW LEVEL SECURITY;
ALTER TABLE fdms_error_log ENABLE ROW LEVEL SECURITY;

-- Allow read access (adjust as needed)
CREATE POLICY "Allow read access" ON fiscal_receipts
  FOR SELECT USING (true);

CREATE POLICY "Allow read access" ON fiscal_days
  FOR SELECT USING (true);

CREATE POLICY "Allow read access" ON fdms_error_log
  FOR SELECT USING (true);

-- Allow update for retry functionality
CREATE POLICY "Allow update receipts" ON fiscal_receipts
  FOR UPDATE USING (true);

CREATE POLICY "Allow update errors" ON fdms_error_log
  FOR UPDATE USING (true);
```

### Real-time Subscriptions (Optional)

Enable real-time for live updates:

1. Go to Supabase Dashboard → Database → Replication
2. Enable replication for:
   - `fiscal_receipts`
   - `fiscal_days`
   - `fdms_error_log`

## Project Structure

```
fdms-dashboard/
├── src/
│   ├── pages/
│   │   ├── Dashboard.jsx      # Overview stats
│   │   ├── Receipts.jsx       # Receipt list & search
│   │   ├── FiscalDays.jsx     # Fiscal day management
│   │   └── Errors.jsx         # Error log viewer
│   ├── lib/
│   │   └── supabase.js        # Supabase client
│   ├── App.jsx                # Main app & routing
│   ├── main.jsx               # Entry point
│   └── index.css              # Global styles
├── public/
├── index.html
├── package.json
├── vite.config.js
└── tailwind.config.js
```

## Features in Detail

### Dashboard Page

**Metrics**:
- Receipts submitted today
- Pending queue count
- Failed receipts count
- Current fiscal day status

**Alerts**:
- Certificate expiring soon
- Failed receipts
- Fiscal day close failures

**Last Receipt**:
- Invoice number
- Amount
- Status
- Timestamp

### Receipts Page

**Search & Filter**:
- Search by invoice number
- Search by global number
- Filter by status

**Actions**:
- View QR code (opens ZIMRA portal)
- Retry failed receipts
- Real-time status updates

**Table Columns**:
- Invoice number
- Global number
- Receipt type
- Amount
- Status (with validation color)
- Date
- Actions

### Fiscal Days Page

**Current Day**:
- Fiscal day number
- Status
- Opened timestamp
- Receipt counter
- Close day button

**History**:
- All previous fiscal days
- Status tracking
- Receipt counts
- Open/close timestamps

### Errors Page

**Error List**:
- Error code
- Error message
- Operation type
- HTTP status
- Timestamp
- Detailed information

**Actions**:
- Mark as resolved
- Filter by status
- View extra data

## Customization

### Colors

Edit `tailwind.config.js`:

```javascript
theme: {
  extend: {
    colors: {
      primary: {
        50: '#f0f9ff',
        500: '#0ea5e9',
        600: '#0284c7',
      }
    }
  }
}
```

### Company Branding

Edit `src/App.jsx`:

```jsx
<h1>Your Company Name</h1>
<p>TIN: Your TIN</p>
```

## Troubleshooting

### "Missing Supabase environment variables"

- Ensure `.env` file exists
- Check variable names start with `VITE_`
- Restart dev server after changing `.env`

### Tables not found

- Run database migration in Supabase
- Check table names match exactly
- Verify Supabase project is active

### RLS errors

- Disable RLS for development
- Configure policies for production
- Use service role key for backend

## License

Proprietary - Rapid Roots Investment Pvt Ltd
# Rapid-Roots-FDMS-
