/**
 * ZIMRA FDMS Bridge - Production Setup Script
 * 
 * This script helps you configure the FDMS Bridge for production
 * using your new ZIMRA credentials.
 * 
 * Usage: node setup-production.js
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const axios = require('axios');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, (answer) => resolve(answer.trim()));
  });
}

function questionHidden(prompt) {
  return new Promise((resolve) => {
    const stdin = process.stdin;
    const stdout = process.stdout;
    
    stdout.write(prompt);
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding('utf8');
    
    let password = '';
    
    stdin.on('data', (ch) => {
      ch = ch + '';
      
      switch(ch) {
        case '\n':
        case '\r':
        case '\u0004':
          stdin.setRawMode(false);
          stdin.pause();
          stdout.write('\n');
          resolve(password);
          break;
        case '\u0003':
          process.exit();
          break;
        default:
          password += ch;
          stdout.write('*');
          break;
      }
    });
  });
}

async function setupProduction() {
  console.log('\n' + '='.repeat(70));
  console.log('  ZIMRA FDMS Bridge - Production Setup');
  console.log('  Rapid Roots Investments (Pvt) Ltd');
  console.log('='.repeat(70) + '\n');
  
  console.log('This script will configure your FDMS Bridge for PRODUCTION.\n');
  
  // Step 1: Get credentials from user
  console.log('--- Step 1: ZIMRA Production Credentials ---\n');
  
  const deviceId = await question('Enter your Production Device ID: ');
  const deviceSerial = await question('Enter your Device Serial Number: ');
  const activationKey = await question('Enter your Activation Key: ');
  const certPassword = await questionHidden('Enter Certificate Password (hidden): ');
  
  console.log('\n--- Step 2: Company Information ---\n');
  
  const companyName = await question('Company Name [Rapid Roots Investments (Pvt) Ltd]: ') || 'Rapid Roots Investments (Pvt) Ltd';
  const companyTin = await question('Company TIN [2002054676]: ') || '2002054676';
  const companyVat = await question('Company VAT Number [220401569]: ') || '220401569';
  
  console.log('\n--- Step 3: Server Configuration ---\n');
  
  const basePath = await question('FDMS Base Path [C:/FDMS]: ') || 'C:/FDMS';
  const useSupabase = await question('Use Supabase for cloud sync? (y/N): ');
  
  let supabaseUrl = '';
  let supabaseKey = '';
  
  if (useSupabase.toLowerCase() === 'y') {
    supabaseUrl = await question('Supabase URL: ');
    supabaseKey = await question('Supabase Anon Key: ');
  }
  
  // Step 4: Create .env file
  console.log('\n--- Step 4: Creating Configuration ---\n');
  
  const envContent = `# ZIMRA FDMS Bridge - Production Configuration
# Generated: ${new Date().toISOString()}
# Device: ${deviceSerial} (ID: ${deviceId})

# ============================================
# ENVIRONMENT
# ============================================
NODE_ENV=production

# ============================================
# ZIMRA FDMS API
# ============================================
# Production API URL
FDMS_URL=https://fdmsapi.zimra.co.zw

# Device Configuration
DEVICE_SERIAL=${deviceSerial}
DEVICE_ID=${deviceId}

# ============================================
# CERTIFICATES
# ============================================
# Path to your ZIMRA certificate (.p12 file)
CERT_PATH=./certs/${deviceSerial.replace(/[^a-zA-Z0-9]/g, '')}.p12
CERT_PASSWORD=${certPassword}

# ============================================
# FILE DIRECTORIES
# ============================================
UNSIGNED_DIR=${basePath}/unsigned
SIGNED_DIR=${basePath}/signed
FAILED_DIR=${basePath}/failed
LOGS_DIR=${basePath}/logs

# ============================================
# SUPABASE (Optional)
# ============================================
SUPABASE_URL=${supabaseUrl}
SUPABASE_KEY=${supabaseKey}

# ============================================
# COMPANY INFORMATION
# ============================================
COMPANY_NAME=${companyName}
COMPANY_TIN=${companyTin}
COMPANY_VAT=${companyVat}

# ============================================
# PROCESSING OPTIONS
# ============================================
POLL_INTERVAL=5000
MAX_RETRIES=3
DEBUG=false

# ============================================
# FISCAL DAY MANAGEMENT
# ============================================
AUTO_OPEN_FISCAL_DAY=true
MAX_FISCAL_DAY_HOURS=24
`;

  const envPath = path.join(__dirname, '.env');
  fs.writeFileSync(envPath, envContent);
  console.log(`✅ Created .env file at: ${envPath}`);
  
  // Step 5: Create directories
  console.log('\n--- Step 5: Creating Directory Structure ---\n');
  
  const dirs = [
    basePath,
    path.join(basePath, 'unsigned'),
    path.join(basePath, 'signed'),
    path.join(basePath, 'failed'),
    path.join(basePath, 'logs')
  ];
  
  dirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      console.log(`✅ Created: ${dir}`);
    } else {
      console.log(`⚠️  Already exists: ${dir}`);
    }
  });
  
  // Step 6: Create certificate directory
  const certsDir = path.join(__dirname, 'certs');
  if (!fs.existsSync(certsDir)) {
    fs.mkdirSync(certsDir, { recursive: true });
    console.log(`✅ Created: ${certsDir}`);
  }
  
  // Step 7: Summary
  console.log('\n' + '='.repeat(70));
  console.log('  Setup Summary');
  console.log('='.repeat(70));
  console.log(`Device ID:        ${deviceId}`);
  console.log(`Device Serial:    ${deviceSerial}`);
  console.log(`Company:          ${companyName}`);
  console.log(`TIN:              ${companyTin}`);
  console.log(`VAT:              ${companyVat}`);
  console.log(`Base Path:        ${basePath}`);
  console.log(`Environment:      Production`);
  console.log('='.repeat(70));
  
  console.log('\n--- Next Steps ---\n');
  console.log('1. Copy your ZIMRA certificate (.p12 file) to:');
  console.log(`   ${certsDir}\\`);
  console.log(`   (Name it: ${deviceSerial.replace(/[^a-zA-Z0-9]/g, '')}.p12)`);
  console.log('');
  console.log('2. Test the connection:');
  console.log('   node scripts/testConnection.js');
  console.log('');
  console.log('3. Check device status:');
  console.log('   node scripts/checkDeviceStatus.js');
  console.log('');
  console.log('4. Open fiscal day (if needed):');
  console.log('   node scripts/openFiscalDay.js');
  console.log('');
  console.log('5. Start the service:');
  console.log('   npm start');
  console.log('   OR install as Windows Service:');
  console.log('   node setup-windows-service.js');
  console.log('');
  console.log('6. Configure Sage 200 to print PDFs to:');
  console.log(`   ${basePath}\\unsigned\\`);
  console.log('');
  
  console.log('='.repeat(70));
  console.log('  Production Setup Complete!');
  console.log('='.repeat(70) + '\n');
  
  rl.close();
}

// Handle errors
process.on('unhandledRejection', (error) => {
  console.error('\n❌ Error:', error.message);
  process.exit(1);
});

setupProduction();
