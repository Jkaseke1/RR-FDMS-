# 🔗 Sage Pastel 200 v11 Integration Guide

## 📋 Overview

This guide shows how to integrate ZIMRA fiscalization with **Sage Pastel 200 v11**.

---

## 🏗️ Integration Architecture

```
┌─────────────────────────────────────────────────────────────┐
│              SAGE PASTEL 200 v11                            │
│           (Accounting & Invoicing)                          │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      │ Option 1: ODBC Database Export
                      │ Option 2: CSV/XML Export
                      │ Option 3: Sage SDK Integration
                      ↓
┌─────────────────────────────────────────────────────────────┐
│                SAGE PASTEL CONNECTOR                        │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ 1. Read invoices from Sage database/export           │  │
│  │ 2. Convert to standard format                        │  │
│  │ 3. Send to Invoice Bridge API                        │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      │ POST /api/invoices
                      ↓
┌─────────────────────────────────────────────────────────────┐
│                   INVOICE BRIDGE API                        │
│              (Maps & Fiscalizes with ZIMRA)                 │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      │ Fiscalized Receipt
                      ↓
┌─────────────────────────────────────────────────────────────┐
│                      ZIMRA FDMS                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 📊 Sage Pastel Database Structure

### Key Tables in Sage Pastel:

1. **`_btblInvoiceLines`** - Invoice line items
2. **`_etblInvoiceLines`** - Extended invoice data
3. **`Client`** - Customer information
4. **`StkItem`** - Stock/product items
5. **`TaxRate`** - Tax rates

### Typical Sage Pastel Invoice Fields:

| Sage Field | Description | Maps To |
|------------|-------------|---------|
| `AutoIndex` | Invoice ID | `invoice_id` |
| `InvNumber` | Invoice Number | `invoice_number` |
| `InvDate` | Invoice Date | `invoice_date` |
| `AccountID` | Customer Account | `customer.account_id` |
| `Account` | Customer Name | `customer.name` |
| `TaxNumber` | Customer TIN | `customer.tin` |
| `Description` | Line Description | `items[].product_name` |
| `Quantity` | Quantity | `items[].quantity` |
| `UnitPrice` | Unit Price | `items[].unit_price` |
| `TaxRate` | Tax Rate | `items[].tax_rate` |
| `LineTotal` | Line Total | `items[].line_total` |
| `TaxAmount` | Tax Amount | `tax_amount` |
| `Total` | Invoice Total | `total_amount` |

---

## 🔧 Integration Options

### **Option 1: ODBC Database Connection (Recommended)**

Read directly from Sage Pastel database using ODBC.

**Advantages:**
- ✅ Real-time access
- ✅ No manual exports
- ✅ Automatic sync

**Requirements:**
- Sage Pastel database credentials
- ODBC driver installed
- Read-only access sufficient

### **Option 2: CSV/XML Export**

Export invoices from Sage Pastel and process them.

**Advantages:**
- ✅ Simple to set up
- ✅ No database access needed
- ✅ Works with any Sage version

**Disadvantages:**
- ❌ Manual export process
- ❌ Not real-time

### **Option 3: Sage SDK Integration**

Use Sage Pastel SDK for direct integration.

**Advantages:**
- ✅ Official Sage API
- ✅ Full access to data
- ✅ Can update Sage with receipt IDs

**Disadvantages:**
- ❌ Requires SDK license
- ❌ More complex setup

---

## 🚀 Quick Start: ODBC Integration

### Step 1: Install Dependencies

```bash
npm install odbc
```

### Step 2: Configure Sage Database Connection

Add to `.env`:

```env
# Sage Pastel Database
SAGE_DB_DRIVER=SQL Server
SAGE_DB_SERVER=localhost\SQLEXPRESS
SAGE_DB_NAME=Pastel200
SAGE_DB_USER=sa
SAGE_DB_PASSWORD=your_password
```

### Step 3: Use Sage Connector

See `src/integrations/sageConnector.js` (created below)

---

## 📝 Sage Pastel Invoice Format

### Typical Sage Pastel Invoice Structure:

```json
{
  "AutoIndex": 12345,
  "InvNumber": "SI001234",
  "InvDate": "2024-05-21",
  "AccountID": "CUST001",
  "Account": "ABC Company Ltd",
  "TaxNumber": "1234567890",
  "Address1": "123 Main Street",
  "Address2": "Harare",
  "Telephone": "+263771234567",
  "Email": "customer@abc.co.zw",
  "Lines": [
    {
      "LineID": 1,
      "StockCode": "PROD001",
      "Description": "Product A",
      "Quantity": 2,
      "UnitPrice": 100.00,
      "LineTotal": 200.00,
      "TaxType": "VAT",
      "TaxRate": 15.5,
      "TaxAmount": 31.00
    }
  ],
  "SubTotal": 200.00,
  "TaxTotal": 31.00,
  "Total": 231.00,
  "PaymentMethod": "Cash"
}
```

---

## 🔄 Mapping Sage Fields to ZIMRA

### Customer Mapping:
```javascript
{
  customer: {
    name: sage.Account,
    tin: sage.TaxNumber,
    address: `${sage.Address1}, ${sage.Address2}`,
    phone: sage.Telephone,
    email: sage.Email
  }
}
```

### Line Items Mapping:
```javascript
{
  items: sage.Lines.map(line => ({
    product_code: line.StockCode,
    product_name: line.Description,
    quantity: line.Quantity,
    unit_price: line.UnitPrice,
    line_total: line.LineTotal,
    tax_code: line.TaxType,
    tax_rate: line.TaxRate
  }))
}
```

### Payment Mapping:
```javascript
{
  payment: {
    method: sage.PaymentMethod.toLowerCase(), // 'Cash' → 'cash'
    amount: sage.Total
  }
}
```

---

## 📊 Tax Code Mapping for Zimbabwe

### Common Sage Pastel Tax Codes:

| Sage Tax Code | Sage Tax Name | ZIMRA Tax ID | ZIMRA Rate |
|---------------|---------------|--------------|------------|
| `VAT` | Standard VAT | 1 | 15.5% |
| `V` | VAT | 1 | 15.5% |
| `ZERO` | Zero Rated | 2 | 0% |
| `Z` | Zero Rated | 2 | 0% |
| `EXEMPT` | Exempt | 3 | 0% |
| `E` | Exempt | 3 | 0% |
| `WHT` | Withholding | 4 | 5% |

**Configure in database:**
```sql
INSERT INTO tax_code_mapping (your_tax_code, your_tax_name, zimra_tax_id, zimra_tax_percent) VALUES
('VAT', 'Standard VAT', 1, 15.5),
('V', 'VAT', 1, 15.5),
('ZERO', 'Zero Rated', 2, 0),
('Z', 'Zero Rated', 2, 0),
('EXEMPT', 'Exempt', 3, 0),
('E', 'Exempt', 3, 0),
('WHT', 'Withholding Tax', 4, 5);
```

---

## 💳 Payment Method Mapping

### Common Sage Pastel Payment Methods:

| Sage Payment | ZIMRA Money Type |
|--------------|------------------|
| `Cash` | CASH |
| `Cheque` | CHEQUE |
| `EFT` | BANK |
| `Credit Card` | CARD |
| `Debit Card` | CARD |
| `EcoCash` | MOBILE |
| `OneMoney` | MOBILE |

**Configure in database:**
```sql
INSERT INTO payment_method_mapping (your_payment_code, your_payment_name, zimra_money_type) VALUES
('Cash', 'Cash Payment', 'CASH'),
('Cheque', 'Cheque Payment', 'CHEQUE'),
('EFT', 'Electronic Transfer', 'BANK'),
('Credit Card', 'Credit Card', 'CARD'),
('Debit Card', 'Debit Card', 'CARD'),
('EcoCash', 'EcoCash', 'MOBILE'),
('OneMoney', 'OneMoney', 'MOBILE');
```

---

## 🔄 Workflow

### 1. Invoice Created in Sage Pastel
- User creates invoice in Sage
- Invoice saved to Sage database

### 2. Connector Reads Invoice
- Sage connector queries database
- Reads new/unfiscalized invoices
- Converts to standard format

### 3. Send to Bridge API
- POST to `/api/invoices`
- Bridge maps to ZIMRA format
- Submits to ZIMRA

### 4. Receive Fiscalized Receipt
- ZIMRA returns receipt ID
- QR code generated
- Stored in database

### 5. Update Sage (Optional)
- Write receipt ID back to Sage
- Add QR code to invoice
- Mark as fiscalized

---

## 📋 Implementation Checklist

- [ ] Install Sage Pastel ODBC driver
- [ ] Configure database connection
- [ ] Test database access
- [ ] Configure tax code mappings
- [ ] Configure payment method mappings
- [ ] Create Sage connector script
- [ ] Test with sample invoice
- [ ] Set up automatic polling
- [ ] Configure error handling
- [ ] Set up monitoring

---

## 🎯 Next Steps

1. ✅ **Provide Sage database credentials** (we'll create connector)
2. ✅ **Share sample Sage invoice** (we'll verify mapping)
3. ✅ **Test fiscalization** (with real Sage data)
4. ✅ **Deploy to production**

---

## 📞 Support

Need help with Sage Pastel integration?
- Sage database structure questions
- Custom field mapping
- Payment method configuration
- Tax code setup

**We'll help you get it working!** 🚀
