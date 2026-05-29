/**
 * Sage Pastel 200 v11 Connector
 * Reads invoices from Sage Pastel database and sends to Invoice Bridge
 */

require('dotenv').config();
const odbc = require('odbc');

// Database connection string
const connectionString = `Driver={${process.env.SAGE_DB_DRIVER || 'SQL Server'}};` +
  `Server=${process.env.SAGE_DB_SERVER || 'localhost\\SQLEXPRESS'};` +
  `Database=${process.env.SAGE_DB_NAME || 'Pastel200'};` +
  `UID=${process.env.SAGE_DB_USER || 'sa'};` +
  `PWD=${process.env.SAGE_DB_PASSWORD || ''};`;

/**
 * Connect to Sage Pastel database
 */
async function connectToSage() {
  try {
    const connection = await odbc.connect(connectionString);
    console.log('✅ Connected to Sage Pastel database');
    return connection;
  } catch (error) {
    console.error('❌ Failed to connect to Sage Pastel:', error.message);
    throw error;
  }
}

/**
 * Get unfiscalized invoices from Sage Pastel
 */
async function getUnfiscalizedInvoices(connection, limit = 10) {
  const query = `
    SELECT TOP ${limit}
      -- Invoice Header
      inv.AutoIndex,
      inv.InvNumber,
      inv.InvDate,
      inv.OrderNum,
      
      -- Customer Information
      inv.AccountID,
      inv.Account,
      inv.TaxNumber,
      inv.Physical1 AS Address1,
      inv.Physical2 AS Address2,
      inv.Physical3 AS Address3,
      inv.Telephone,
      inv.Email,
      
      -- Totals
      inv.Total,
      inv.TaxTotal,
      inv.Discount,
      
      -- Payment
      inv.PaymentMethod,
      
      -- Status
      inv.Posted,
      inv.Printed
      
    FROM _btblInvoiceLines inv
    WHERE inv.Posted = 1
      AND inv.Printed = 1
      AND NOT EXISTS (
        SELECT 1 FROM incoming_invoices ii
        WHERE ii.source_invoice_id = CAST(inv.AutoIndex AS VARCHAR)
          AND ii.status = 'submitted'
      )
    ORDER BY inv.InvDate DESC, inv.AutoIndex DESC
  `;
  
  try {
    const result = await connection.query(query);
    console.log(`📋 Found ${result.length} unfiscalized invoices`);
    return result;
  } catch (error) {
    console.error('❌ Failed to query invoices:', error.message);
    throw error;
  }
}

/**
 * Get invoice line items from Sage Pastel
 */
async function getInvoiceLines(connection, autoIndex) {
  const query = `
    SELECT
      -- Line Details
      iLine.iLineID AS LineID,
      iLine.cDescription AS Description,
      iLine.fQuantity AS Quantity,
      iLine.fUnitPriceExcl AS UnitPrice,
      iLine.fLineTotal AS LineTotal,
      
      -- Stock Information
      iLine.cStockCode AS StockCode,
      
      -- Tax Information
      iLine.iTaxTypeID AS TaxTypeID,
      tax.Code AS TaxCode,
      tax.Description AS TaxName,
      tax.Percentage AS TaxRate,
      iLine.fTaxAmount AS TaxAmount
      
    FROM _btblInvoiceLines inv
    INNER JOIN _etblInvoiceLines iLine ON inv.AutoIndex = iLine.iInvoiceID
    LEFT JOIN TaxRate tax ON iLine.iTaxTypeID = tax.idTaxRate
    WHERE inv.AutoIndex = ?
    ORDER BY iLine.iLineID
  `;
  
  try {
    const result = await connection.query(query, [autoIndex]);
    return result;
  } catch (error) {
    console.error(`❌ Failed to get lines for invoice ${autoIndex}:`, error.message);
    throw error;
  }
}

/**
 * Convert Sage invoice to standard format
 */
function convertSageToStandard(sageInvoice, sageLines) {
  return {
    // Source Information
    source_system: 'Sage Pastel 200 v11',
    invoice_id: String(sageInvoice.AutoIndex),
    invoice_number: sageInvoice.InvNumber,
    invoice_date: sageInvoice.InvDate,
    invoice_type: 'invoice',
    
    // Customer Information
    customer: {
      account_id: sageInvoice.AccountID,
      name: sageInvoice.Account,
      tin: sageInvoice.TaxNumber || '',
      address: [
        sageInvoice.Address1,
        sageInvoice.Address2,
        sageInvoice.Address3
      ].filter(Boolean).join(', '),
      phone: sageInvoice.Telephone || '',
      email: sageInvoice.Email || ''
    },
    
    // Line Items
    items: sageLines.map((line, index) => ({
      line_number: index + 1,
      product_code: line.StockCode || '',
      product_name: line.Description,
      hs_code: line.StockCode || '00000000',
      quantity: parseFloat(line.Quantity || 0),
      unit_price: parseFloat(line.UnitPrice || 0),
      line_total: parseFloat(line.LineTotal || 0),
      tax_code: line.TaxCode || 'VAT',
      tax_type: line.TaxName || 'Standard VAT',
      tax_rate: parseFloat(line.TaxRate || 15.5),
      tax_amount: parseFloat(line.TaxAmount || 0)
    })),
    
    // Payment Information
    payment: {
      method: sageInvoice.PaymentMethod || 'Cash',
      amount: parseFloat(sageInvoice.Total || 0)
    },
    
    // Totals
    subtotal: parseFloat(sageInvoice.Total || 0) - parseFloat(sageInvoice.TaxTotal || 0),
    tax_amount: parseFloat(sageInvoice.TaxTotal || 0),
    total_amount: parseFloat(sageInvoice.Total || 0),
    discount: parseFloat(sageInvoice.Discount || 0),
    currency: 'USD',
    
    // Notes
    notes: sageInvoice.OrderNum ? `Order: ${sageInvoice.OrderNum}` : '',
    
    // Sage Specific
    sage_auto_index: sageInvoice.AutoIndex,
    sage_posted: sageInvoice.Posted,
    sage_printed: sageInvoice.Printed
  };
}

