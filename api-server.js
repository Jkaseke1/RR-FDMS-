require('dotenv').config();
const http = require('http');
const url = require('url');
const fs = require('fs');
const path = require('path');

const STATE_FILE = 'C:\\FDMS\\state.json';
const LOGS_DIR   = 'C:\\FDMS\\logs';

// Import backend functions
const { openDay } = require('./src/fiscalDay/openDay');
const { closeDay } = require('./src/fiscalDay/closeDay');
const { getConfig } = require('./src/device/getConfig');
const { getStatus } = require('./src/device/getStatus');
const { ping } = require('./src/device/ping');
const { issueCertificate } = require('./src/auth/issueCertificate');
const { getServerCertificate } = require('./src/device/getServerCertificate');
const { processQueue, retryFailedReceipt } = require('./src/receipts/receiptQueue');
const { runReconciliation } = require('./src/schedulers/nightlyReconciliation');
const { reset: resetCounters } = require('./src/counters/fiscalCounterAggregator');
const { supabase } = require('./src/db/supabaseClient');

const PORT = 3001;

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json'
};

// API handlers
const handlers = {
  '/api/openDay': async (body) => {
    const result = await openDay(body.deviceId);
    return { success: true, data: result };
  },

  '/api/closeDay': async (body) => {
    const result = await closeDay(body.deviceId);
    return { success: true, data: result };
  },

  '/api/getConfig': async (body) => {
    const result = await getConfig(body.deviceId);
    return { success: true, data: result };
  },

  '/api/getStatus': async (body) => {
    const result = await getStatus(body.deviceId);
    return { success: true, data: result };
  },

  '/api/ping': async (body) => {
    const result = await ping(body.deviceId);
    return { success: true, data: result };
  },

  '/api/renewCertificate': async (body) => {
    const result = await issueCertificate(body.deviceId);
    return { success: true, data: result };
  },

  '/api/getServerCertificate': async () => {
    const result = await getServerCertificate();
    return { success: true, data: result };
  },

  '/api/processQueue': async (body) => {
    await processQueue(body.deviceId);
    return { success: true, message: 'Queue processing triggered' };
  },

  '/api/retryFailed': async (body) => {
    // Get all failed receipts
    const { data: failedReceipts } = await supabase
      .from('fiscal_receipts')
      .select('id')
      .eq('device_id', body.deviceId)
      .eq('submission_status', 'failed');

    // Retry each
    for (const receipt of failedReceipts || []) {
      await retryFailedReceipt(body.deviceId, receipt.id);
    }

    return { success: true, message: `Retrying ${failedReceipts?.length || 0} failed receipts` };
  },

  '/api/reconcile': async (body) => {
    await runReconciliation(body.deviceId);
    return { success: true, message: 'Reconciliation complete' };
  },

  '/api/resetCounters': async (body) => {
    // Get current fiscal day
    const { data: fiscalDay } = await supabase
      .from('fiscal_days')
      .select('id')
      .eq('device_id', body.deviceId)
      .eq('status', 'FiscalDayOpened')
      .single();

    if (fiscalDay) {
      await resetCounters(fiscalDay.id);
      return { success: true, message: 'Counters reset' };
    } else {
      throw new Error('No open fiscal day found');
    }
  }
};

// GET handlers
const getHandlers = {
  '/api/logs': (query) => {
    const date = query.date || new Date().toISOString().split('T')[0];
    const logFile = path.join(LOGS_DIR, `fiscalization-${date}.log`);
    try {
      const content = fs.readFileSync(logFile, 'utf8');
      const lines = content.split('\n').filter(Boolean);
      const last = Math.min(parseInt(query.lines || '300'), 1000);
      return { success: true, lines: lines.slice(-last), total: lines.length, date };
    } catch {
      return { success: true, lines: [], total: 0, date };
    }
  },
  '/api/state': () => {
    try {
      const state = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
      return {
        success: true,
        data: {
          receiptCounter:  state.receiptCounter  || 0,
          receiptGlobalNo: state.receiptGlobalNo || 0,
          fiscalDayNo:     state.fiscalDayNo     || 1,
          lastReceiptDate: state.lastReceiptDate  || null,
          fiscalCounters:  state.fiscalCounters   || {},
        }
      };
    } catch {
      return { success: false, error: 'State file not found' };
    }
  },
};

// Create HTTP server
const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;
  const query    = parsedUrl.query;

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(200, corsHeaders);
    res.end();
    return;
  }

  // Handle GET requests
  if (req.method === 'GET' && getHandlers[pathname]) {
    try {
      const result = getHandlers[pathname](query);
      res.writeHead(200, corsHeaders);
      res.end(JSON.stringify(result));
    } catch (error) {
      res.writeHead(500, corsHeaders);
      res.end(JSON.stringify({ success: false, error: error.message }));
    }
    return;
  }

  // Handle POST requests
  if (req.method === 'POST' && handlers[pathname]) {
    let body = '';

    req.on('data', chunk => {
      body += chunk.toString();
    });

    req.on('end', async () => {
      try {
        const parsedBody = JSON.parse(body);
        const result = await handlers[pathname](parsedBody);

        res.writeHead(200, corsHeaders);
        res.end(JSON.stringify(result));
      } catch (error) {
        console.error(`Error handling ${pathname}:`, error);
        res.writeHead(500, corsHeaders);
        res.end(JSON.stringify({
          success: false,
          error: error.message
        }));
      }
    });
  } else {
    // 404 for unknown routes
    res.writeHead(404, corsHeaders);
    res.end(JSON.stringify({ error: 'Not found' }));
  }
});

server.listen(PORT, () => {
  console.log('\n========================================');
  console.log('ZIMRA FDMS API Server');
  console.log('========================================');
  console.log(`Server running on http://localhost:${PORT}`);
  console.log('\nAvailable endpoints:');
  Object.keys(handlers).forEach(path => {
    console.log(`  POST ${path}`);
  });
  console.log('\nGET endpoints:');
  Object.keys(getHandlers).forEach(p => console.log(`  GET  ${p}`));
  console.log('========================================\n');
});
