# Remaining Files - Implementation Guide

## Current Status: 21/44 files complete (48%)

All critical infrastructure is ready:
- ✅ Database schema
- ✅ Signature algorithms (receipt & fiscal day)
- ✅ HTTP clients with mTLS
- ✅ Device registration & config
- ✅ Fiscal day state machine
- ✅ QR code generation

## Files You Need to Create (23 remaining)

### PRIORITY 1: Fiscal Day & Receipt Processing

#### 1. `src/fiscalDay/closeDay.js`
**Purpose**: Close fiscal day and submit counters to ZIMRA

**Key Requirements**:
- Check for Grey/Red receipts before closing
- Build fiscal day signature using `fiscalDaySignature.js`
- Get counters from `fiscalCounterAggregator.js`
- Exclude zero-value counters
- Poll getStatus until FiscalDayClosed or FiscalDayCloseFailed
- Update database with server signature

**Template**:
```javascript
const { getDeviceClient } = require('../http/deviceClient');
const { canCloseDay, transitionTo } = require('./fiscalDayStateMachine');
const { generateFiscalDaySignature } = require('../signatures/fiscalDaySignature');
const { getForCloseDay, reset } = require('../counters/fiscalCounterAggregator');
const { getStatus } = require('../device/getStatus');
const { supabase } = require('../db/supabaseClient');

async function closeDay(deviceId) {
  // 1. Check canCloseDay
  // 2. Check for Grey/Red receipts
  // 3. Get fiscal day from database
  // 4. Build fiscal day signature
  // 5. Get non-zero counters
  // 6. POST to CloseDay
  // 7. Update status to FiscalDayCloseInitiated
  // 8. Poll getStatus (max 10 attempts, 3s apart)
  // 9. If FiscalDayClosed: update DB, reset counters
  // 10. If FiscalDayCloseFailed: update DB, throw error
}
```

#### 2. `src/receipts/receiptValidator.js`
**Purpose**: Validate receipt before submission per spec section 4.7

**Must validate ALL RCPT rules** (RCPT010-RCPT048):
- Currency validity
- Sequential counters
- Unique invoice numbers
- Date validations
- Tax calculations
- Line item validations
- Payment validations

**Return**: Throw for Red errors, warn for Yellow errors

#### 3. `src/receipts/receiptBuilder.js`
**Purpose**: Build complete receipt payload

**Structure**:
```javascript
function buildReceipt(invoiceData, fiscalDayInfo, previousReceiptHash) {
  return {
    receiptType: 'FiscalInvoice',
    receiptCurrency: 'USD',
    receiptCounter: fiscalDayInfo.receiptCounter + 1,
    receiptGlobalNo: fiscalDayInfo.lastReceiptGlobalNo + 1,
    invoiceNo: invoiceData.invoiceNo,
    receiptDate: new Date().toISOString().split('.')[0],
    receiptLinesTaxInclusive: true,
    receiptLines: [...],
    receiptTaxes: [...],
    receiptPayments: [...],
    receiptTotal: calculateTotal(...),
    receiptPrintForm: 'Receipt48'
  };
}
```

#### 4. `src/receipts/submitReceipt.js`
**Purpose**: Submit receipt to ZIMRA

**Steps**:
1. Check canSubmitReceipt
2. Check fiscal day not expired
3. Validate receipt
4. Get previousReceiptHash
5. Increment counters
6. Generate signature
7. Generate QR code
8. Save to database (status='pending')
9. POST to SubmitReceipt
10. Update database with receiptID and server signature
11. Update fiscal counters

#### 5. `src/receipts/receiptQueue.js`
**Purpose**: Sequential receipt queue processor

