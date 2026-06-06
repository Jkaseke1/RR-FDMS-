const Service = require('node-windows').Service;
const path = require('path');

const svc = new Service({
  name: 'ZIMRA FDMS Bridge',
  description: 'ZIMRA Fiscal Device Management System Bridge for Rapid Roots',
  script: path.join(__dirname, 'index.js'),
  nodeOptions: [
    '--max_old_space_size=4096'
  ],
  env: [
    {
      name: "NODE_ENV",
      value: process.env.NODE_ENV || "production"
    }
  ],
  workingDirectory: __dirname,
  allowServiceLogon: true
});

svc.on('install', function() {
  console.log('✅ Service installed successfully');
  console.log('Starting service...');
  svc.start();
});

svc.on('alreadyinstalled', function() {
  console.log('⚠️  Service is already installed');
  console.log('To reinstall, first run: node uninstall-windows-service.js');
});

svc.on('start', function() {
  console.log('✅ Service started successfully');
  console.log('\nService Details:');
  console.log('  Name: ZIMRA FDMS Bridge');
  console.log('  Status: Running');
  console.log('  Startup Type: Automatic');
  console.log('\nManage service using:');
  console.log('  Get-Service "ZIMRA FDMS Bridge"');
  console.log('  Stop-Service "ZIMRA FDMS Bridge"');
  console.log('  Start-Service "ZIMRA FDMS Bridge"');
  console.log('  Restart-Service "ZIMRA FDMS Bridge"');
});

svc.on('error', function(err) {
  console.error('❌ Service error:', err);
});

console.log('Installing ZIMRA FDMS Bridge as Windows Service...');
console.log('This requires Administrator privileges.\n');
svc.install();
