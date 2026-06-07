/**
 * FDMS Bridge - Auto-Update Server
 * Simple HTTP endpoint to trigger deployment from GitHub webhook
 * 
 * Usage: node server/auto-update.js
 * Set GitHub webhook URL to: http://YOUR_SERVER:9000/webhook
 * 
 * For production, use HTTPS and webhook secret validation
 */

require('dotenv').config();
const http = require('http');
const { exec } = require('child_process');
const path = require('path');

const PORT = process.env.UPDATE_PORT || 9000;
const INSTALL_DIR = process.env.INSTALL_DIR || 'C:\\FDMS\\fdms-bridge';
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET; // Optional: for security

function runCommand(cmd, cwd) {
  return new Promise((resolve, reject) => {
    console.log(`Executing: ${cmd}`);
    exec(cmd, { cwd, timeout: 120000 }, (error, stdout, stderr) => {
      if (error) {
        console.error(`Error: ${error.message}`);
        return reject(error);
      }
      if (stderr) console.log(`stderr: ${stderr}`);
      console.log(`stdout: ${stdout}`);
      resolve(stdout);
    });
  });
}

async function deploy() {
  console.log('\n========== Starting Deployment ==========');
  console.log(`Time: ${new Date().toISOString()}`);
  
  try {
    // Pull latest changes
    await runCommand('git fetch origin main', INSTALL_DIR);
    await runCommand('git reset --hard origin/main', INSTALL_DIR);
    console.log('✅ Code updated');
    
    // Install dependencies
    await runCommand('npm install', INSTALL_DIR);
    console.log('✅ Dependencies installed');
    
    // Restart Windows Service
    try {
      await runCommand('net stop FDMSBridge && net start FDMSBridge', INSTALL_DIR);
      console.log('✅ Service restarted');
    } catch {
      console.log('⚠️  Could not restart service. Please restart manually.');
    }
    
    console.log('========== Deployment Complete ==========\n');
    return true;
  } catch (error) {
    console.error('❌ Deployment failed:', error.message);
    return false;
  }
}

const server = http.createServer(async (req, res) => {
  if (req.url === '/webhook' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const payload = JSON.parse(body);
        
        // Only deploy on pushes to main branch
        if (payload.ref === 'refs/heads/main') {
          console.log(`Push detected by ${payload.pusher?.name || 'unknown'}`);
          console.log(`Commit: ${payload.head_commit?.message || 'N/A'}`);
          
          const success = await deploy();
          res.writeHead(success ? 200 : 500, { 'Content-Type': 'text/plain' });
          res.end(success ? 'Deployment successful' : 'Deployment failed');
        } else {
          res.writeHead(200, { 'Content-Type': 'text/plain' });
          res.end('Ignored: not main branch');
        }
      } catch (error) {
        console.error('Webhook error:', error.message);
        res.writeHead(400, { 'Content-Type': 'text/plain' });
        res.end('Bad request');
      }
    });
  } else if (req.url === '/health' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', time: new Date().toISOString() }));
  } else {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not found');
  }
});

server.listen(PORT, () => {
  console.log(`Auto-update server running on port ${PORT}`);
  console.log(`Webhook endpoint: http://localhost:${PORT}/webhook`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log('\nTo use:');
  console.log('1. Expose port 9000 to internet (use ngrok for testing)');
  console.log('2. Set GitHub webhook to: http://YOUR_SERVER:9000/webhook');
  console.log('3. Push to main branch to trigger auto-deployment');
});
