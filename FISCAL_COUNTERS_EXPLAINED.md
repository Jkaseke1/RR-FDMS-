# 📊 Fiscal Counters - Complete Guide

## ✅ YES! All Required Counters Are Initialized

When you open a fiscal day, **all counters are properly initialized and ready**.

---

## 🔢 How Counter Initialization Works

### Step 1: Fiscal Day Opens
```bash
npm run open-fiscal-day
```

**What happens:**
- ✅ Fiscal day created in database
- ✅ Receipt counter set to 0
- ✅ Status set to "FiscalDayOpened"
- ✅ Fiscal counters table ready (empty, waiting for receipts)

### Step 2: First Receipt Submitted
```bash
npm run test:invoice
```

**What happens:**
- ✅ Receipt processed
- ✅ Counters automatically created for each tax type
- ✅ Counters automatically created for each payment type
- ✅ Values accumulated

### Step 3: More Receipts Submitted
**What happens:**
- ✅ Existing counters updated (values added)
- ✅ New counters created if new tax/payment types appear
- ✅ All counters tracked in `fiscal_day_counters` table

### Step 4: Fiscal Day Closes
```bash
npm run close-fiscal-day
```

**What happens:**
- ✅ All counters included in Z-Report
- ✅ Sent to ZIMRA for verification
- ✅ Counters reset to 0 after successful closure

---

## 📋 All Counter Types (Auto-Initialized)

### 1. Sales Counters (Invoices)
| Counter Type | Description | When Created |
|--------------|-------------|--------------|
| **SaleByTax** | Total sales amount per tax type | First invoice with this tax |
| **SaleTaxByTax** | Total tax collected per tax type | First invoice with this tax |

**Example:**
```
Tax ID 1 (15.5%):
  SaleByTax: $1,000.00 (total sales)
  SaleTaxByTax: $155.00 (total tax)
```

### 2. Credit Note Counters
| Counter Type | Description | When Created |
|--------------|-------------|--------------|
| **CreditNoteByTax** | Total credit note amounts per tax | First credit note with this tax |
| **CreditNoteTaxByTax** | Total tax refunded per tax type | First credit note with this tax |

**Example:**
```
Tax ID 1 (15.5%):
  CreditNoteByTax: -$200.00 (refunded sales)
  CreditNoteTaxByTax: -$31.00 (refunded tax)
```

### 3. Debit Note Counters
| Counter Type | Description | When Created |
|--------------|-------------|--------------|
| **DebitNoteByTax** | Total debit note amounts per tax | First debit note with this tax |
| **DebitNoteTaxByTax** | Total additional tax per tax type | First debit note with this tax |

**Example:**
```
Tax ID 1 (15.5%):
  DebitNoteByTax: $50.00 (additional charges)
  DebitNoteTaxByTax: $7.75 (additional tax)
```

### 4. Payment Counters
| Counter Type | Description | When Created |
|--------------|-------------|--------------|
| **BalanceByMoneyType** | Total payments per payment method | First payment of this type |

**Example:**
```
CASH: $800.00
CARD: $200.00
MOBILE: $150.00
```

---

## 🎯 Counter Initialization Flow

```
┌─────────────────────────────────────────────────────────┐
│ 1. OPEN FISCAL DAY                                      │
│    ✅ Fiscal day created                                │
│    ✅ Receipt counter = 0                               │
│    ✅ Counters table empty (ready)                      │
└─────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────┐
│ 2. SUBMIT INVOICE (Tax 15.5%, Cash $115.50)            │
│    ✅ Creates: SaleByTax[15.5%] = $100.00              │
│    ✅ Creates: SaleTaxByTax[15.5%] = $15.50            │
│    ✅ Creates: BalanceByMoneyType[CASH] = $115.50      │
└─────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────┐
│ 3. SUBMIT ANOTHER INVOICE (Tax 15.5%, Card $231.00)    │
│    ✅ Updates: SaleByTax[15.5%] = $300.00 (+$200)      │
│    ✅ Updates: SaleTaxByTax[15.5%] = $46.50 (+$31)     │
│    ✅ Creates: BalanceByMoneyType[CARD] = $231.00      │
└─────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────┐
│ 4. SUBMIT CREDIT NOTE (Tax 15.5%, Cash -$57.75)        │
│    ✅ Creates: CreditNoteByTax[15.5%] = -$50.00        │
│    ✅ Creates: CreditNoteTaxByTax[15.5%] = -$7.75      │
│    ✅ Updates: BalanceByMoneyType[CASH] = $57.75       │
└─────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────┐
│ 5. CLOSE FISCAL DAY                                     │
│    ✅ All counters sent to ZIMRA in Z-Report            │
│    ✅ ZIMRA verifies counters                           │
│    ✅ Counters reset to 0                               │
│    ✅ Ready for next fiscal day                         │
└─────────────────────────────────────────────────────────┘
```

