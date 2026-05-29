# ZIMRA FDMS Bridge - Deployment Checklist

## Pre-Deployment Checklist

### ✅ Environment Setup
- [ ] Node.js installed (v18+ recommended)
- [ ] npm installed
- [ ] Supabase account created
- [ ] Supabase project created
- [ ] OpenSSL installed (for certificate generation)

### ✅ Project Setup
- [ ] Clone/copy project to deployment location
- [ ] Run `npm install`
- [ ] Copy `.env.example` to `.env`
- [ ] Fill in all environment variables

### ✅ Database Setup
- [ ] Open Supabase SQL Editor
- [ ] Run `src/db/migrations/001_initial_schema.sql`
- [ ] Verify all 8 tables created
- [ ] Verify indexes created
- [ ] Verify triggers created

### ✅ Connection Tests
- [ ] Run `npm run test-connection`
- [ ] Verify environment variables loaded
- [ ] Verify Supabase connection successful
- [ ] Verify FDMS API connection successful
- [ ] Verify server certificate saved to `certs/`

### ✅ Unit Tests
- [ ] Run `npm test`
- [ ] Verify all 8 signature tests pass
- [ ] Verify fiscal day signature test passes
- [ ] Verify counter tests pass

---

## ZIMRA Registration Checklist

### ✅ Before Registration
- [ ] Confirm customer details:
  - Company name: Rapid Roots Investment Pvt Ltd
  - TIN: 2002054676
  - VAT Number: 220401569
  - Address: 59 Glenelg, Vainona, Harare
- [ ] Device serial number set: RRFDMS-RR-001
- [ ] Device model: RRFDMS v1.0.0

### ✅ Obtain from ZIMRA
- [ ] Device ID (e.g., 12345)
- [ ] Activation Key (e.g., 00850463)

### ✅ Device Registration
- [ ] Run `npm run setup [deviceID] [activationKey]`
- [ ] Verify taxpayer information correct
- [ ] Verify CSR generated
- [ ] Verify device registered successfully
- [ ] Verify certificate saved
- [ ] Verify configuration fetched
- [ ] Verify `.env` updated with device ID

---

## First Run Checklist

### ✅ Start Bridge
- [ ] Run `npm start`
- [ ] Verify Supabase connection
- [ ] Verify FDMS server certificate fetched
- [ ] Verify device configuration loaded
- [ ] Verify device status retrieved
- [ ] Verify all schedulers started:
  - [ ] Ping scheduler
  - [ ] Config refresh
  - [ ] Certificate renewal checker
  - [ ] Nightly reconciliation
  - [ ] Receipt queue processor

### ✅ Open First Fiscal Day
- [ ] Verify no fiscal day is open
- [ ] Call `openDay(deviceId)` or use API
- [ ] Verify fiscal day opened successfully
- [ ] Verify fiscal day saved to database
- [ ] Note fiscal day number

### ✅ Submit Test Receipt
- [ ] Prepare test invoice data
- [ ] Build receipt using `receiptBuilder.js`
- [ ] Submit via `submitReceipt(deviceId, receipt)`
- [ ] Verify receipt validated
- [ ] Verify signature generated
- [ ] Verify QR code generated
- [ ] Verify receipt submitted to ZIMRA
- [ ] Verify receipt saved to database
- [ ] Verify counters updated

### ✅ Verify QR Code
- [ ] Copy QR URL from database
- [ ] Open in browser
- [ ] Verify redirects to ZIMRA portal
- [ ] Verify receipt details displayed
- [ ] Verify validation color (should be Green)

### ✅ Close First Fiscal Day
- [ ] Verify no Grey/Red receipts
- [ ] Call `closeDay(deviceId)` or use API
- [ ] Verify counters calculated
- [ ] Verify fiscal day signature generated
- [ ] Verify close day submitted to ZIMRA
- [ ] Verify status polled until FiscalDayClosed
- [ ] Verify fiscal day closed successfully
- [ ] Verify counters reset

---

## Production Deployment Checklist

### ✅ Environment Configuration
- [ ] Set `NODE_ENV=production`
- [ ] Update `FDMS_BASE_URL` to production URL
- [ ] Verify all production credentials set
- [ ] Verify certificate paths correct
- [ ] Verify log paths writable

### ✅ Process Management
- [ ] Install PM2: `npm install -g pm2`
- [ ] Create PM2 ecosystem file:
```javascript
module.exports = {
  apps: [{
    name: 'zimra-fdms-bridge',
    script: 'index.js',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production'
    }
  }]
};
```
- [ ] Start with PM2: `pm2 start ecosystem.config.js`
- [ ] Save PM2 config: `pm2 save`
- [ ] Setup PM2 startup: `pm2 startup`

### ✅ Monitoring
- [ ] Setup log rotation
- [ ] Monitor PM2 logs: `pm2 logs zimra-fdms-bridge`
- [ ] Monitor Supabase dashboard
- [ ] Setup alerts for:
  - [ ] Certificate expiry
  - [ ] Failed receipts
  - [ ] Stuck receipts
  - [ ] Fiscal day expiry

