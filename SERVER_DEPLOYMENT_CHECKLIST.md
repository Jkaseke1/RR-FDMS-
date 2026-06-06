# Server Deployment Checklist

## Pre-Deployment Preparation

### Information Gathering
- [ ] ZIMRA Device ID: **35224**
- [ ] ZIMRA Device Serial: **RapidR-1**
- [ ] ZIMRA Certificate (.p12 file) obtained
- [ ] Certificate password documented securely
- [ ] Production server identified and accessible
- [ ] Server has Administrator access
- [ ] Sage 200 Evolution installed on server

### Server Prerequisites
- [ ] Windows Server 2016+ (or Windows 10/11)
- [ ] Node.js 18.x or later installed
- [ ] Minimum 4GB RAM available
- [ ] 10GB free disk space
- [ ] Internet connectivity to ZIMRA API verified
- [ ] Firewall allows HTTPS to zimra.co.zw

---

## Deployment Steps

### 1. File Transfer
- [ ] Copy `fdms-bridge` folder to `C:\FDMS\fdms-bridge\`
- [ ] Verify all files transferred successfully
- [ ] Check folder permissions (Administrator access)

### 2. Run Setup Script
- [ ] Open PowerShell as Administrator
- [ ] Navigate to `C:\FDMS\fdms-bridge\`
- [ ] Run `.\setup-server.ps1`
- [ ] Verify all setup steps completed successfully
- [ ] Note any errors or warnings

### 3. Configuration
- [ ] `.env` file created from template
- [ ] Edit `.env` with production values:
  - [ ] `NODE_ENV=production`
  - [ ] `FDMS_URL=https://fdmsapi.zimra.co.zw`
  - [ ] `DEVICE_ID=35224`
  - [ ] `DEVICE_SERIAL=RapidR-1`
  - [ ] `CERT_PATH=./certs/RapidRoots.p12`
  - [ ] `CERT_PASSWORD=***` (actual password)
  - [ ] Directory paths verified
- [ ] Save `.env` file