---

## 🗄️ Database Structure

### Table: `fiscal_day_counters`

```sql
CREATE TABLE fiscal_day_counters (
  id UUID PRIMARY KEY,
  fiscal_day_id UUID REFERENCES fiscal_days(id),
  device_id TEXT,
  fiscal_day_no INTEGER,
  fiscal_counter_type TEXT,           -- SaleByTax, CreditNoteByTax, etc.
  fiscal_counter_currency TEXT,       -- USD, ZWL, etc.
  fiscal_counter_tax_id INTEGER,      -- 1, 2, 3, etc.
  fiscal_counter_tax_percent DECIMAL, -- 15.5, 0, 5, etc.
  fiscal_counter_money_type TEXT,     -- CASH, CARD, MOBILE, etc.
  fiscal_counter_value DECIMAL,       -- Accumulated amount
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

### Example Data After 3 Receipts:

| Counter Type | Currency | Tax ID | Tax % | Money Type | Value |
|--------------|----------|--------|-------|------------|-------|
| SaleByTax | USD | 1 | 15.5 | - | 300.00 |
| SaleTaxByTax | USD | 1 | 15.5 | - | 46.50 |
| CreditNoteByTax | USD | 1 | 15.5 | - | -50.00 |
| CreditNoteTaxByTax | USD | 1 | 15.5 | - | -7.75 |
| BalanceByMoneyType | USD | - | - | CASH | 57.75 |
| BalanceByMoneyType | USD | - | - | CARD | 231.00 |

---

## ✅ Verification Checklist

### Before Opening Fiscal Day:
- [ ] Device registered (ID: 35224)
- [ ] Certificates valid
- [ ] Previous fiscal day closed
- [ ] Database connected

### After Opening Fiscal Day:
- [ ] Fiscal day status = "FiscalDayOpened"
- [ ] Receipt counter = 0
- [ ] Fiscal day number incremented
- [ ] Operation ID received from ZIMRA

### After Submitting Receipts:
- [ ] Counters created in database
- [ ] Counter values accumulating correctly
- [ ] All tax types tracked
- [ ] All payment types tracked

### Before Closing Fiscal Day:
- [ ] All receipts submitted successfully
- [ ] Counters match expected totals
- [ ] No pending receipts
- [ ] Ready for Z-Report

---

## 🔍 How to Monitor Counters

### View All Counters for Current Fiscal Day:
```sql
SELECT 
  fiscal_counter_type,
  fiscal_counter_currency,
  fiscal_counter_tax_percent,
  fiscal_counter_money_type,
  fiscal_counter_value
FROM fiscal_day_counters
WHERE fiscal_day_id = (
  SELECT id FROM fiscal_days 
  WHERE status = 'FiscalDayOpened' 
  ORDER BY opened_at DESC 
  LIMIT 1
)
ORDER BY fiscal_counter_type, fiscal_counter_tax_id;
```

### Check Total Sales:
```sql
SELECT 
  SUM(fiscal_counter_value) as total_sales
FROM fiscal_day_counters
WHERE fiscal_counter_type = 'SaleByTax'
  AND fiscal_day_id = (SELECT id FROM fiscal_days WHERE status = 'FiscalDayOpened' LIMIT 1);
```

### Check Total Tax Collected:
```sql
SELECT 
  SUM(fiscal_counter_value) as total_tax
FROM fiscal_day_counters
WHERE fiscal_counter_type = 'SaleTaxByTax'
  AND fiscal_day_id = (SELECT id FROM fiscal_days WHERE status = 'FiscalDayOpened' LIMIT 1);
```

---

## 🎯 Summary

### ✅ YES - All Counters Are Initialized!

**When you open a fiscal day:**
1. ✅ Receipt counter starts at 0
2. ✅ Fiscal counters table is ready
3. ✅ Counters auto-create as receipts are submitted
4. ✅ All 7 counter types supported:
   - SaleByTax
   - SaleTaxByTax
   - CreditNoteByTax
   - CreditNoteTaxByTax
   - DebitNoteByTax
   - DebitNoteTaxByTax
   - BalanceByMoneyType

**You don't need to manually initialize counters!**

The system automatically:
- Creates counters when first needed
- Updates counters as receipts are submitted
- Tracks all tax types and payment methods
- Includes all counters in Z-Report
- Resets counters after successful closure

---

## 🚀 Ready to Test!

```bash
# Step 1: Open fiscal day (initializes everything)
npm run open-fiscal-day

# Step 2: Submit test receipts (counters auto-update)
npm run test:receipts

# Step 3: Check counters in database
# (Query fiscal_day_counters table)

# Step 4: Close fiscal day (sends counters to ZIMRA)
npm run close-fiscal-day
```

**All counters will be properly initialized and tracked!** ✅
