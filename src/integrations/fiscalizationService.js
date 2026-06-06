/**
 * Fiscalization Service
 * Connects FiscalizationDB to ZIMRA API for real-time invoice fiscalization
 */

require('dotenv').config();
const sql = require('mssql');
const axios = require('axios');
const { submitReceipt } = require('../receipts/submitReceipt');

// SQL Server connection config
const authType = process.env.FISCAL_DB_AUTH_TYPE || 'sql';
const sqlConfig = {
    server: process.env.FISCAL_DB_SERVER || 'DESKTOP-2NAUF52',
    database: process.env.FISCAL_DB_NAME || 'FiscalizationDB',
    port: parseInt(process.env.FISCAL_DB_PORT || '1433'),
    authentication: authType === 'windows' ? {
        type: 'ntlm',
        options: {
            domain: process.env.FISCAL_DB_DOMAIN || ''
        }
    } : {
        type: 'default',
        options: {
            userName: process.env.FISCAL_DB_USER || 'sa',
            password: process.env.FISCAL_DB_PASSWORD || ''
        }
    },
    options: {
        encrypt: true,
        trustServerCertificate: true,
        enableKeepAlive: true,
        connectionTimeout: 15000,
        requestTimeout: 30000
    }
};

const DEVICE_ID = process.env.FDMS_DEVICE_ID || process.env.DEVICE_ID;
const POLL_INTERVAL = parseInt(process.env.FISCALIZATION_POLL_INTERVAL || '10000'); // 10 seconds

let pool;

/**
 * Connect to FiscalizationDB
 */
async function connectToFiscalizationDB() {
    try {
        pool = new sql.ConnectionPool(sqlConfig);
        await pool.connect();
        console.log('✅ Connected to FiscalizationDB');
        return pool;
    } catch (error) {
        console.error('❌ Failed to connect to FiscalizationDB:', error.message);
        throw error;
    }
}

/**
 * Get next pending invoice from queue
 */
async function getNextPendingInvoice() {
    try {
        const request = pool.request();
        
        // Declare output parameters
        request.output('QueueId', sql.Int);
        request.output('SageAutoIndex', sql.Int);
        request.output('CustomerName', sql.VarChar(200));
        request.output('CustomerTin', sql.VarChar(20));
        request.output('TotalAmount', sql.Decimal(15, 2));
        request.output('TaxAmount', sql.Decimal(15, 2));
        
        // Execute stored procedure
        await request.execute('sp_get_next_pending_invoice');
        
        // Check if we got a result
        if (request.parameters.QueueId.value === null) {
            return null;
        }
        
        return {
            queueId: request.parameters.QueueId.value,
            sageAutoIndex: request.parameters.SageAutoIndex.value,
            customerName: request.parameters.CustomerName.value,
            customerTin: request.parameters.CustomerTin.value,
            totalAmount: request.parameters.TotalAmount.value,
            taxAmount: request.parameters.TaxAmount.value
        };
    } catch (error) {
        console.error('❌ Failed to get pending invoice:', error.message);
        throw error;
    }
}

/**
 * Update invoice status after fiscalization
 */
async function updateFiscalizationStatus(queueId, status, zimraData = {}) {
    try {
        const request = pool.request();
        
        request.input('QueueId', sql.Int, queueId);
        request.input('Status', sql.VarChar(20), status);
        request.input('ZimraReceiptId', sql.VarChar(50), zimraData.zimraReceiptId || null);
        request.input('ReceiptGlobalNo', sql.VarChar(50), zimraData.receiptGlobalNo || null);
        request.input('QRCode', sql.Text, zimraData.qrCode || null);
        request.input('OperationId', sql.VarChar(100), zimraData.operationId || null);
        request.input('ErrorMessage', sql.Text, zimraData.errorMessage || null);
        request.input('ErrorCode', sql.VarChar(50), zimraData.errorCode || null);
        
        await request.execute('sp_update_fiscalization_status');
        
        console.log(`✅ Updated queue ID ${queueId} to status: ${status}`);
    } catch (error) {
        console.error(`❌ Failed to update status for queue ID ${queueId}:`, error.message);
        throw error;
    }
}

