const schedule = require('node-schedule');
const { ping } = require('../device/ping');
const { supabase } = require('../db/supabaseClient');

/**
 * Ping scheduler with dynamic frequency
 * Per spec section 4.13 - device must ping FDMS regularly when on
 * Use reportingFrequency from ping response to schedule next ping
 */

let currentJob = null;

/**
 * Schedule next ping based on reporting frequency
 */
function scheduleNextPing(deviceId, frequencyMinutes) {
  // Cancel existing job
  if (currentJob) {
    currentJob.cancel();
  }

  // Schedule next ping
  const nextPingDate = new Date(Date.now() + frequencyMinutes * 60 * 1000);
  
  currentJob = schedule.scheduleJob(nextPingDate, async () => {
    try {
      const result = await ping(deviceId);
      
      // Schedule next ping with updated frequency
      if (result.reportingFrequency) {
        scheduleNextPing(deviceId, result.reportingFrequency);
      }
    } catch (error) {
      console.error('Ping failed:', error.message);
      
      // Retry after 5 minutes on failure
      scheduleNextPing(deviceId, 5);
    }
  });

  console.log(`Next ping scheduled for ${nextPingDate.toISOString()}`);
}

/**
 * Start ping scheduler
 */
async function startPingScheduler(deviceId) {
  console.log('Starting ping scheduler...');

  // Check if certificate is valid
  const { data: device } = await supabase
    .from('fiscal_devices')
    .select('certificate_valid_till')
    .eq('device_id', deviceId)
    .single();

  if (device && device.certificate_valid_till) {
    const validTill = new Date(device.certificate_valid_till);
    const now = new Date();

    if (now >= validTill) {
      console.error('❌ Cannot start ping scheduler: Certificate expired');
      return;
    }
  }

  // Do initial ping
  try {
    const result = await ping(deviceId);
    
    // Schedule next ping
    const frequency = result.reportingFrequency || parseInt(process.env.PING_INTERVAL_MINUTES) || 5;
    scheduleNextPing(deviceId, frequency);
    
    console.log('✅ Ping scheduler started');
  } catch (error) {
    console.error('Failed to start ping scheduler:', error.message);
    
    // Retry after 5 minutes
    scheduleNextPing(deviceId, 5);
  }
}

/**
 * Stop ping scheduler
 */
function stopPingScheduler() {
  if (currentJob) {
    currentJob.cancel();
    currentJob = null;
    console.log('Ping scheduler stopped');
  }
}

module.exports = {
  startPingScheduler,
  stopPingScheduler
};