**Key Rules**:
- Process in ascending receiptGlobalNo order
- NO GAPS allowed
- Stop on failure (don't skip)
- Retry failed receipts up to 3 times
- Run every 30 seconds

#### 6. `src/counters/fiscalCounterAggregator.js`
**Purpose**: Manage fiscal counters per spec section 6

**Counter Types**:
- SaleByTax, SaleTaxByTax (FiscalInvoice)
- CreditNoteByTax, CreditNoteTaxByTax (CreditNote)
- DebitNoteByTax, DebitNoteTaxByTax (DebitNote)
- BalanceByMoneyType (all types)

**Methods**:
```javascript
updateFromReceipt(receipt) // Add receipt to counters
getForCloseDay(applicableTaxes) // Get non-zero counters
reset() // Reset after successful closeDay
saveToSupabase(fiscalDayId, deviceId, fiscalDayNo)
loadFromSupabase(fiscalDayId)
```

### PRIORITY 2: Error Handling

#### 7. `src/errors/fdmsErrorHandler.js`
**Purpose**: Handle all FDMS error codes

**Include ALL codes from spec section 8.2**:
- DEV01-DEV15
- RCPT01-RCPT048
- FISC01, FISC03, FISC04
- FILE01-FILE05

**Functions**:
```javascript
isRetryable(error) // Determine if error is retryable
logError(deviceId, operation, error, extra) // Log to database
```

### PRIORITY 3: Scripts

#### 8. `scripts/testConnection.js`
**Steps**:
1. Load .env
2. Call GetServerCertificate
3. Save certs/fdms-root-ca.pem
4. Test Supabase connection
5. Log all env variables present
6. Report ready or missing items

#### 9. `scripts/setupCertificates.js`
**Usage**: `node scripts/setupCertificates.js [deviceID] [activationKey]`

**Steps**:
1. Validate arguments
2. Call verifyTaxpayer
3. Generate keys
4. Call registerDevice
5. Save certificate
6. Call getConfig
7. Update .env with FDMS_DEVICE_ID
8. Log success

### PRIORITY 4: Tests (CRITICAL)

#### 10. `tests/receiptSignature.test.js`
**Must include ALL 8 test cases from spec section 13.2**:

1. formatTaxPercent tests (6 cases)
2. toCents tests (6 cases)
3. FiscalInvoice Example 1 (ZWL, 4 taxes)
4. FiscalInvoice Example 2 (USD, 3 taxes)
5. CreditNote Example 1 (negative amounts)
6. CreditNote Example 2 (negative amounts)
7. DebitNote Example 1 (positive amounts)
8. DebitNote Example 2 (positive amounts)

**Each test must verify exact hash match from spec**

#### 11. `tests/fiscalDaySignature.test.js`
**Test fiscal day signature using spec section 13.3.1 example**:
- deviceID: 321
- fiscalDayNo: 84
- fiscalDayDate: 2019-09-23
- Expected hash: `OdT8lLI0JXhXl1XQgr64Zb1ltFDksFXThVxqM6O8xZE=`

#### 12. `tests/fiscalCounters.test.js`
**Test counter aggregation**:
1. FiscalInvoice updates SaleByTax and SaleTaxByTax
2. CreditNote updates CreditNoteByTax (negative)
3. DebitNote updates DebitNoteByTax
4. BalanceByMoneyType updated for all types
5. Zero counters excluded from getForCloseDay()
6. Reset clears all counters

### PRIORITY 5: Schedulers

#### 13. `src/schedulers/pingScheduler.js`
- Use `node-schedule`
- Dynamic interval from reportingFrequency
- Stop if certificate expired

#### 14. `src/schedulers/configRefresh.js`
- Refresh every 24 hours
- Check certificate expiry
- Trigger renewal if needed
- Detect VAT status changes

#### 15. `src/schedulers/certRenewalChecker.js`
- Check daily
- Auto-renew if within CERT_RENEWAL_DAYS_BEFORE days

#### 16. `src/schedulers/nightlyReconciliation.js`
- Run at 23:00
- Check for stuck receipts
- Check for expired fiscal days
- Check for Grey receipts
- Check certificate expiry

### PRIORITY 6: Main Entry

#### 17. `index.js`
**On startup**:
1. Load .env
2. Test Supabase
3. Call getServerCertificate
4. If FDMS_DEVICE_ID set:
   - Call getConfig
   - Call getStatus
   - Start all schedulers
   - Start receiptQueue
5. If FDMS_DEVICE_ID empty:
   - Log setup instructions
   - Keep running but no schedulers

## Quick Implementation Order

1. Create `closeDay.js` (completes fiscal day lifecycle)
2. Create `receiptValidator.js` (critical for receipt submission)
3. Create `fiscalCounterAggregator.js` (needed by closeDay)
4. Create `submitReceipt.js` (core receipt processing)
5. Create `receiptQueue.js` (sequential processing)
6. Create `receiptBuilder.js` (payload construction)
7. Create `fdmsErrorHandler.js` (error management)
8. Create all 3 test files (verify correctness)
9. Create both scripts (setup & testing)
10. Create all 4 schedulers (automation)
11. Create `index.js` (tie everything together)

## Testing Strategy

After creating all files:

1. Run `npm install`
2. Run `npm run test-connection`
3. Run `npm test` - ALL tests must pass
4. Run `npm run setup [deviceID] [activationKey]`
5. Run `npm start`

## Notes

- All signature algorithms are already implemented correctly
- Database schema is complete
- HTTP clients handle mTLS automatically
- State machine enforces all fiscal day rules
- Follow the exact specifications in your original prompt for each file

## Need Help?

Refer to:
- Your original detailed prompt for exact specifications
- `src/signatures/receiptSignature.js` for signature examples
- `src/fiscalDay/fiscalDayStateMachine.js` for state management
- `src/db/migrations/001_initial_schema.sql` for database structure