/**
 * Get invoice line items from Sage
 */
async function getInvoiceLineItems(sageAutoIndex) {
    try {
        const request = pool.request();
        
        const result = await request.query(`
            SELECT 
                InvoiceID,
                LineID,
                Description,
                Quantity,
                UnitPriceExcl,
                LineTotal,
                TaxRate,
                TaxAmount
            FROM vw_sage_invoice_lines
            WHERE InvoiceID = ${sageAutoIndex}
            ORDER BY LineID
        `);
        
        return result.recordset;
    } catch (error) {
        console.error(`❌ Failed to get line items for invoice ${sageAutoIndex}:`, error.message);
        return [];
    }
}

/**
 * Convert Sage invoice to ZIMRA format
 */
async function convertToZimraFormat(invoice) {
    try {
        console.log(`\n📝 Converting invoice ${invoice.sageAutoIndex} to ZIMRA format...`);
        
        // Get line items
        const lineItems = await getInvoiceLineItems(invoice.sageAutoIndex);
        
        if (lineItems.length === 0) {
            throw new Error('No line items found for invoice');
        }
        
        // Build ZIMRA receipt
        const zimraReceipt = {
            receiptType: 0, // Invoice
            receiptCurrency: 'USD',
            invoiceNo: `SAGE-${invoice.sageAutoIndex}`,
            receiptDate: new Date().toISOString().split('.')[0],
            receiptLinesTaxInclusive: true,
            
            buyerData: {
                buyerRegisterName: invoice.customerName || 'Walk-in Customer',
                buyerTIN: invoice.customerTin || '',
                buyerAddress: '',
                buyerContacts: {
                    phoneNo: '',
                    email: ''
                }
            },
            
            receiptLines: lineItems.map((line, index) => ({
                receiptLineType: 0,
                receiptLineNo: index + 1,
                receiptLineHSCode: line.HSCode || '12092500',  // Use actual HS Code from invoice
                receiptLineName: line.Description || 'Item',
                receiptLinePrice: parseFloat(line.UnitPriceExcl || 0),
                receiptLineQuantity: parseFloat(line.Quantity || 1),
                receiptLineTotal: parseFloat(line.LineTotal || 0),
                taxPercent: parseFloat(line.TaxRate || 0),
                taxID: 1 // Default to VAT
            })),
            
            receiptPayments: [
                {
                    moneyTypeCode: 'CASH',
                    paymentAmount: parseFloat(invoice.totalAmount || 0)
                }
            ],
            
            receiptTotal: parseFloat(invoice.totalAmount || 0)
        };
        
        console.log(`   ✅ Converted to ZIMRA format`);
        return zimraReceipt;
    } catch (error) {
        console.error('❌ Failed to convert to ZIMRA format:', error.message);
        throw error;
    }
}

/**
 * Fiscalize a single invoice
 */