/**
 * Process a single Sage invoice
 */
async function processSageInvoice(connection, sageInvoice, bridgeApiUrl) {
  try {
    console.log(`\n📄 Processing Sage Invoice: ${sageInvoice.InvNumber}`);
    
    // Get line items
    const sageLines = await getInvoiceLines(connection, sageInvoice.AutoIndex);
    console.log(`   Lines: ${sageLines.length}`);
    
    // Convert to standard format
    const standardInvoice = convertSageToStandard(sageInvoice, sageLines);
    
    // Send to Invoice Bridge API
    console.log(`   Sending to bridge API...`);
    const response = await fetch(`${bridgeApiUrl}/api/invoices`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(standardInvoice)
    });
    
    const result = await response.json();
    
    if (result.success) {
      console.log(`   ✅ Fiscalized successfully`);
      console.log(`   ZIMRA Receipt ID: ${result.data.zimra_receipt_id}`);
      console.log(`   QR Code: ${result.data.qr_code.substring(0, 50)}...`);
      return result.data;
    } else {
      console.error(`   ❌ Fiscalization failed: ${result.error}`);
      throw new Error(result.error);
    }
    
  } catch (error) {
    console.error(`   ❌ Error processing invoice: ${error.message}`);
    throw error;
  }
}

/**
 * Sync Sage invoices with ZIMRA
 */
async function syncSageInvoices(options = {}) {
  const {
    limit = 10,
    bridgeApiUrl = 'http://localhost:3001',
    pollInterval = 60000 // 1 minute
  } = options;
  
  console.log('\n' + '='.repeat(60));
  console.log('🔄 SAGE PASTEL → ZIMRA SYNC');
  console.log('='.repeat(60));
  console.log(`   Bridge API: ${bridgeApiUrl}`);
  console.log(`   Poll Interval: ${pollInterval / 1000}s`);
  console.log(`   Batch Size: ${limit}`);
  console.log('='.repeat(60) + '\n');
  
  let connection;
  
  try {
    // Connect to Sage database
    connection = await connectToSage();
    
    // Get unfiscalized invoices
    const invoices = await getUnfiscalizedInvoices(connection, limit);
    
    if (invoices.length === 0) {
      console.log('✅ No new invoices to fiscalize\n');
      return { processed: 0, success: 0, failed: 0 };
    }
    
    console.log(`\n📋 Processing ${invoices.length} invoices...\n`);
    
    // Process each invoice
    let success = 0;
    let failed = 0;
    
    for (const invoice of invoices) {
      try {
        await processSageInvoice(connection, invoice, bridgeApiUrl);
        success++;
      } catch (error) {
        failed++;
      }
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('📊 SYNC SUMMARY');
    console.log('='.repeat(60));
    console.log(`   Total: ${invoices.length}`);
    console.log(`   Success: ${success}`);
    console.log(`   Failed: ${failed}`);
    console.log('='.repeat(60) + '\n');
    
    return { processed: invoices.length, success, failed };
    
  } catch (error) {
    console.error('\n❌ Sync failed:', error.message);
    throw error;
  } finally {
    if (connection) {
      await connection.close();
      console.log('✅ Sage database connection closed\n');
    }
  }
}

/**
 * Start continuous sync (polling mode)
 */
async function startContinuousSync(options = {}) {
  const { pollInterval = 60000 } = options;
  
  console.log('🔄 Starting continuous sync...');
  console.log(`   Polling every ${pollInterval / 1000} seconds\n`);
  
  // Run initial sync
  await syncSageInvoices(options);
  
  // Set up polling
  setInterval(async () => {
    try {
      await syncSageInvoices(options);
    } catch (error) {
      console.error('Sync error:', error.message);
    }
  }, pollInterval);
}

module.exports = {
  connectToSage,
  getUnfiscalizedInvoices,
  getInvoiceLines,
  convertSageToStandard,
  processSageInvoice,
  syncSageInvoices,
  startContinuousSync
};

// Run if called directly
if (require.main === module) {
  const mode = process.argv[2] || 'once';
  
  if (mode === 'continuous') {
    startContinuousSync({
      limit: 10,
      bridgeApiUrl: process.env.BRIDGE_API_URL || 'http://localhost:3001',
      pollInterval: parseInt(process.env.POLL_INTERVAL || '60000')
    });
  } else {
    syncSageInvoices({
      limit: 10,
      bridgeApiUrl: process.env.BRIDGE_API_URL || 'http://localhost:3001'
    }).then(() => {
      console.log('✅ Sync complete');
      process.exit(0);
    }).catch((error) => {
      console.error('❌ Sync failed:', error.message);
      process.exit(1);
    });
  }
}
