/**
 * Invoice Bridge API Server
 * Receives invoices from your POS/ERP system and fiscalizes them
 */

require('dotenv').config();
const express = require('express');
const { supabase } = require('./src/db/supabaseClient');
const { mapToZimraFormat, validateInvoice } = require('./src/invoices/invoiceMapper');
const { submitReceipt } = require('./src/receipts/submitReceipt');

const app = express();
const PORT = process.env.INVOICE_API_PORT || 3001;
const DEVICE_ID = process.env.FDMS_DEVICE_ID || '35224';

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// CORS
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// ============================================================================
// HEALTH CHECK
// ============================================================================
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'Invoice Bridge API',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

// ============================================================================
// SUBMIT INVOICE
// POST /api/invoices
// ============================================================================
app.post('/api/invoices', async (req, res) => {
  console.log('\n' + '='.repeat(60));
  console.log('📥 NEW INVOICE RECEIVED');
  console.log('='.repeat(60));
  
  try {
    const yourInvoice = req.body;
    
    console.log(`   Invoice ID: ${yourInvoice.invoice_id || yourInvoice.invoice_number}`);
    console.log(`   Customer: ${yourInvoice.customer?.name || 'N/A'}`);
    console.log(`   Total: ${yourInvoice.currency || 'USD'} ${yourInvoice.total_amount}`);
    
    // Step 1: Validate invoice
    console.log('\n📋 Step 1: Validating invoice...');
    validateInvoice(yourInvoice);
    console.log('   ✅ Validation passed');
    
    // Step 2: Store in database
    console.log('\n💾 Step 2: Storing in database...');
    const { data: savedInvoice, error: saveError } = await supabase
      .from('incoming_invoices')
      .insert({
        source_system: yourInvoice.source_system || 'API',
        source_invoice_id: yourInvoice.invoice_id || yourInvoice.invoice_number,
        source_data: yourInvoice,
        invoice_type: 'invoice',
        invoice_number: yourInvoice.invoice_number || yourInvoice.invoice_id,
        invoice_date: yourInvoice.invoice_date || new Date().toISOString(),
        customer_name: yourInvoice.customer?.name,
        customer_tin: yourInvoice.customer?.tin,
        customer_address: yourInvoice.customer?.address,
        customer_phone: yourInvoice.customer?.phone,
        customer_email: yourInvoice.customer?.email,
        subtotal: yourInvoice.subtotal || 0,
        tax_amount: yourInvoice.tax_amount || 0,
        total_amount: yourInvoice.total_amount,
        currency: yourInvoice.currency || 'USD',
        line_items: yourInvoice.items || yourInvoice.line_items,
        payment_method: yourInvoice.payment?.method || yourInvoice.payment?.payment_method,
        payment_amount: yourInvoice.payment?.amount || yourInvoice.total_amount,
        status: 'pending'
      })
      .select()
      .single();
    
    if (saveError) {
      throw new Error(`Failed to save invoice: ${saveError.message}`);
    }
    
    console.log(`   ✅ Saved with ID: ${savedInvoice.id}`);
    
    // Step 3: Map to ZIMRA format
    console.log('\n🔄 Step 3: Mapping to ZIMRA format...');
    const zimraReceipt = await mapToZimraFormat(yourInvoice, { deviceId: DEVICE_ID });
    console.log('   ✅ Mapping complete');
    
    // Update status to mapped
    await supabase
      .from('incoming_invoices')
      .update({ status: 'mapped', mapped_at: new Date().toISOString() })
      .eq('id', savedInvoice.id);
    
    // Step 4: Submit to ZIMRA
    console.log('\n🚀 Step 4: Submitting to ZIMRA...');
    const result = await submitReceipt(DEVICE_ID, zimraReceipt);
    console.log('   ✅ Fiscalization complete');
    
    // Step 5: Update database with ZIMRA response
    console.log('\n💾 Step 5: Updating database...');
    await supabase
      .from('incoming_invoices')
      .update({
        status: 'submitted',
        submitted_at: new Date().toISOString(),
        zimra_receipt_id: result.fdmsReceiptId,
        fiscal_receipt_id: result.receiptId,
        receipt_global_no: result.receiptGlobalNo,
        qr_code: result.qrCode,
        operation_id: result.operationID
      })
      .eq('id', savedInvoice.id);
    
    console.log('   ✅ Database updated');
    
    // Step 6: Log success
    await supabase
      .from('invoice_processing_log')
      .insert({
        incoming_invoice_id: savedInvoice.id,
        event_type: 'submitted',
        event_status: 'success',
        event_message: 'Invoice fiscalized successfully',
        event_data: { zimra_receipt_id: result.fdmsReceiptId }
      });
    
    console.log('\n' + '='.repeat(60));
    console.log('✅ INVOICE FISCALIZED SUCCESSFULLY');
    console.log('='.repeat(60));
    console.log(`   ZIMRA Receipt ID: ${result.fdmsReceiptId}`);
    console.log(`   Global No: ${result.receiptGlobalNo}`);
    console.log(`   QR Code: ${result.qrCode.substring(0, 50)}...`);
    console.log('='.repeat(60) + '\n');
    
    // Return response
    res.status(200).json({
      success: true,
      message: 'Invoice fiscalized successfully',
      data: {
        invoice_id: savedInvoice.id,
        source_invoice_id: savedInvoice.source_invoice_id,
        zimra_receipt_id: result.fdmsReceiptId,
        receipt_global_no: result.receiptGlobalNo,
        qr_code: result.qrCode,
        operation_id: result.operationID,
        fiscalized_at: new Date().toISOString()
      }
    });
    
  } catch (error) {
    console.error('\n❌ INVOICE PROCESSING FAILED');
    console.error('='.repeat(60));
    console.error(`   Error: ${error.message}`);
    console.error('='.repeat(60) + '\n');
    
    // Log error
    if (req.body.invoice_id || req.body.invoice_number) {
      await supabase
        .from('incoming_invoices')
        .update({
          status: 'failed',
          error_message: error.message,
          retry_count: supabase.raw('retry_count + 1')
        })
        .eq('source_invoice_id', req.body.invoice_id || req.body.invoice_number);
    }
    
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// ============================================================================
// SUBMIT DEBIT NOTE
// POST /api/debit-notes
// ============================================================================
app.post('/api/debit-notes', async (req, res) => {
  try {
    const debitNote = { ...req.body, invoice_type: 'debit_note' };
    
    // Validate original invoice exists
    if (!debitNote.original_invoice_id) {
      throw new Error('Original invoice ID is required for debit notes');
    }
    
    // Process same as invoice
    req.body = debitNote;
    return app._router.handle(req, res);
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ============================================================================
// SUBMIT CREDIT NOTE
// POST /api/credit-notes
// ============================================================================
app.post('/api/credit-notes', async (req, res) => {
  try {
    const creditNote = { ...req.body, invoice_type: 'credit_note' };
    
    // Validate original invoice exists
    if (!creditNote.original_invoice_id) {
      throw new Error('Original invoice ID is required for credit notes');
    }
    
    // Process same as invoice
    req.body = creditNote;
    return app._router.handle(req, res);
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ============================================================================
// GET INVOICE STATUS
// GET /api/invoices/:invoiceId/status
// ============================================================================
app.get('/api/invoices/:invoiceId/status', async (req, res) => {
  try {
    const { invoiceId } = req.params;
    
    const { data: invoice, error } = await supabase
      .from('incoming_invoices')
      .select('*')
      .eq('source_invoice_id', invoiceId)
      .single();
    
    if (error || !invoice) {
      return res.status(404).json({
        success: false,
        error: 'Invoice not found'
      });
    }
    
    res.json({
      success: true,
      data: {
        invoice_id: invoice.source_invoice_id,
        status: invoice.status,
        zimra_receipt_id: invoice.zimra_receipt_id,
        receipt_global_no: invoice.receipt_global_no,
        qr_code: invoice.qr_code,
        error_message: invoice.error_message,
        created_at: invoice.created_at,
        submitted_at: invoice.submitted_at
      }
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ============================================================================
// GET FISCALIZED RECEIPT
// GET /api/invoices/:invoiceId/receipt
// ============================================================================
app.get('/api/invoices/:invoiceId/receipt', async (req, res) => {
  try {
    const { invoiceId } = req.params;
    
    const { data: invoice, error } = await supabase
      .from('incoming_invoices')
      .select('*, fiscal_receipts(*)')
      .eq('source_invoice_id', invoiceId)
      .single();
    
    if (error || !invoice) {
      return res.status(404).json({
        success: false,
        error: 'Invoice not found'
      });
    }
    
    if (invoice.status !== 'submitted') {
      return res.status(400).json({
        success: false,
        error: `Invoice not fiscalized yet. Status: ${invoice.status}`
      });
    }
    
    res.json({
      success: true,
      data: {
        invoice_id: invoice.source_invoice_id,
        zimra_receipt_id: invoice.zimra_receipt_id,
        receipt_global_no: invoice.receipt_global_no,
        qr_code: invoice.qr_code,
        operation_id: invoice.operation_id,
        fiscalized_at: invoice.submitted_at,
        receipt_data: invoice.fiscal_receipts
      }
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ============================================================================
// ERROR HANDLER
// ============================================================================
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    message: err.message
  });
});

// ============================================================================
// START SERVER
// ============================================================================
app.listen(PORT, () => {
  console.log('\n' + '='.repeat(60));
  console.log('🌉 INVOICE BRIDGE API SERVER STARTED');
  console.log('='.repeat(60));
  console.log(`   Port: ${PORT}`);
  console.log(`   Device ID: ${DEVICE_ID}`);
  console.log(`   Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log('='.repeat(60));
  console.log('\n📡 API Endpoints:');
  console.log(`   POST   http://localhost:${PORT}/api/invoices`);
  console.log(`   POST   http://localhost:${PORT}/api/debit-notes`);
  console.log(`   POST   http://localhost:${PORT}/api/credit-notes`);
  console.log(`   GET    http://localhost:${PORT}/api/invoices/:id/status`);
  console.log(`   GET    http://localhost:${PORT}/api/invoices/:id/receipt`);
  console.log('='.repeat(60) + '\n');
  console.log('✅ Ready to receive invoices from your POS/ERP system!\n');
});

module.exports = app;