async function fiscalizeInvoice(invoice) {
    const queueId = invoice.queueId;
    
    try {
        console.log(`\n${'='.repeat(60)}`);
        console.log(`📄 FISCALIZING INVOICE`);
        console.log(`${'='.repeat(60)}`);
        console.log(`   Sage Invoice ID: ${invoice.sageAutoIndex}`);
        console.log(`   Customer: ${invoice.customerName}`);
        console.log(`   Amount: $${invoice.totalAmount}`);
        
        // Update status to processing
        await updateFiscalizationStatus(queueId, 'processing');
        
        // Convert to ZIMRA format
        const zimraReceipt = await convertToZimraFormat(invoice);
        
        // Submit to ZIMRA
        console.log(`\n🚀 Submitting to ZIMRA...`);
        const result = await submitReceipt(DEVICE_ID, zimraReceipt);
        
        console.log(`   ✅ Fiscalization successful!`);
        console.log(`   ZIMRA Receipt ID: ${result.fdmsReceiptId}`);
        console.log(`   Global No: ${result.receiptGlobalNo}`);
        
        // Update with ZIMRA response
        await updateFiscalizationStatus(queueId, 'completed', {
            zimraReceiptId: result.fdmsReceiptId,
            receiptGlobalNo: result.receiptGlobalNo,
            qrCode: result.qrCode,
            operationId: result.operationID
        });
        
        console.log(`${'='.repeat(60)}\n`);
        return true;
        
    } catch (error) {
        console.error(`\n❌ FISCALIZATION FAILED`);
        console.error(`${'='.repeat(60)}`);
        console.error(`   Error: ${error.message}`);
        console.error(`${'='.repeat(60)}\n`);
        
        // Update with error
        await updateFiscalizationStatus(queueId, 'failed', {
            errorMessage: error.message,
            errorCode: error.code || 'UNKNOWN'
        });
        
        return false;
    }
}

/**
 * Process queue - get and fiscalize invoices
 */
async function processQueue() {
    try {
        console.log(`\n📋 Checking for pending invoices...`);
        
        const invoice = await getNextPendingInvoice();
        
        if (!invoice) {
            console.log('✅ No pending invoices');
            return false;
        }
        
        // Fiscalize the invoice
        const success = await fiscalizeInvoice(invoice);
        
        return success;
        
    } catch (error) {
        console.error('❌ Queue processing error:', error.message);
        return false;
    }
}

/**
 * Start continuous fiscalization
 */
async function startContinuousFiscalization() {
    console.log('\n' + '='.repeat(60));
    console.log('🔄 FISCALIZATION SERVICE STARTED');
    console.log('='.repeat(60));
    console.log(`   Poll Interval: ${POLL_INTERVAL}ms`);
    console.log(`   Device ID: ${DEVICE_ID}`);
    console.log('='.repeat(60) + '\n');
    
    // Connect to database
    await connectToFiscalizationDB();
    
    // Process queue immediately
    await processQueue();
    
    // Set up polling
    setInterval(async () => {
        try {
            await processQueue();
        } catch (error) {
            console.error('Poll error:', error.message);
        }
    }, POLL_INTERVAL);
}

/**
 * Process queue once and exit
 */
async function procesQueueOnce() {
    try {
        await connectToFiscalizationDB();
        
        console.log('\n' + '='.repeat(60));
        console.log('🔄 FISCALIZATION SERVICE (ONE-TIME)');
        console.log('='.repeat(60) + '\n');
        
        let processed = 0;
        let success = 0;
        
        // Process all pending invoices
        while (true) {
            const result = await processQueue();
            processed++;
            if (result) success++;
            
            // Check if there are more
            const nextInvoice = await getNextPendingInvoice();
            if (!nextInvoice) break;
        }
        
        console.log('\n' + '='.repeat(60));
        console.log('📊 SUMMARY');
        console.log('='.repeat(60));
        console.log(`   Processed: ${processed}`);
        console.log(`   Success: ${success}`);
        console.log(`   Failed: ${processed - success}`);
        console.log('='.repeat(60) + '\n');
        
        await pool.close();
        process.exit(0);
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        if (pool) await pool.close();
        process.exit(1);
    }
}

module.exports = {
    connectToFiscalizationDB,
    getNextPendingInvoice,
    updateFiscalizationStatus,
    fiscalizeInvoice,
    processQueue,
    startContinuousFiscalization,
    procesQueueOnce
};

// Run if called directly
if (require.main === module) {
    const mode = process.argv[2] || 'continuous';
    
    if (mode === 'once') {
        procesQueueOnce();
    } else {
        startContinuousFiscalization();
    }
}
