const Service = require('node-windows').Service;
const path = require('path');

const svc = new Service({
  name: 'ZIMRA FDMS Bridge',
  script: path.join(__dirname, 'index.js')
});

svc.on('uninstall', function() {
  console.log('✅ Service uninstalled successfully');
  console.log('The service has been removed from Windows Services');
});

svc.on('alreadyuninstalled', function() {
  console.log('⚠️  Service is not installed');
});

svc.on('error', function(err) {
  console.error('❌ Uninstall error:', err);
});

console.log('Uninstalling ZIMRA FDMS Bridge Windows Service...');
console.log('This requires Administrator privileges.\n');
svc.uninstall();
