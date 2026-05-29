# 🧪 FDMS Bridge Testing Guide

## 📋 Overview

This guide will help you test invoice, debit note, and credit note submissions before going into production.

---

## ✅ Prerequisites

Before testing, ensure:

1. ✅ **Fiscal Day is Open**
   ```bash
   npm run open-fiscal-day
   ```

2. ✅ **Device is Registered** (Device ID: 35224)
   - Already completed ✓

3. ✅ **Certificates are Valid**
   - Valid until 2027-05-20 ✓

4. ✅ **Database is Connected**
   - Supabase connection active ✓

---

## 🚀 Running Tests

### Option 1: Run All Tests (Recommended)

```bash
npm run test:receipts
```

This will test:
1. Invoice submission
2. Debit note submission  
3. Credit note submission

### Option 2: Run Individual Tests

**Test Invoice Only:**
```bash
npm run test:invoice
```

**Test Debit Note Only:**
```bash
npm run test:debit-note
```

**Test Credit Note Only:**
```bash
npm run test:credit-note
```

---

## 📝 Test Scenarios

### 1. Invoice Test
- **Type**: Standard sales invoice
- **Amount**: $404.25 (including 15.5% tax)
- **Items**: 2 products
- **Payment**: Cash
- **Expected**: Receipt ID from ZIMRA

### 2. Debit Note Test
- **Type**: Price increase/correction
- **Original**: INV-TEST-001
- **Amount**: $86.63 (additional charges)
- **Reason**: Delivery and handling fees
- **Expected**: Receipt ID from ZIMRA

### 3. Credit Note Test
- **Type**: Product return/refund
- **Original**: INV-TEST-001
- **Amount**: -$173.25 (refund)
- **Reason**: Product return
- **Expected**: Receipt ID from ZIMRA

---

## 📊 Understanding Test Results

### ✅ Success Output
```
✅ SUCCESS: Invoice submitted successfully!
============================================================
📋 Result:
   Receipt ID: 12345678
   Global No: RR-2024-0001
   Operation ID: abc-123-def
   QR Code: https://verify.zimra.co.zw/...
============================================================
```

### ❌ Failure Output
```
❌ FAILED: Invoice submission failed
============================================================
Error Details:
   Message: Cannot submit receipt: Fiscal day not open
   FDMS Error Code: DEV02
   Detail: Device not in correct state
============================================================
```

---

## 🔍 Common Issues & Solutions

### Issue 1: "Fiscal day not open"
**Solution:**
```bash
npm run open-fiscal-day
```

### Issue 2: "Certificate expired"
**Solution:**
Contact ZIMRA to renew certificates

### Issue 3: "Invalid TIN"
**Solution:**
Verify buyer TIN is correct (10 digits)

### Issue 4: "Receipt counter mismatch"
**Solution:**
Check last receipt counter in database

### Issue 5: "Network error"
**Solution:**
- Check internet connection
- Verify ZIMRA API is accessible
- Check firewall settings

---

## 📂 Test Data Files

Test data is located in:
- `tests/testInvoice.js` - Invoice test data
- `tests/testDebitNote.js` - Debit note test data
- `tests/testCreditNote.js` - Credit note test data

### Customizing Test Data

Edit the test files to use your own data:

```javascript
const testInvoice = {
  receiptType: 0,
  invoiceNo: 'YOUR-INVOICE-NO',
  buyerData: {
    buyerRegisterName: 'Your Customer Name',
    buyerTIN: 'Your Customer TIN',
    // ... more fields
  },
  receiptLines: [
    {
      receiptLineName: 'Your Product',
      receiptLinePrice: 100.00,
      // ... more fields
    }
  ],
  // ... more fields
};
```

---

## 🔐 Production Checklist

Before going live, verify:

- [ ] All tests pass successfully
- [ ] Receipt IDs are returned from ZIMRA
- [ ] QR codes are generated correctly
- [ ] Receipts are stored in database
- [ ] Fiscal day opens and closes correctly
- [ ] Error handling works properly
- [ ] Certificates are valid
- [ ] Backup procedures are in place
- [ ] Monitoring is configured
- [ ] Support contact established

---

## 📞 Support

If you encounter issues:

1. **Check Logs**: `logs/fdms-bridge.log`
2. **Database**: Check `fiscal_receipts` table for errors
3. **ZIMRA Support**: fdmsapitest@zimra.co.zw
4. **Documentation**: Review FDMS API specification

---

## 🎯 Next Steps After Testing

Once all tests pass:

1. ✅ **Integrate with Your POS/ERP System**
   - Use the `submitReceipt()` function
   - Pass your invoice data in the correct format

2. ✅ **Set Up Production Environment**
   - Switch to production ZIMRA API
   - Update certificates
   - Configure monitoring

3. ✅ **Train Staff**
   - How to open/close fiscal days
   - How to handle errors
   - How to verify receipts

4. ✅ **Go Live!**
   - Start with low volume
   - Monitor closely
   - Have support ready

---

## 📈 Monitoring

After going live, monitor:

- Receipt submission success rate
- Response times
- Error frequency
- Certificate expiry dates
- Fiscal day status
- Database storage

---

**Good luck with your testing!** 🚀