### ✅ Backup & Recovery
- [ ] Backup database regularly
- [ ] Backup certificates
- [ ] Backup `.env` file (securely)
- [ ] Document recovery procedures

---

## Integration Checklist (Sage ERP)

### ✅ Sage Integration
- [ ] Identify Sage invoice export format
- [ ] Create invoice parser for Sage format
- [ ] Map Sage fields to FDMS receipt fields:
  - [ ] Invoice number → invoiceNo
  - [ ] Date → receiptDate
  - [ ] Customer → buyerData
  - [ ] Line items → receiptLines
  - [ ] Taxes → receiptTaxes
  - [ ] Payments → receiptPayments
  - [ ] Total → receiptTotal
- [ ] Test parser with sample invoices
- [ ] Verify all required fields present
- [ ] Verify tax calculations correct

### ✅ Automation
- [ ] Setup Sage invoice export schedule
- [ ] Create file watcher for Sage exports
- [ ] Parse invoices automatically
- [ ] Queue receipts for submission
- [ ] Monitor queue processing
- [ ] Handle errors gracefully

---

## Operational Checklist

### ✅ Daily Operations
- [ ] Monitor receipt queue
- [ ] Check for failed receipts
- [ ] Review nightly reconciliation report
- [ ] Verify fiscal day status
- [ ] Check certificate expiry

### ✅ Weekly Operations
- [ ] Review error logs
- [ ] Check database size
- [ ] Verify all schedulers running
- [ ] Test QR codes randomly
- [ ] Review ZIMRA portal

### ✅ Monthly Operations
- [ ] Review all receipts submitted
- [ ] Verify counter accuracy
- [ ] Check for Grey receipts
- [ ] Audit fiscal day closures
- [ ] Review certificate validity

---

## Troubleshooting Checklist

### ✅ Common Issues

**Issue: Certificate Expired**
- [ ] Check `certificate_valid_till` in database
- [ ] Run `issueCertificate(deviceId)`
- [ ] Verify new certificate saved
- [ ] Restart bridge

**Issue: Receipt Submission Failed**
- [ ] Check error code in logs
- [ ] Verify error is retryable
- [ ] Check receipt validation
- [ ] Verify fiscal day is open
- [ ] Check signature generation

**Issue: Fiscal Day Won't Close**
- [ ] Check for Grey/Red receipts
- [ ] Verify all receipts submitted
- [ ] Check counter calculations
- [ ] Verify signature generation
- [ ] Check ZIMRA status

**Issue: Queue Stuck**
- [ ] Check for failed receipts
- [ ] Verify receipt sequence
- [ ] Check for gaps in global numbers
- [ ] Manually retry failed receipt
- [ ] Restart queue processor

**Issue: Ping Failed**
- [ ] Check certificate validity
- [ ] Verify network connectivity
- [ ] Check ZIMRA API status
- [ ] Review error logs
- [ ] Restart ping scheduler

---

## Security Checklist

### ✅ Certificate Management
- [ ] Private key never exposed
- [ ] Certificate stored securely
- [ ] Auto-renewal enabled
- [ ] Expiry monitoring active
- [ ] Backup certificates securely

### ✅ Environment Security
- [ ] `.env` file not in git
- [ ] Supabase keys secured
- [ ] Database access restricted
- [ ] API keys rotated regularly
- [ ] Logs sanitized (no sensitive data)

### ✅ Network Security
- [ ] HTTPS only
- [ ] mTLS enforced
- [ ] Firewall configured
- [ ] VPN if required
- [ ] IP whitelisting if needed

---

## Compliance Checklist

### ✅ ZIMRA Compliance
- [ ] All receipts sequential
- [ ] No gaps in receipt chain
- [ ] Tax rates from getConfig
- [ ] Signature algorithm correct
- [ ] QR codes validate on portal
- [ ] Fiscal days closed properly
- [ ] Counters accurate

### ✅ Data Retention
- [ ] Receipts stored permanently
- [ ] Fiscal days archived
- [ ] Error logs retained
- [ ] Audit trail maintained
- [ ] Backup strategy implemented

---

## Sign-Off

### ✅ Pre-Production
- [ ] All tests passed
- [ ] All checklists completed
- [ ] Documentation reviewed
- [ ] Team trained
- [ ] Support contacts confirmed

**Signed off by**: ___________________
**Date**: ___________________

### ✅ Production Go-Live
- [ ] Production deployment successful
- [ ] First fiscal day opened
- [ ] First receipt submitted
- [ ] QR code verified
- [ ] Monitoring active

**Go-live date**: ___________________
**Signed off by**: ___________________

---

## Emergency Contacts

- **ZIMRA Support**: [Contact details]
- **Supabase Support**: support@supabase.io
- **Technical Lead**: [Your contact]
- **System Administrator**: [Contact details]

---

**Deployment checklist complete. Ready for production!** ✅
