/**
 * Setup FDMS Folder Structure
 * Creates C:\FDMS with subdirectories for PDF processing
 */

const fs = require('fs');
const path = require('path');

const FDMS_BASE = process.env.FDMS_BASE_PATH || 'C:\\FDMS';
const folders = [
    FDMS_BASE,
    path.join(FDMS_BASE, 'unsigned'),
    path.join(FDMS_BASE, 'signed'),
    path.join(FDMS_BASE, 'failed'),
    path.join(FDMS_BASE, 'logs')
];

console.log('\n' + '='.repeat(60));
console.log('🗂️  FDMS FOLDER SETUP');
console.log('='.repeat(60) + '\n');

let created = 0;
let existing = 0;

folders.forEach(folder => {
    if (!fs.existsSync(folder)) {
        try {
            fs.mkdirSync(folder, { recursive: true });
            console.log(`✅ Created: ${folder}`);
            created++;
        } catch (error) {
            console.error(`❌ Failed to create ${folder}: ${error.message}`);
        }
    } else {
        console.log(`⚠️  Already exists: ${folder}`);
        existing++;
    }
});

console.log('\n' + '='.repeat(60));
console.log('📊 SUMMARY');
console.log('='.repeat(60));
console.log(`Created: ${created} folders`);
console.log(`Already existed: ${existing} folders`);
console.log('='.repeat(60) + '\n');

console.log('📁 FDMS Folder Structure:');
console.log(`${FDMS_BASE}\\`);
console.log('├── unsigned\\    (📄 PDFs waiting to be fiscalized)');
console.log('├── signed\\      (✅ Successfully fiscalized PDFs with QR codes)');
console.log('├── failed\\      (❌ PDFs that failed fiscalization)');
console.log('└── logs\\        (📋 Processing logs)\n');

console.log('🎯 Next Steps:');
console.log('1. Print invoices as PDFs to: ' + path.join(FDMS_BASE, 'unsigned'));
console.log('2. Run: npm run pdf:watch');
console.log('3. PDFs will be automatically fiscalized');
console.log('4. Check signed folder for completed PDFs with QR codes\n');