### 4. Certificate Installation
- [ ] Copy ZIMRA certificate to `C:\FDMS\fdms-bridge\certs\`
- [ ] Rename to `RapidRoots.p12` (or update CERT_PATH)
- [ ] Verify certificate file exists
- [ ] Test certificate: `node scripts/testConnection.js`

### 5. Directory Structure
Verify these directories exist:
- [ ] `C:\FDMS\unsigned\` (incoming PDFs)
- [ ] `C:\FDMS\signed\` (fiscalized PDFs)
- [ ] `C:\FDMS\failed\` (failed PDFs)
- [ ] `C:\FDMS\logs\` (application logs)

### 6. Windows Service Installation
- [ ] Service installed: `node setup-windows-service.js`
- [ ] Service appears in Services: `Get-Service "ZIMRA FDMS Bridge"`
- [ ] Service set to Automatic startup
- [ ] Service started successfully

---

## Testing & Verification

### Connection Tests
- [ ] Run: `node scripts/testConnection.js`
  - [ ] Certificate validated
  - [ ] ZIMRA API accessible
  - [ ] No SSL/TLS errors

### Device Tests
- [ ] Run: `node scripts/checkDeviceRegistration.js`
  - [ ] Device registered with ZIMRA
  - [ ] Device ID matches configuration

- [ ] Run: `node scripts/checkDeviceStatus.js`
  - [ ] Device status retrieved
  - [ ] Fiscal day status shown
  - [ ] Last receipt number displayed

- [ ] Run: `node scripts/checkSystemStatus.js`
  - [ ] All system checks pass
  - [ ] Configuration valid
  - [ ] Certificates valid

### Fiscal Day Management
- [ ] Check fiscal day status
- [ ] If closed, run: `node scripts/openFiscalDay.js`
- [ ] Verify fiscal day is open

### Service Verification
- [ ] Service running: `Get-Service "ZIMRA FDMS Bridge"`
- [ ] Service status: Running
- [ ] Check logs: `C:\FDMS\logs\fiscalization-*.log`
- [ ] No errors in startup logs

---

## Sage 200 Configuration

### Print-to-File Setup
- [ ] Open Sage 200 Evolution
- [ ] Navigate to Invoice Printing Settings
- [ ] Configure print method:
  - [ ] Print Method: Print to File (PDF)
  - [ ] Output Directory: `C:\FDMS\unsigned\`
  - [ ] File naming: Default Sage pattern
- [ ] Save configuration

### Test Print
- [ ] Print test invoice from Sage
- [ ] Verify PDF appears in `C:\FDMS\unsigned\`
- [ ] Wait for processing (5-10 seconds)
- [ ] Check fiscalized PDF in `C:\FDMS\signed\`
- [ ] Verify QR code on PDF
- [ ] Check logs for successful fiscalization

---

## Post-Deployment Verification

### End-to-End Test
- [ ] Print invoice from Sage
- [ ] PDF appears in `C:\FDMS\unsigned\`
- [ ] Service processes PDF automatically
- [ ] Fiscalized PDF in `C:\FDMS\signed\`
- [ ] QR code stamped on PDF
- [ ] Original PDF removed from `C:\FDMS\unsigned\`
- [ ] No errors in logs

### Credit Note Test
- [ ] Print credit note from Sage
- [ ] References valid invoice number
- [ ] PDF fiscalized successfully
- [ ] Credit note appears on ZIMRA portal
- [ ] Negative amounts correct

### Multi-Tax Test
- [ ] Create invoice with:
  - [ ] Standard VAT item (Tax Code 1)
  - [ ] Zero-rated item (Tax Code 6)
  - [ ] Exempt item (Tax Code 7)
- [ ] Print and fiscalize
- [ ] Verify 3 tax groups in payload
- [ ] Check ZIMRA portal acceptance

---

## Monitoring Setup

### Log Monitoring
- [ ] Logs writing to `C:\FDMS\logs\`
- [ ] Log rotation working
- [ ] No permission errors

### Backup Configuration
- [ ] `backup-fdms.ps1` script created
- [ ] Test backup script manually
- [ ] Schedule in Task Scheduler:
  - [ ] Task name: FDMS Daily Backup
  - [ ] Trigger: Daily at 11:00 PM
  - [ ] Action: Run `backup-fdms.ps1`
  - [ ] Run whether user logged in or not
- [ ] Verify backup directory created
- [ ] Test restore from backup

### Alerts (Optional)
- [ ] Email notifications configured (if using)
- [ ] Slack webhook configured (if using)
- [ ] Test alert delivery

---

## Documentation Handover

### Files to Review
- [ ] `SERVER_QUICK_START.md` - Quick reference
- [ ] `DEPLOYMENT_GUIDE.md` - Complete manual
- [ ] `INSTALLATION_SUMMARY.md` - Overview
- [ ] `README.md` - Technical docs

### Training
- [ ] Server administrator trained on:
  - [ ] Starting/stopping service
  - [ ] Checking logs
  - [ ] Opening fiscal day
  - [ ] Troubleshooting common issues
  - [ ] Running backup script
  - [ ] Restoring from backup

### Support Contacts
- [ ] ZIMRA support contacts documented
- [ ] Internal IT support identified
- [ ] Escalation procedure defined

---

## Security Checklist

### Access Control
- [ ] `C:\FDMS\` folder permissions restricted
- [ ] Certificate password stored securely
- [ ] `.env` file not publicly accessible
- [ ] Service running with appropriate account

### Network Security
- [ ] Firewall rules configured
- [ ] Only HTTPS to zimra.co.zw allowed
- [ ] No unnecessary ports open

### Data Protection
- [ ] Backup encryption considered
- [ ] Backup retention policy defined
- [ ] Old backups cleaned up automatically

---

## Final Sign-Off

### Deployment Completed By
- **Name**: _______________________
- **Date**: _______________________
- **Signature**: _______________________

### Verified By
- **Name**: _______________________
- **Date**: _______________________
- **Signature**: _______________________

### Production Go-Live
- **Date**: _______________________
- **Time**: _______________________
- **Status**: ☐ Success  ☐ Issues (document below)

### Issues Encountered
```
(Document any issues and resolutions here)




```

### Notes
```
(Additional notes or observations)




```

---

## Post-Deployment Monitoring (First Week)

### Daily Checks
- [ ] Day 1: Service running, no errors
- [ ] Day 2: Invoices processing correctly
- [ ] Day 3: Credit notes working
- [ ] Day 4: Backups running
- [ ] Day 5: No failed PDFs
- [ ] Day 6: Logs reviewed
- [ ] Day 7: System stable

### Issues Log
| Date | Issue | Resolution | Status |
|------|-------|------------|--------|
|      |       |            |        |
|      |       |            |        |
|      |       |            |        |

---

**Deployment Status**: ☐ Complete  ☐ In Progress  ☐ Blocked

**Ready for Production**: ☐ Yes  ☐ No (reason: _______________)
